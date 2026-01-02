const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const Expense = require('../models/Expense');
const ProcessedData = require('../models/ProcessedData');
const { processReceiptWithVision } = require('../utils/openai_client');
const {
  extractTextFromImage,
  parseExpenseData,
  detectCategory,
  generateTitle
} = require('../utils/ocrProcessor');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Check for duplicate expenses
async function checkDuplicate(userId, expenseData) {
  const { date, amount, title } = expenseData;
  
  // Parse the date
  let searchDate;
  try {
    searchDate = new Date(date);
  } catch (error) {
    return null;
  }

  // Search for expenses within 24 hours with similar amount and title
  const dayBefore = new Date(searchDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(searchDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const duplicates = await Expense.find({
    user: userId,
    date: {
      $gte: dayBefore,
      $lte: dayAfter
    },
    amount: {
      $gte: amount * 0.95, // 5% tolerance
      $lte: amount * 1.05
    }
  });

  // Check for similar titles
  const titleWords = title.toLowerCase().split(/\s+/);
  for (const duplicate of duplicates) {
    const dupTitleWords = duplicate.title.toLowerCase().split(/\s+/);
    const commonWords = titleWords.filter(word => dupTitleWords.includes(word));
    
    // If more than 50% of words match, consider it a duplicate
    if (commonWords.length >= titleWords.length * 0.5) {
      return duplicate;
    }
  }

  return null;
}

// @route   POST /api/ocr/upload
// @desc    Upload and process receipt images using PFIE AI pipeline
// @access  Private
router.post('/upload', auth, upload.array('receipts', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    const processedExpenses = [];
    const errors = [];

    // Get user transaction history for ML context
    let userHistory = [];
    try {
      const expenses = await Expense.find({ user: req.user.id }).limit(100);
      userHistory = expenses.map(e => ({
        amount: e.amount,
        category: e.category,
        date: e.date
      }));
    } catch (err) {
      console.warn('Could not load user history:', err.message);
    }

    // Process each file with OpenAI Vision API (direct image processing)
    for (const file of req.files) {
      try {
        console.log(`Processing ${file.originalname} with OpenAI Vision API...`);
        
        // Call OpenAI Vision API directly on the image
        const visionResult = await processReceiptWithVision(file.path);

        let expenseData = [];
        
        if (visionResult && visionResult.success && visionResult.parsed) {
          const parsed = visionResult.parsed;
          
          // Extract items from Vision API response
          if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
            console.log(`Extracted ${parsed.items.length} line items from receipt via Vision API`);
            
            for (const item of parsed.items) {
              expenseData.push({
                title: item.item_name || 'Item',
                amount: item.total_price || 0,
                category: item.category_suggestion || detectCategory(item.item_name || ''),
                date: item.date ? new Date(item.date) : (parsed.date ? new Date(parsed.date) : new Date()),
                description: `OpenAI Vision Processed
Merchant: ${parsed.merchant || 'N/A'}
Quantity: ${item.quantity || 1}
Unit Price: ${item.unit_price || 'N/A'}
Tax: ${item.tax || 0}
Discount: ${item.discount || 0}
Notes: ${item.notes || parsed.notes || ''}`,
                rawText: item.rawLine || `${parsed.merchant || ''} - ${item.item_name || ''}`,
                imagePath: file.path,
                confidence: parsed.confidence || 0.9,
                qualityScore: parsed.confidence || 0.9,
                aiProcessed: true,
                aiInsights: {
                  lineItem: true,
                  merchant: parsed.merchant,
                  quantity: item.quantity,
                  unitPrice: item.unit_price,
                  tax: item.tax,
                  discount: item.discount,
                  category_suggestion: item.category_suggestion,
                  notes: item.notes || parsed.notes,
                  visionProcessed: true
                }
              });
            }
            
            // Persist the OpenAI Vision result to ProcessedData
            try {
              const pd = new ProcessedData({
                user: req.user.id,
                fileName: file.originalname,
                imagePath: file.path,
                originalItems: parsed.items,
                processedItems: expenseData,
                openaiResponse: visionResult.raw
              });
              await pd.save();
              console.log('Saved processed data to database');
            } catch (saveErr) {
              console.warn('Failed to save processed data:', saveErr.message);
            }
          } else {
            // Vision API returned no line items — attempt OCR text parsing to extract multiple rows
            let usedOcrFallback = false;
            try {
              const text = await extractTextFromImage(file.path);
              const parsedData = parseExpenseData(text);

              if (parsedData.items && parsedData.items.length > 1) {
                // Use OCR-derived items (useful for bank statement screenshots)
                expenseData = parsedData.items.map(item => ({
                  title: item.name || 'Item',
                  amount: item.price || 0,
                  category: detectCategory(item.name || ''),
                    date: item.date ? new Date(item.date) : (parsedData.date ? new Date(parsedData.date) : new Date()),
                  description: item.name + (item.qty ? ` · qty:${item.qty}` : ''),
                    rawText: item.rawLine || parsedData.rawText || '',
                  imagePath: file.path,
                  confidence: 0.8,
                  aiProcessed: false
                }));
                usedOcrFallback = true;
              }
            } catch (err) {
              console.warn('OCR fallback parse failed:', err.message);
            }

            if (!usedOcrFallback) {
              // Default single-expense fallback
              expenseData = [{
                title: parsed.merchant || 'Receipt',
                amount: parsed.total || 0,
                category: detectCategory(parsed.merchant || ''),
                date: parsed.date ? new Date(parsed.date) : new Date(),
                description: `OpenAI Vision - ${parsed.merchant || 'Receipt'}\nTotal: ${parsed.total}\nNotes: ${parsed.notes || ''}`,
                rawText: parsed.merchant || '',
                imagePath: file.path,
                confidence: parsed.confidence || 0.9,
                aiProcessed: true,
                aiInsights: { visionProcessed: true, merchant: parsed.merchant, notes: parsed.notes }
              }];
            }
          }
        } else {
          // Fallback to legacy OCR if Vision API fails
          console.warn('Vision API failed, falling back to legacy OCR:', visionResult.reason);
          const text = await extractTextFromImage(file.path);
          const parsedData = parseExpenseData(text);
          const title = generateTitle(text, parsedData.items);
          const category = detectCategory(text);

          expenseData = [{
            title: title || 'Receipt',
            amount: parsedData.amount || 0,
            category: category,
            date: parsedData.date ? new Date(parsedData.date) : new Date(),
            description: parsedData.items.map(item => `${item.name}: $${item.price}`).join('\n'),
            rawText: parsedData.rawText,
            imagePath: file.path,
            aiProcessed: false
          }];
        }

        // Process each expense item for duplicates
        for (const expense of expenseData) {
          const duplicate = await checkDuplicate(req.user.id, expense);
          
          processedExpenses.push({
            ...expense,
            isDuplicate: !!duplicate,
            duplicateId: duplicate?._id,
            fileName: file.originalname,
            fileIndex: req.files.indexOf(file)
          });
        }

        // Clean up processed image if it exists
        const processedImagePath = file.path.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '_processed.png');
        try {
          await fs.unlink(processedImagePath);
        } catch (err) {
          // Ignore if file doesn't exist
        }

      } catch (error) {
        console.error(`Error processing ${file.originalname}:`, error);
        errors.push({
          fileName: file.originalname,
          error: error.message
        });
        
        // Clean up uploaded file on error
        try {
          await fs.unlink(file.path);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }

    res.json({
      success: true,
      message: `Processed ${processedExpenses.length} of ${req.files.length} images`,
      expenses: processedExpenses,
      errors: errors,
      aiEnabled: true
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error processing images', error: error.message });
  }
});

// @route   POST /api/ocr/save
// @desc    Save reviewed and edited expenses
// @access  Private
router.post('/save', auth, async (req, res) => {
  try {
    const { expenses } = req.body;

    if (!expenses || !Array.isArray(expenses)) {
      return res.status(400).json({ message: 'Invalid expenses data' });
    }

    const savedExpenses = [];
    const skipped = [];

    for (const expenseData of expenses) {
      // Skip if marked to ignore
      if (expenseData.ignore) {
        skipped.push(expenseData);
        
        // Clean up image file
        if (expenseData.imagePath) {
          try {
            await fs.unlink(expenseData.imagePath);
          } catch (err) {
            // Ignore cleanup errors
          }
        }
        continue;
      }

      // Check if it's a confirmed duplicate
      if (expenseData.isDuplicate && !expenseData.saveDuplicate) {
        skipped.push(expenseData);
        
        // Clean up image file
        if (expenseData.imagePath) {
          try {
            await fs.unlink(expenseData.imagePath);
          } catch (err) {
            // Ignore cleanup errors
          }
        }
        continue;
      }

      // Create new expense
      const newExpense = new Expense({
        user: req.user.id,
        title: expenseData.title,
        amount: expenseData.amount,
        category: expenseData.category,
        date: expenseData.date,
        description: expenseData.description || expenseData.rawText
      });

      await newExpense.save();
      savedExpenses.push(newExpense);

      // Clean up image file after saving
      if (expenseData.imagePath) {
        try {
          await fs.unlink(expenseData.imagePath);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }

    res.json({
      success: true,
      message: `Saved ${savedExpenses.length} expenses, skipped ${skipped.length}`,
      savedExpenses,
      skipped
    });

  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ message: 'Error saving expenses', error: error.message });
  }
});

// @route   DELETE /api/ocr/cleanup/:filename
// @desc    Clean up uploaded image if user cancels
// @access  Private
router.delete('/cleanup/:filename', auth, async (req, res) => {
  try {
    const filePath = path.join(uploadsDir, req.params.filename);
    await fs.unlink(filePath);
    res.json({ message: 'File cleaned up' });
  } catch (error) {
    res.status(500).json({ message: 'Error cleaning up file' });
  }
});

// GET /api/ocr/processed - retrieve recent OpenAI processed results for the user
router.get('/processed', auth, async (req, res) => {
  try {
    const items = await ProcessedData.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, items });
  } catch (err) {
    console.error('Error fetching processed data', err);
    res.status(500).json({ success: false, message: 'Error fetching processed data' });
  }
});

module.exports = router;

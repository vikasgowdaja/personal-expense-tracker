const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { execFile } = require('child_process');
const path = require('path');

// Process image with OCR
async function extractTextFromImage(imagePath) {
  try {
    // Try Python-based preprocessing + pytesseract if available
    const pythonScript = path.join(__dirname, 'python_ocr.py');
    const pythonCmd = process.env.PYTHON || 'python';

    try {
      const stdout = await new Promise((resolve, reject) => {
        execFile(pythonCmd, [pythonScript, imagePath], { timeout: 30000 }, (err, stdout, stderr) => {
          if (err) return reject(err);
          resolve(stdout);
        });
      });

      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch (e) {
        parsed = { text: stdout };
      }

      if (parsed && parsed.text) {
        return parsed.text;
      }
      // If python returned error, fall through to JS-based OCR
      console.warn('Python OCR failed or returned no text, falling back to tesseract.js', parsed.error || '');
    } catch (pyErr) {
      console.warn('Python OCR not available or failed:', pyErr.message || pyErr);
    }

    // Fallback: Optimize image for OCR using sharp and tesseract.js
    const processedImagePath = imagePath.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '_processed.png');
    await sharp(imagePath)
      .greyscale()
      .normalize()
      .sharpen()
      .toFile(processedImagePath);

    const { data: { text } } = await Tesseract.recognize(
      processedImagePath,
      'eng',
      {
        logger: info => console.log(info)
      }
    );

    return text;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Failed to extract text from image');
  }
}

// Parse expense data from extracted text
function parseExpenseData(text) {
  const lines = text.split('\n').filter(line => line.trim());
  
  // Common patterns for receipts
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g,
    /(\w{3}\s+\d{1,2},?\s+\d{4})/gi
  ];
  
  const pricePatterns = [
    /[₹$¥€£]?\s*(\d[\d,\.\s]*)/g,
    /total[:\s]*[₹$¥€£]?\s*(\d[\d,\.\s]*)/gi,
    /amount[:\s]*[₹$¥€£]?\s*(\d[\d,\.\s]*)/gi
  ];

  let extractedData = {
    date: null,
    amount: null,
    items: [],
    rawText: text
  };

  // Extract date
  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      extractedData.date = dateMatch[0];
      break;
    }
  }

  // Extract prices (collect all amounts found)
  const prices = [];
  for (const pattern of pricePatterns) {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      const raw = match[1];
      const parsed = parseNumber(raw);
      if (parsed > 0) prices.push(parsed);
    });
  }

  // Do not collapse to a single highest amount here; keep per-line items instead
  if (prices.length > 0) {
    extractedData.amount = null;
  }

  // Helper: parse numeric strings with commas/dots (handles Indian grouping)
  function parseNumber(str) {
    if (!str) return 0;
    let s = String(str).trim();
    // Remove currency symbols and stray characters
    s = s.replace(/[₹$¥€£#:\s]/g, '');
    // If both comma and dot present, assume comma is thousand separator
    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
      s = s.replace(/,/g, '');
    } else if (s.indexOf(',') !== -1 && s.indexOf('.') === -1) {
      // Only commas present: assume comma is decimal separator OR Indian grouping. Try to normalize:
      // If there are groups of two after the first group (Indian format), remove commas.
      const parts = s.split(',');
      if (parts.length > 1 && parts[parts.length - 1].length === 2) {
        // likely decimal cents e.g., 500,00 -> 500.00
        s = s.replace(/,(?=\d{2}$)/, '.');
        s = s.replace(/,/g, '');
      } else {
        // remove commas
        s = s.replace(/,/g, '');
      }
    }
    // Remove any non digit or dot
    s = s.replace(/[^0-9.\-]/g, '');
    const f = parseFloat(s);
    return Number.isFinite(f) ? f : 0;
  }

  // Extract item descriptions (lines with amounts) and associate nearby timestamps
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line looks like a timestamp/date-only (no amount)
    const dateOnlyMatch = line.match(/(^|\s)(\d{1,2}(?:st|nd|rd|th)?\s+\w{3,9}(?:\s+\d{4})?\s*\d{0,2}:?\d{0,2}\s*(?:am|pm)?)$/i);
    const timeOnlyMatch = line.match(/(^|\s)(\d{1,2}:\d{2}\s*(?:am|pm)?)(\s|$)/i);

    // Find amounts in the line
    const amtMatches = [...line.matchAll(/[₹$¥€£]?\s*(\d[0-9,\.\s]*)/g)];

    if (amtMatches.length > 0) {
      // Line contains an amount -> create an item
      const rawAmt = amtMatches[amtMatches.length - 1][1];
      const price = parseNumber(rawAmt);
      let name = line.replace(/[₹$¥€£]?\s*[0-9][0-9,\.\s]*[0-9]/g, '').trim();
      name = name.replace(/[:\-#]+$/, '').trim();
      if (!name || name.length < 1) name = 'Item';

      // Attempt to parse date/time from the same line
      let itemDate = null;
      try {
        const dayMonthTime = line.match(/(\d{1,2}(?:st|nd|rd|th)?\s+\w{3,9}\s+\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
        const dayMonth = line.match(/(\d{1,2}(?:st|nd|rd|th)?\s+\w{3,9})/i);
        const timeOnly = line.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
        const now = new Date();
        if (dayMonthTime) {
          const dm = dayMonthTime[1].replace(/(st|nd|rd|th)/i, '');
          const parts = dm.split(/\s+/);
          const year = now.getFullYear();
          const normalized = `${parts[0]} ${parts[1]} ${year} ${parts.slice(2).join(' ')}`;
          const parsed = Date.parse(normalized);
          if (!Number.isNaN(parsed)) itemDate = new Date(parsed).toISOString().split('T')[0];
        } else if (dayMonth) {
          const dm = dayMonth[1].replace(/(st|nd|rd|th)/i, '');
          const year = now.getFullYear();
          const parsed = Date.parse(`${dm} ${year}`);
          if (!Number.isNaN(parsed)) itemDate = new Date(parsed).toISOString().split('T')[0];
        } else if (timeOnly) {
          const timeStr = timeOnly[1];
          const base = extractedData.date ? extractedData.date : now.toISOString().split('T')[0];
          const parsed = Date.parse(`${base} ${timeStr}`);
          if (!Number.isNaN(parsed)) itemDate = new Date(parsed).toISOString().split('T')[0];
        }
      } catch (e) {
        // ignore
      }

      extractedData.items.push({ name, price, rawLine: line, date: itemDate });

    } else if (dateOnlyMatch || timeOnlyMatch) {
      // Line contains only a date/time; attach to previous item if present
      const last = extractedData.items[extractedData.items.length - 1];
      if (last) {
        // parse same as above
        let itemDate = null;
        try {
          const dmTime = line.match(/(\d{1,2}(?:st|nd|rd|th)?\s+\w{3,9}\s+\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
          const dm = line.match(/(\d{1,2}(?:st|nd|rd|th)?\s+\w{3,9})/i);
          const to = line.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
          const now = new Date();
          if (dmTime) {
            const s = dmTime[1].replace(/(st|nd|rd|th)/i, '');
            const parts = s.split(/\s+/);
            const year = now.getFullYear();
            const parsed = Date.parse(`${parts[0]} ${parts[1]} ${year} ${parts.slice(2).join(' ')}`);
            if (!Number.isNaN(parsed)) itemDate = new Date(parsed).toISOString().split('T')[0];
          } else if (dm) {
            const s = dm[1].replace(/(st|nd|rd|th)/i, '');
            const year = now.getFullYear();
            const parsed = Date.parse(`${s} ${year}`);
            if (!Number.isNaN(parsed)) itemDate = new Date(parsed).toISOString().split('T')[0];
          } else if (to) {
            const base = extractedData.date ? extractedData.date : new Date().toISOString().split('T')[0];
            const parsed = Date.parse(`${base} ${to[1]}`);
            if (!Number.isNaN(parsed)) itemDate = new Date(parsed).toISOString().split('T')[0];
          }
        } catch (e) {}

        if (itemDate) last.date = itemDate;
      }
    }
  }

  return extractedData;
}

// Detect potential category based on text content
function detectCategory(text) {
  const textLower = text.toLowerCase();
  
  const categoryKeywords = {
    'Food': ['restaurant', 'cafe', 'food', 'grocery', 'supermarket', 'dinner', 'lunch', 'breakfast', 'pizza', 'burger'],
    'Transport': ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'metro', 'bus', 'train'],
    'Entertainment': ['movie', 'cinema', 'theater', 'concert', 'game', 'netflix', 'spotify'],
    'Shopping': ['store', 'mall', 'shop', 'amazon', 'ebay', 'retail'],
    'Bills': ['electric', 'water', 'internet', 'phone', 'utility', 'bill'],
    'Healthcare': ['pharmacy', 'hospital', 'doctor', 'medical', 'clinic', 'health']
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        return category;
      }
    }
  }

  return 'Other';
}

// Generate a title from extracted text
function generateTitle(text, items) {
  const lines = text.split('\n').filter(line => line.trim() && line.length < 50);
  
  // Try to find merchant name (usually first few lines)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length > 3 && line.length < 40 && !line.match(/^\d+$/)) {
      return line;
    }
  }

  // Fallback to first item name
  if (items && items.length > 0) {
    return items[0].name;
  }

  return 'Receipt';
}

module.exports = {
  extractTextFromImage,
  parseExpenseData,
  detectCategory,
  generateTitle
};

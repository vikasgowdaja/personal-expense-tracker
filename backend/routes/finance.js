const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const CreditCard = require('../models/CreditCard');
const CashAccount = require('../models/CashAccount');
const RawImage = require('../models/RawImage');

const router = express.Router();

const FINANCE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'finance');
fs.mkdirSync(FINANCE_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FINANCE_UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});

const financeUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if ((file.mimetype || '').startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

function normalizeExtractedTransaction(txn = {}, imageUrl = null) {
  const rawAmount = Number(txn.amount || 0);
  const normalizedAmount = Number.isFinite(rawAmount) ? Math.max(rawAmount, 0) : 0;
  const txnDate = txn.date ? new Date(txn.date) : new Date();

  return {
    date: Number.isNaN(txnDate.getTime()) ? new Date() : txnDate,
    payee: String(txn.payee || 'Unknown').trim() || 'Unknown',
    amount: normalizedAmount,
    note: txn.note || null,
    category: txn.category || 'Uncategorised',
    paymentMethod: ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Other'].includes(txn.payment_method)
      ? txn.payment_method
      : (['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Other'].includes(txn.paymentMethod) ? txn.paymentMethod : 'Other'),
    app: ['Kiwi', 'PhonePe', 'GPay', 'CRED', 'Paytm', 'Other'].includes(txn.app) ? txn.app : null,
    bank: txn.bank || null,
    cardLast4: txn.card_last4 || txn.cardLast4 || null,
    transactionId: txn.transaction_id || txn.transactionId || null,
    confidence: Math.max(0, Math.min(1, Number(txn.confidence || 0.7))),
    source: 'image',
    imageUrl
  };
}

async function callFinanceAiExtractor(filePath, fileName) {
  const endpoint = `${process.env.FINANCE_AI_URL || 'http://localhost:8001'}/extract`;
  const imageBuffer = await fs.promises.readFile(filePath);

  const form = new FormData();
  form.append('file', new Blob([imageBuffer]), fileName);

  const response = await fetch(endpoint, { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(`AI extract failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('AI extract response must be a JSON array');
  }
  return payload;
}

function buildUserScopedFilter(req, extra = {}) {
  return { ...extra, userId: req.user.id };
}

router.post('/upload', auth, financeUpload.array('images', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    const shouldAutoSave = String(req.query.autoSave || 'false').toLowerCase() === 'true';
    const reviewItems = [];
    const savedTransactions = [];
    const errors = [];

    for (const file of req.files) {
      const imageRecord = await RawImage.create({
        userId: req.user.id,
        s3Key: file.path,
        originalName: file.originalname,
        processingStatus: 'processing'
      });

      try {
        const extracted = await callFinanceAiExtractor(file.path, file.originalname);
        const normalized = extracted.map((txn) => normalizeExtractedTransaction(txn, file.path));

        if (shouldAutoSave && normalized.length > 0) {
          const docs = await Transaction.insertMany(
            normalized.map((txn) => ({ ...txn, userId: req.user.id })),
            { ordered: false }
          );

          imageRecord.extractedTransactionIds = docs.map((d) => d._id);
          imageRecord.processingStatus = 'done';
          await imageRecord.save();

          savedTransactions.push(...docs);
        } else {
          imageRecord.processingStatus = 'pending';
          await imageRecord.save();

          reviewItems.push({
            rawImageId: imageRecord._id,
            imageUrl: file.path,
            originalName: file.originalname,
            transactions: normalized
          });
        }
      } catch (error) {
        imageRecord.processingStatus = 'failed';
        await imageRecord.save();
        errors.push({ fileName: file.originalname, message: error.message });
      }
    }

    return res.json({
      success: true,
      autoSaved: shouldAutoSave,
      reviewItems,
      transactions: savedTransactions,
      errors
    });
  } catch (error) {
    return res.status(500).json({ message: 'Finance upload failed', error: error.message });
  }
});

router.get('/transactions', auth, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 200);
    const skip = (page - 1) * limit;

    const filter = buildUserScopedFilter(req, { isDeleted: false });
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(filter)
    ]);

    res.json({
      data: transactions,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch transactions', error: error.message });
  }
});

router.post('/transactions', auth, async (req, res) => {
  try {
    const normalized = normalizeExtractedTransaction(req.body, req.body.imageUrl || null);
    const created = await Transaction.create({
      ...normalized,
      ...req.body,
      userId: req.user.id,
      source: req.body.source || 'manual',
      paymentMethod: normalized.paymentMethod
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: 'Could not create transaction', error: error.message });
  }
});

router.post('/transactions/bulk', auth, async (req, res) => {
  try {
    const transactions = Array.isArray(req.body.transactions) ? req.body.transactions : [];
    const rawImageIds = Array.isArray(req.body.rawImageIds) ? req.body.rawImageIds : [];

    if (transactions.length === 0) {
      return res.status(400).json({ message: 'No transactions provided for bulk save' });
    }

    const docs = await Transaction.insertMany(
      transactions.map((txn) => ({
        ...normalizeExtractedTransaction(txn, txn.imageUrl || null),
        ...txn,
        userId: req.user.id,
        source: txn.source || 'image'
      }))
    );

    if (rawImageIds.length > 0) {
      await RawImage.updateMany(
        { _id: { $in: rawImageIds }, userId: req.user.id },
        { $set: { processingStatus: 'done' }, $push: { extractedTransactionIds: { $each: docs.map((d) => d._id) } } }
      );
    }

    return res.status(201).json({ success: true, transactions: docs });
  } catch (error) {
    return res.status(500).json({ message: 'Bulk save failed', error: error.message });
  }
});

router.put('/transactions/:id', auth, async (req, res) => {
  try {
    const existing = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });
    if (!existing) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const allowedFields = [
      'date', 'payee', 'amount', 'note', 'category', 'paymentMethod', 'app',
      'bank', 'cardLast4', 'transactionId', 'confidence', 'source', 'imageUrl'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        existing[field] = req.body[field];
      }
    }

    await existing.save();
    return res.json(existing);
  } catch (error) {
    return res.status(500).json({ message: 'Could not update transaction', error: error.message });
  }
});

router.delete('/transactions/:id', auth, async (req, res) => {
  try {
    const updated = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    return res.json({ success: true, transaction: updated });
  } catch (error) {
    return res.status(500).json({ message: 'Could not delete transaction', error: error.message });
  }
});

router.post('/cash', auth, async (req, res) => {
  try {
    const totalCashGiven = Math.max(Number(req.body.totalCashGiven || 0), 0);
    const account = await CashAccount.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { totalCashGiven } },
      { new: true, upsert: true }
    );
    return res.json(account);
  } catch (error) {
    return res.status(500).json({ message: 'Could not update cash account', error: error.message });
  }
});

router.post('/credit-card', auth, async (req, res) => {
  try {
    const payload = {
      userId: req.user.id,
      bank: req.body.bank,
      last4: req.body.last4,
      amountDue: Number(req.body.amountDue || 0),
      status: req.body.status === 'paid' ? 'paid' : 'due',
      statementDate: req.body.statementDate || Date.now()
    };

    const created = await CreditCard.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ message: 'Could not add credit card due', error: error.message });
  }
});

router.put('/credit-card/:id', auth, async (req, res) => {
  try {
    const updated = await CreditCard.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        $set: {
          bank: req.body.bank,
          last4: req.body.last4,
          amountDue: req.body.amountDue,
          status: req.body.status,
          statementDate: req.body.statementDate
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Credit card record not found' });
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Could not update credit card due', error: error.message });
  }
});

router.get('/summary', auth, async (req, res) => {
  try {
    const filter = buildUserScopedFilter(req, { isDeleted: false });
    const [transactions, cashAccount, creditCards] = await Promise.all([
      Transaction.find(filter).sort({ date: -1 }),
      CashAccount.findOne({ userId: req.user.id }),
      CreditCard.find({ userId: req.user.id }).sort({ statementDate: -1 })
    ]);

    const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalCashGiven = Number(cashAccount?.totalCashGiven || 0);
    const balance = totalCashGiven - totalSpent;

    const byCategory = transactions.reduce((acc, txn) => {
      const category = txn.category || 'Uncategorised';
      acc[category] = (acc[category] || 0) + Number(txn.amount || 0);
      return acc;
    }, {});

    const byDate = transactions.reduce((acc, txn) => {
      const key = new Date(txn.date).toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + Number(txn.amount || 0);
      return acc;
    }, {});

    const cardDues = creditCards
      .filter((card) => card.status === 'due')
      .map((card) => ({
        id: card._id,
        bank: card.bank,
        last4: card.last4,
        amountDue: card.amountDue,
        status: card.status,
        statementDate: card.statementDate
      }));

    return res.json({
      totalSpent,
      totalCashGiven,
      balance,
      transactionsCount: transactions.length,
      byCategory,
      byDate,
      cardDues
    });
  } catch (error) {
    return res.status(500).json({ message: 'Could not build summary', error: error.message });
  }
});

router.get('/export/pdf', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find(buildUserScopedFilter(req, { isDeleted: false })).sort({ date: -1 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="finance-ledger-${Date.now()}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(18).text('Finance Ledger Report', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-IN')}`);
    doc.moveDown(1);

    doc.fillColor('#000').fontSize(11).text('Date', 40).text('Payee', 120).text('Method', 290).text('Category', 380).text('Amount', 490);
    doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).stroke('#ddd');
    doc.moveDown(0.4);

    transactions.forEach((txn) => {
      const date = new Date(txn.date).toLocaleDateString('en-IN');
      const payee = String(txn.payee || '').slice(0, 24);
      const method = String(txn.paymentMethod || '').slice(0, 14);
      const category = String(txn.category || '').slice(0, 14);
      const amount = `INR ${Number(txn.amount || 0).toFixed(2)}`;

      doc.fontSize(10)
        .text(date, 40)
        .text(payee, 120)
        .text(method, 290)
        .text(category, 380)
        .text(amount, 490);

      if (doc.y > 760) {
        doc.addPage();
      }
    });

    doc.end();
  } catch (error) {
    return res.status(500).json({ message: 'PDF export failed', error: error.message });
  }
});

router.get('/export/excel', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find(buildUserScopedFilter(req, { isDeleted: false })).sort({ date: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ledger');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Payee', key: 'payee', width: 24 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Note', key: 'note', width: 30 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Payment Method', key: 'paymentMethod', width: 18 },
      { header: 'App', key: 'app', width: 12 },
      { header: 'Bank', key: 'bank', width: 18 },
      { header: 'Card Last4', key: 'cardLast4', width: 12 },
      { header: 'Transaction ID', key: 'transactionId', width: 24 },
      { header: 'Source', key: 'source', width: 10 },
      { header: 'Confidence', key: 'confidence', width: 12 }
    ];

    transactions.forEach((txn) => {
      worksheet.addRow({
        date: new Date(txn.date).toISOString().slice(0, 10),
        payee: txn.payee,
        amount: txn.amount,
        note: txn.note || '',
        category: txn.category || 'Uncategorised',
        paymentMethod: txn.paymentMethod || 'Other',
        app: txn.app || '',
        bank: txn.bank || '',
        cardLast4: txn.cardLast4 || '',
        transactionId: txn.transactionId || '',
        source: txn.source,
        confidence: txn.confidence
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="finance-ledger-${Date.now()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    return res.status(500).json({ message: 'Excel export failed', error: error.message });
  }
});

module.exports = router;

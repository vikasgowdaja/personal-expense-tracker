const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const TrainingEngagement = require('../models/TrainingEngagement');

const router = express.Router();

async function generateInvoiceNumber(userId, year) {
  const prefix = `INV-${year}-`;
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  const invoices = await Invoice.find({ user: userId, invoiceNumber: { $regex: `^${prefix}` } }).select('invoiceNumber');

  let max = 0;
  invoices.forEach((inv) => {
    const match = inv.invoiceNumber.match(regex);
    if (!match) return;
    const seq = Number(match[1]);
    if (seq > max) max = seq;
  });

  const next = String(max + 1).padStart(3, '0');
  return `${prefix}${next}`;
}

router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user.id })
      .populate({
        path: 'trainingEngagementId',
        populate: [
          { path: 'trainerId', select: 'fullName' },
          { path: 'institutionId', select: 'name' },
          { path: 'clientId', select: 'name' }
        ]
      })
      .sort({ invoiceDate: -1, createdAt: -1 });

    res.json(invoices);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.post(
  '/',
  [
    auth,
    [
      body('trainingEngagementId', 'trainingEngagementId is required').not().isEmpty(),
      body('invoiceDate', 'invoiceDate is required').optional().isISO8601(),
      body('dueDate', 'dueDate is required').isISO8601(),
      body('taxAmount', 'taxAmount must be >= 0').optional().isFloat({ min: 0 })
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const engagement = await TrainingEngagement.findOne({
        _id: req.body.trainingEngagementId,
        user: req.user.id
      });

      if (!engagement) {
        return res.status(404).json({ message: 'Training engagement not found' });
      }

      const invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date();
      const year = invoiceDate.getFullYear();
      const invoiceNumber = await generateInvoiceNumber(req.user.id, year);

      const subtotal = engagement.totalAmount;
      const taxAmount = Number(req.body.taxAmount || 0);
      const totalDue = subtotal + taxAmount;

      const invoice = new Invoice({
        user: req.user.id,
        invoiceNumber,
        trainingEngagementId: engagement._id,
        invoiceDate,
        dueDate: req.body.dueDate,
        paymentTerms: req.body.paymentTerms || 'Net 15',
        subtotal,
        taxAmount,
        totalDue,
        status: req.body.status || 'Draft'
      });

      const saved = await invoice.save();
      if (engagement.status !== 'Paid') {
        engagement.status = 'Invoiced';
        await engagement.save();
      }

      res.json(saved);
    } catch (err) {
      console.error(err.message);
      res.status(400).json({ message: err.message || 'Unable to generate invoice' });
    }
  }
);

router.put('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const allowed = ['invoiceDate', 'dueDate', 'paymentTerms', 'taxAmount', 'status'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        invoice[field] = req.body[field];
      }
    });

    invoice.totalDue = Number(invoice.subtotal || 0) + Number(invoice.taxAmount || 0);
    const saved = await invoice.save();

    if (req.body.status === 'Paid') {
      const engagement = await TrainingEngagement.findOne({ _id: invoice.trainingEngagementId, user: req.user.id });
      if (engagement) {
        engagement.status = 'Paid';
        await engagement.save();
      }
    }

    res.json(saved);
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ message: err.message || 'Unable to update invoice' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({ message: 'Invoice removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
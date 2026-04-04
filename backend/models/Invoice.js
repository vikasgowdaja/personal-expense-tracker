const mongoose = require('mongoose');

const INVOICE_STATUS = ['Draft', 'Sent', 'Paid', 'Overdue'];

const invoiceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    trim: true
  },
  trainingEngagementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainingEngagement',
    required: true
  },
  invoiceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  paymentTerms: {
    type: String,
    trim: true,
    default: 'Net 15'
  },
  subtotal: {
    type: Number,
    min: 0,
    required: true,
    default: 0
  },
  taxAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  totalDue: {
    type: Number,
    min: 0,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: INVOICE_STATUS,
    default: 'Draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

invoiceSchema.index({ user: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
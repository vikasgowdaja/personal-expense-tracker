const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    payee: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    note: {
      type: String,
      default: null
    },
    category: {
      type: String,
      default: 'Uncategorised',
      trim: true
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Other'],
      default: 'Other'
    },
    app: {
      type: String,
      enum: ['Kiwi', 'PhonePe', 'GPay', 'CRED', 'Paytm', 'Other', null],
      default: null
    },
    bank: {
      type: String,
      default: null
    },
    cardLast4: {
      type: String,
      default: null
    },
    transactionId: {
      type: String,
      default: null
    },
    source: {
      type: String,
      enum: ['image', 'manual'],
      default: 'manual'
    },
    imageUrl: {
      type: String,
      default: null
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);

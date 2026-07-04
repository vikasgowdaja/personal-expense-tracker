const mongoose = require('mongoose');

const CreditCardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    bank: {
      type: String,
      required: true,
      trim: true
    },
    last4: {
      type: String,
      required: true,
      trim: true
    },
    amountDue: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['due', 'paid'],
      default: 'due'
    },
    statementDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

CreditCardSchema.index({ userId: 1, status: 1, statementDate: -1 });

module.exports = mongoose.model('CreditCard', CreditCardSchema);

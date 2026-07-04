const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Other']
  },
  entryType: {
    type: String,
    enum: ['expense', 'debt', 'credit_card_bill'],
    default: 'expense'
  },
  expenseScope: {
    type: String,
    enum: [
      'general',
      'trainer_settlement',
      'trainer_hotel',
      'trainer_food',
      'trainer_travel',
      'trainer_other'
    ],
    default: 'general'
  },
  paymentState: {
    type: String,
    enum: ['pending', 'partially_paid', 'paid'],
    default: 'paid'
  },
  dueDate: {
    type: Date
  },
  paidDate: {
    type: Date
  },
  outstandingAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  linkedEngagementId: {
    type: String,
    trim: true
  },
  linkedTrainerName: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Expense', expenseSchema);

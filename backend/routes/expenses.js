const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');

function isPlatformOwner(req) {
  return req.user?.role === 'platform_owner';
}

function buildExpenseQuery(req, filters = {}) {
  return isPlatformOwner(req) ? filters : { ...filters, user: req.user.id };
}

// @route   GET /api/expenses
// @desc    Get all expenses for logged in user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const expenses = await Expense.find(buildExpenseQuery(req)).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/expenses/:id
// @desc    Get expense by id
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Make sure user owns expense
    if (!isPlatformOwner(req) && expense.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(expense);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   POST /api/expenses
// @desc    Add new expense
// @access  Private
router.post('/', [auth, [
  body('title', 'Title is required').not().isEmpty(),
  body('amount', 'Amount must be a positive number').isFloat({ min: 0 }),
  body('category', 'Category is required').not().isEmpty()
]], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    title,
    amount,
    category,
    date,
    description,
    entryType,
    expenseScope,
    paymentState,
    dueDate,
    paidDate,
    outstandingAmount,
    linkedEngagementId,
    linkedTrainerName,
    paymentMethod
  } = req.body;

  try {
    const newExpense = new Expense({
      user: req.user.id,
      title,
      amount,
      category,
      date: date || Date.now(),
      description,
      entryType: entryType || 'expense',
      expenseScope: expenseScope || 'general',
      paymentState: paymentState || 'paid',
      dueDate: dueDate || undefined,
      paidDate: paidDate || undefined,
      outstandingAmount: Number(outstandingAmount || 0),
      linkedEngagementId,
      linkedTrainerName,
      paymentMethod
    });

    const expense = await newExpense.save();
    res.json(expense);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const {
    title,
    amount,
    category,
    date,
    description,
    entryType,
    expenseScope,
    paymentState,
    dueDate,
    paidDate,
    outstandingAmount,
    linkedEngagementId,
    linkedTrainerName,
    paymentMethod
  } = req.body;

  // Build expense object
  const expenseFields = {};
  if (title !== undefined) expenseFields.title = title;
  if (amount !== undefined) expenseFields.amount = amount;
  if (category !== undefined) expenseFields.category = category;
  if (date !== undefined) expenseFields.date = date;
  if (description !== undefined) expenseFields.description = description;
  if (entryType !== undefined) expenseFields.entryType = entryType;
  if (expenseScope !== undefined) expenseFields.expenseScope = expenseScope;
  if (paymentState !== undefined) expenseFields.paymentState = paymentState;
  if (dueDate !== undefined) expenseFields.dueDate = dueDate || null;
  if (paidDate !== undefined) expenseFields.paidDate = paidDate || null;
  if (outstandingAmount !== undefined) expenseFields.outstandingAmount = Number(outstandingAmount || 0);
  if (linkedEngagementId !== undefined) expenseFields.linkedEngagementId = linkedEngagementId;
  if (linkedTrainerName !== undefined) expenseFields.linkedTrainerName = linkedTrainerName;
  if (paymentMethod !== undefined) expenseFields.paymentMethod = paymentMethod;

  try {
    let expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Make sure user owns expense
    if (!isPlatformOwner(req) && expense.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { $set: expenseFields },
      { new: true }
    );

    res.json(expense);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    let expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Make sure user owns expense
    if (!isPlatformOwner(req) && expense.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Expense.findByIdAndDelete(req.params.id);

    res.json({ message: 'Expense removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   GET /api/expenses/stats/summary
// @desc    Get expense statistics
// @access  Private
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const expenses = await Expense.find(buildExpenseQuery(req));
    
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    const byCategory = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

    res.json({
      total,
      count: expenses.length,
      byCategory
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;

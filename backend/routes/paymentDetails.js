const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const PaymentDetails = require('../models/PaymentDetails');
const Trainer = require('../models/Trainer');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const rows = await PaymentDetails.find({ user: req.user.id })
      .populate('trainerId', 'fullName email')
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.post(
  '/',
  [auth, [body('trainerId', 'trainerId is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const trainer = await Trainer.findOne({ _id: req.body.trainerId, user: req.user.id });
      if (!trainer) {
        return res.status(404).json({ message: 'Trainer not found' });
      }

      const payload = {
        user: req.user.id,
        trainerId: req.body.trainerId,
        bankName: req.body.bankName,
        accountNumber: req.body.accountNumber,
        ifscCode: req.body.ifscCode,
        upiId: req.body.upiId,
        panNumber: req.body.panNumber
      };

      const row = await PaymentDetails.findOneAndUpdate(
        { user: req.user.id, trainerId: req.body.trainerId },
        { $set: payload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      res.json(row);
    } catch (err) {
      console.error(err.message);
      res.status(400).json({ message: err.message || 'Unable to save payment details' });
    }
  }
);

router.delete('/:id', auth, async (req, res) => {
  try {
    const row = await PaymentDetails.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!row) {
      return res.status(404).json({ message: 'Payment details not found' });
    }

    res.json({ message: 'Payment details removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
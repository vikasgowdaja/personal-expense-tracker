const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Institution = require('../models/Institution');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const institutions = await Institution.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(institutions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.post(
  '/',
  [auth, [body('name', 'Institution name is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const institution = new Institution({
        user: req.user.id,
        name: req.body.name,
        location: req.body.location,
        contactPerson: req.body.contactPerson,
        contactEmail: req.body.contactEmail,
        contactPhone: req.body.contactPhone
      });
      const saved = await institution.save();
      res.json(saved);
    } catch (err) {
      console.error(err.message);
      if (err.code === 11000) {
        return res.status(400).json({ message: 'Institution already exists' });
      }
      res.status(500).send('Server error');
    }
  }
);

router.put('/:id', auth, async (req, res) => {
  try {
    const institution = await Institution.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: req.body },
      { new: true }
    );

    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    res.json(institution);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const institution = await Institution.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }
    res.json({ message: 'Institution removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
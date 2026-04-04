const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const TrainingEngagement = require('../models/TrainingEngagement');

const router = express.Router();

const STATUS_FLOW = ['Planned', 'Ongoing', 'Completed', 'Invoiced', 'Paid'];

// ── GET all engagements for the current user ──
router.get('/', auth, async (req, res) => {
  try {
    const query = { user: req.user.id };
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.institutionId) {
      query.institutionId = req.query.institutionId;
    }
    if (req.query.clientId) {
      query.clientId = req.query.clientId;
    }

    const rows = await TrainingEngagement.find(query)
      .populate('institutionId', 'name location')
      .populate('clientId', 'name email')
      .populate('trainers.trainerId', 'fullName email phone specialization yearsOfExperience')
      .sort({ startDate: -1, createdAt: -1 });

    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// ── GET single engagement ──
router.get('/:id', auth, async (req, res) => {
  try {
    const row = await TrainingEngagement.findOne({ _id: req.params.id, user: req.user.id })
      .populate('institutionId', 'name location contactPerson contactEmail contactPhone')
      .populate('clientId', 'name contactPerson email phone billingAddress')
      .populate('trainers.trainerId', 'fullName email phone yearsOfExperience specialization');

    if (!row) {
      return res.status(404).json({ message: 'Training engagement not found' });
    }

    res.json(row);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// ── POST create engagement ──
router.post(
  '/',
  [
    auth,
    [
      body('institutionId', 'institutionId is required').not().isEmpty(),
      body('clientId', 'clientId is required').not().isEmpty(),
      body('startDate', 'startDate is required').isISO8601(),
      body('endDate', 'endDate is required').isISO8601(),
      body('trainers', 'At least one trainer assignment is required').isArray({ min: 1 }),
      body('trainers.*.trainerId', 'Each trainer assignment must have a trainerId').not().isEmpty(),
      body('trainers.*.dailyRate', 'Each trainer dailyRate must be >= 0').isFloat({ min: 0 })
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const row = new TrainingEngagement({
        user: req.user.id,
        institutionId: req.body.institutionId,
        clientId: req.body.clientId,
        engagementTitle: req.body.engagementTitle || '',
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        trainers: (req.body.trainers || []).map((t) => ({
          trainerId: t.trainerId,
          subjectArea: t.subjectArea || '',
          trainingTopic: t.trainingTopic || '',
          dailyRate: Number(t.dailyRate || 0)
        })),
        status: req.body.status || 'Planned',
        notes: req.body.notes || ''
      });

      const saved = await row.save();
      res.json(saved);
    } catch (err) {
      console.error(err.message);
      res.status(400).json({ message: err.message || 'Invalid training engagement data' });
    }
  }
);

// ── PUT update engagement ──
router.put('/:id', auth, async (req, res) => {
  try {
    const row = await TrainingEngagement.findOne({ _id: req.params.id, user: req.user.id });
    if (!row) {
      return res.status(404).json({ message: 'Training engagement not found' });
    }

    // Enforce forward-only status lifecycle
    if (req.body.status && row.status) {
      const prevIndex = STATUS_FLOW.indexOf(row.status);
      const nextIndex = STATUS_FLOW.indexOf(req.body.status);
      if (prevIndex !== -1 && nextIndex !== -1 && nextIndex < prevIndex) {
        return res.status(400).json({ message: 'Status cannot move backward in lifecycle' });
      }
    }

    const scalarFields = ['institutionId', 'clientId', 'engagementTitle', 'startDate', 'endDate', 'status', 'notes'];
    scalarFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        row[field] = req.body[field];
      }
    });

    // Replace entire trainers array if provided
    if (Array.isArray(req.body.trainers)) {
      row.trainers = req.body.trainers.map((t) => ({
        trainerId: t.trainerId,
        subjectArea: t.subjectArea || '',
        trainingTopic: t.trainingTopic || '',
        dailyRate: Number(t.dailyRate || 0)
      }));
    }

    const saved = await row.save();
    res.json(saved);
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ message: err.message || 'Invalid update request' });
  }
});

// ── DELETE engagement ──
router.delete('/:id', auth, async (req, res) => {
  try {
    const row = await TrainingEngagement.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!row) {
      return res.status(404).json({ message: 'Training engagement not found' });
    }
    res.json({ message: 'Training engagement removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
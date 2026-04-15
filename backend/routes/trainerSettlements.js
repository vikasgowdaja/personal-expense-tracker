const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const TrainerSettlement = require('../models/TrainerSettlement');
const TrainingEngagement = require('../models/TrainingEngagement');
const User = require('../models/User');

const router = express.Router();

async function getUserWithConnections(userId) {
  return User.findById(userId)
    .select('role connections')
    .lean();
}

async function buildSettlementScope(userDoc) {
  if (!userDoc) return { _id: null };

  if (userDoc.role === 'platform_owner') {
    return {};
  }

  if (userDoc.role === 'superadmin') {
    const managedEmployees = await User.find({
      role: 'employee',
      connections: {
        $elemMatch: {
          superadminId: userDoc._id,
          isActive: true
        }
      }
    }).select('_id').lean();

    const employeeIds = managedEmployees.map((e) => e._id);

    return {
      $or: [
        { ownerSuperadminId: userDoc._id },
        { user: userDoc._id },
        ...(employeeIds.length ? [{ user: { $in: employeeIds } }] : [])
      ]
    };
  }

  const activeConnections = (userDoc.connections || []).filter((c) => c.isActive !== false);
  const pairClauses = activeConnections.map((c) => ({
    ownerSuperadminId: c.superadminId,
    connectionId: c.connectionId
  }));

  return {
    $or: [
      { sourcedByUserId: userDoc._id },
      { user: userDoc._id },
      ...pairClauses
    ]
  };
}

function mergeScopeAndFilters(scope, filters) {
  if (!filters || Object.keys(filters).length === 0) return scope;
  return { $and: [scope, filters] };
}

router.get('/', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const filters = {};
    if (req.query.trainingEngagementId) {
      filters.trainingEngagementId = req.query.trainingEngagementId;
    }
    if (req.query.status) {
      filters.status = req.query.status;
    }

    const query = mergeScopeAndFilters(await buildSettlementScope(userDoc), filters);

    const rows = await TrainerSettlement.find(query)
      .sort({ paidDate: -1, createdAt: -1 })
      .lean();

    res.json(rows);
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
      body('amount', 'amount must be >= 0').isFloat({ min: 0 }),
      body('perDayPayment').optional().isFloat({ min: 0 }),
      body('totalDays').optional().isFloat({ min: 0 })
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userDoc = await getUserWithConnections(req.user.id);
      if (!userDoc) {
        return res.status(401).json({ message: 'User not found for scope resolution' });
      }

      const engagementScope = await buildSettlementScope(userDoc);
      const engagement = await TrainingEngagement.findOne(
        mergeScopeAndFilters(engagementScope, { _id: req.body.trainingEngagementId })
      ).lean();

      if (!engagement) {
        return res.status(404).json({ message: 'Training engagement not found in your scope' });
      }

      const row = new TrainerSettlement({
        user: req.user.id,
        ownerSuperadminId: engagement.ownerSuperadminId || req.user.id,
        connectionId: engagement.connectionId || '',
        sourcedByUserId: req.user.id,
        sourcedBy: req.body.sourcedBy || engagement.sourcedBy || '',
        sourcedByName: req.body.sourcedByName || engagement.sourcedByName || '',
        trainingEngagementId: req.body.trainingEngagementId,
        engagementLabel: req.body.engagementLabel || '',
        trainerId: req.body.trainerId || null,
        trainerName: req.body.trainerName || '',
        collegeName: req.body.collegeName || '',
        organizationName: req.body.organizationName || '',
        startDate: req.body.startDate || null,
        endDate: req.body.endDate || null,
        totalDays: Number(req.body.totalDays || 0),
        perDayPayment: Number(req.body.perDayPayment || 0),
        amount: Number(req.body.amount || 0),
        paidDate: req.body.paidDate || new Date().toISOString(),
        status: req.body.status || 'Planned',
        notes: req.body.notes || ''
      });

      const saved = await row.save();
      res.json(saved);
    } catch (err) {
      console.error(err.message);
      res.status(400).json({ message: err.message || 'Invalid trainer settlement data' });
    }
  }
);

router.put('/:id', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const filter = mergeScopeAndFilters(await buildSettlementScope(userDoc), { _id: req.params.id });
    const row = await TrainerSettlement.findOne(filter);
    if (!row) {
      return res.status(404).json({ message: 'Trainer settlement not found' });
    }

    const scalarFields = [
      'engagementLabel',
      'trainerId',
      'trainerName',
      'collegeName',
      'organizationName',
      'startDate',
      'endDate',
      'totalDays',
      'perDayPayment',
      'amount',
      'paidDate',
      'status',
      'notes'
    ];

    scalarFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        row[field] = req.body[field];
      }
    });

    const saved = await row.save();
    res.json(saved);
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ message: err.message || 'Invalid update request' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const filter = mergeScopeAndFilters(await buildSettlementScope(userDoc), { _id: req.params.id });
    const row = await TrainerSettlement.findOneAndDelete(filter);
    if (!row) {
      return res.status(404).json({ message: 'Trainer settlement not found' });
    }

    res.json({ message: 'Trainer settlement removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;

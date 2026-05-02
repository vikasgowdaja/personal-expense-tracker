const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const CycleTrackingRecord = require('../models/CycleTrackingRecord');
const TrainingEngagement = require('../models/TrainingEngagement');
const User = require('../models/User');

const router = express.Router();

function toNumber(value, defaultValue = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function escapeRegex(input) {
  return String(input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mergeScopeAndFilters(scope, filters) {
  if (!filters || Object.keys(filters).length === 0) return scope;
  return { $and: [scope, filters] };
}

async function getUserWithConnections(userId) {
  return User.findById(userId)
    .select('role connections')
    .lean();
}

async function buildCycleScope(userDoc) {
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

async function resolveEngagementInScope(userDoc, trainingEngagementId) {
  if (!trainingEngagementId) return null;
  const engagement = await TrainingEngagement.findOne(
    mergeScopeAndFilters(await buildCycleScope(userDoc), { _id: trainingEngagementId })
  ).lean();
  return engagement;
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

    const trainerName = String(req.query.trainerName || '').trim();
    const collegeName = String(req.query.collegeName || '').trim();
    const organizationName = String(req.query.organizationName || '').trim();
    const orgPaymentStatus = String(req.query.orgPaymentStatus || '').trim();
    const trainerSettlementStatus = String(req.query.trainerSettlementStatus || '').trim();
    const fromDate = String(req.query.fromDate || '').trim();
    const toDate = String(req.query.toDate || '').trim();

    if (trainerName) {
      filters.trainerName = { $regex: `^${escapeRegex(trainerName)}$`, $options: 'i' };
    }
    if (collegeName) {
      filters.collegeName = { $regex: `^${escapeRegex(collegeName)}$`, $options: 'i' };
    }
    if (organizationName) {
      filters.organizationName = { $regex: `^${escapeRegex(organizationName)}$`, $options: 'i' };
    }
    if (orgPaymentStatus) {
      filters.orgPaymentStatus = orgPaymentStatus;
    }
    if (trainerSettlementStatus) {
      filters.trainerSettlementStatus = trainerSettlementStatus;
    }
    if (fromDate || toDate) {
      filters.endDate = {};
      if (fromDate) filters.endDate.$gte = new Date(`${fromDate}T00:00:00.000Z`);
      if (toDate) filters.endDate.$lte = new Date(`${toDate}T23:59:59.999Z`);
    }

    const sortBy = String(req.query.sortBy || 'ageDays');
    const sortDir = String(req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const sortMap = {
      ageDays: { ageDays: sortDir, endDate: 1, createdAt: -1 },
      endDate: { endDate: sortDir, ageDays: -1, createdAt: -1 },
      yetToRecover: { yetToRecover: sortDir, ageDays: -1, createdAt: -1 },
      marginLeft: { marginLeft: sortDir, ageDays: -1, createdAt: -1 },
      trainerName: { trainerName: sortDir, ageDays: -1, createdAt: -1 },
      collegeName: { collegeName: sortDir, ageDays: -1, createdAt: -1 },
      organizationName: { organizationName: sortDir, ageDays: -1, createdAt: -1 },
      orgPaymentStatus: { orgPaymentStatus: sortDir, ageDays: -1, createdAt: -1 },
      trainerSettlementStatus: { trainerSettlementStatus: sortDir, ageDays: -1, createdAt: -1 }
    };
    const sortSpec = sortMap[sortBy] || sortMap.ageDays;

    const rows = await CycleTrackingRecord.find(
      mergeScopeAndFilters(await buildCycleScope(userDoc), filters)
    )
      .sort(sortSpec)
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
      body('endDate', 'endDate is required').optional().isISO8601(),
      body('ageDays', 'ageDays must be >= 0').optional().isFloat({ min: 0 })
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

      const engagement = await resolveEngagementInScope(userDoc, req.body.trainingEngagementId);
      if (req.body.trainingEngagementId && !engagement) {
        return res.status(404).json({ message: 'Training engagement not found in your scope' });
      }

      const row = new CycleTrackingRecord({
        user: engagement?.user || req.user.id,
        ownerSuperadminId: engagement?.ownerSuperadminId || req.body.ownerSuperadminId || req.user.id,
        connectionId: engagement?.connectionId || req.body.connectionId || '',
        sourcedByUserId: req.user.id,
        sourcedBy: req.body.sourcedBy || '',
        sourcedByName: req.body.sourcedByName || '',
        trainingEngagementId: engagement?._id || null,
        trainerName: req.body.trainerName || '',
        collegeName: req.body.collegeName || '',
        organizationName: req.body.organizationName || '',
        engagementLabel: req.body.engagementLabel || '',
        endDate: req.body.endDate || null,
        ageDays: toNumber(req.body.ageDays, 0),
        indicator: req.body.indicator || 'Within 30 days',
        orgPaymentStatus: req.body.orgPaymentStatus || 'Not Matured',
        trainerSettlementStatus: req.body.trainerSettlementStatus || 'Not Started',
        paidFromCompanyPocket: toNumber(req.body.paidFromCompanyPocket, 0),
        yetToRecover: toNumber(req.body.yetToRecover, 0),
        marginLeft: toNumber(req.body.marginLeft, 0),
        notes: req.body.notes || ''
      });

      const saved = await row.save();
      res.json(saved);
    } catch (err) {
      console.error(err.message);
      res.status(400).json({ message: err.message || 'Invalid cycle tracking data' });
    }
  }
);

router.put('/:id', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const row = await CycleTrackingRecord.findOne(
      mergeScopeAndFilters(await buildCycleScope(userDoc), { _id: req.params.id })
    );

    if (!row) {
      return res.status(404).json({ message: 'Cycle tracking record not found' });
    }

    if (req.body.trainingEngagementId !== undefined) {
      const engagement = await resolveEngagementInScope(userDoc, req.body.trainingEngagementId);
      if (req.body.trainingEngagementId && !engagement) {
        return res.status(404).json({ message: 'Training engagement not found in your scope' });
      }
      row.trainingEngagementId = engagement?._id || null;
      if (engagement) {
        row.user = engagement.user || row.user;
        row.ownerSuperadminId = engagement.ownerSuperadminId || row.ownerSuperadminId;
        row.connectionId = engagement.connectionId || row.connectionId;
      }
    }

    const scalarFields = [
      'trainerName',
      'collegeName',
      'organizationName',
      'engagementLabel',
      'indicator',
      'orgPaymentStatus',
      'trainerSettlementStatus',
      'notes'
    ];

    scalarFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        row[field] = req.body[field];
      }
    });

    if (req.body.endDate !== undefined) row.endDate = req.body.endDate || null;
    if (req.body.ageDays !== undefined) row.ageDays = toNumber(req.body.ageDays, row.ageDays);
    if (req.body.paidFromCompanyPocket !== undefined) row.paidFromCompanyPocket = toNumber(req.body.paidFromCompanyPocket, row.paidFromCompanyPocket);
    if (req.body.yetToRecover !== undefined) row.yetToRecover = toNumber(req.body.yetToRecover, row.yetToRecover);
    if (req.body.marginLeft !== undefined) row.marginLeft = toNumber(req.body.marginLeft, row.marginLeft);

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

    const row = await CycleTrackingRecord.findOneAndDelete(
      mergeScopeAndFilters(await buildCycleScope(userDoc), { _id: req.params.id })
    );

    if (!row) {
      return res.status(404).json({ message: 'Cycle tracking record not found' });
    }

    res.json({ message: 'Cycle tracking record removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
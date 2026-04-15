const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const TrainingEngagement = require('../models/TrainingEngagement');
const User = require('../models/User');

const router = express.Router();

const STATUS_FLOW = ['Planned', 'Ongoing', 'Completed', 'Invoiced', 'Paid'];

async function getUserWithConnections(userId) {
  return User.findById(userId)
    .select('role employeeId name defaultConnectionId connections')
    .lean();
}

async function buildEngagementScope(userDoc) {
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

// ── GET all engagements ──
// Superadmin: sees ALL records across all users.
// Employee: sees only their own.
router.get('/', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.institutionId) {
      filters.institutionId = req.query.institutionId;
    }
    if (req.query.clientId) {
      filters.clientId = req.query.clientId;
    }

    const query = mergeScopeAndFilters(await buildEngagementScope(userDoc), filters);

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
// Superadmin: can retrieve any record; employee: only their own.
router.get('/:id', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const filter = mergeScopeAndFilters(await buildEngagementScope(userDoc), { _id: req.params.id });

    const row = await TrainingEngagement.findOne(filter)
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
      const userDoc = await getUserWithConnections(req.user.id);
      if (!userDoc) {
        return res.status(401).json({ message: 'User not found for scope resolution' });
      }

      let ownerSuperadminId = req.user.id;
      let connectionId = req.body.connectionId || userDoc.defaultConnectionId || '';

      if (userDoc.role === 'employee') {
        const activeConnections = (userDoc.connections || []).filter((c) => c.isActive !== false);
        if (activeConnections.length === 0) {
          return res.status(403).json({ message: 'Employee has no active superadmin connections.' });
        }

        let selected = null;
        if (req.body.ownerSuperadminId && req.body.connectionId) {
          selected = activeConnections.find(
            (c) => String(c.superadminId) === String(req.body.ownerSuperadminId) &&
              String(c.connectionId) === String(req.body.connectionId)
          );
        } else if (req.body.connectionId) {
          selected = activeConnections.find((c) => String(c.connectionId) === String(req.body.connectionId));
        } else if (activeConnections.length === 1) {
          selected = activeConnections[0];
        }

        if (!selected) {
          return res.status(400).json({
            message: 'Employee belongs to multiple superadmin connections. Pass ownerSuperadminId + connectionId.'
          });
        }

        ownerSuperadminId = selected.superadminId;
        connectionId = selected.connectionId;
      } else if (!connectionId) {
        connectionId = `SA-${String(req.user.id).slice(-6).toUpperCase()}`;
      }

      const row = new TrainingEngagement({
        user: req.user.id,
        ownerSuperadminId,
        connectionId,
        sourcedByUserId: req.user.id,
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
        notes: req.body.notes || '',
        sourcedBy: req.body.sourcedBy || '',
        sourcedByName: req.body.sourcedByName || ''
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
// Superadmin: can update any record; employee: only their own.
router.put('/:id', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const filter = mergeScopeAndFilters(await buildEngagementScope(userDoc), { _id: req.params.id });
    const row = await TrainingEngagement.findOne(filter);
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

    const scalarFields = ['institutionId', 'clientId', 'engagementTitle', 'startDate', 'endDate', 'status', 'notes', 'sourcedBy', 'sourcedByName'];
    scalarFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        row[field] = req.body[field];
      }
    });

    // Maintain strict tenancy boundaries.
    if (req.body.connectionId !== undefined || req.body.ownerSuperadminId !== undefined) {
      const requestedOwner = req.body.ownerSuperadminId || row.ownerSuperadminId;
      const requestedConnection = req.body.connectionId || row.connectionId;

      if (userDoc.role === 'superadmin') {
        if (String(requestedOwner) !== String(req.user.id)) {
          return res.status(403).json({ message: 'Cannot transfer engagement ownership to another superadmin.' });
        }
        row.ownerSuperadminId = req.user.id;
        row.connectionId = requestedConnection;
      } else if (userDoc.role === 'platform_owner') {
        row.ownerSuperadminId = requestedOwner;
        row.connectionId = requestedConnection;
      } else {
        const activeConnections = (userDoc.connections || []).filter((c) => c.isActive !== false);
        const allowed = activeConnections.some(
          (c) => String(c.superadminId) === String(requestedOwner) && String(c.connectionId) === String(requestedConnection)
        );
        if (!allowed) {
          return res.status(403).json({ message: 'Employee cannot move engagement outside assigned connection scope.' });
        }
        row.ownerSuperadminId = requestedOwner;
        row.connectionId = requestedConnection;
      }
    }

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
// Superadmin: can delete any record; employee: only their own.
router.delete('/:id', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const filter = mergeScopeAndFilters(await buildEngagementScope(userDoc), { _id: req.params.id });
    const row = await TrainingEngagement.findOneAndDelete(filter);
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
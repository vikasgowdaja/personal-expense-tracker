const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const TrainingEngagement = require('../models/TrainingEngagement');
const CycleTrackingRecord = require('../models/CycleTrackingRecord');
const Invoice = require('../models/Invoice');
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

  const sourceKey = String(userDoc.employeeId || userDoc.name || '').trim();
  if (!sourceKey) {
    return { _id: null };
  }

  return { sourcedBy: sourceKey };
}

async function resolveAssignedUser({ sourcedBy, sourcedByName, fallbackUserId = null }) {
  const normalizedSourcedBy = String(sourcedBy || '').trim();
  const normalizedSourcedByName = String(sourcedByName || '').trim();

  const candidateFilters = [];
  if (normalizedSourcedBy) {
    candidateFilters.push({ employeeId: normalizedSourcedBy });
    if (mongoose.Types.ObjectId.isValid(normalizedSourcedBy)) {
      candidateFilters.push({ _id: normalizedSourcedBy });
    }
    candidateFilters.push({ name: normalizedSourcedBy });
  }
  if (normalizedSourcedByName) {
    candidateFilters.push({ name: normalizedSourcedByName });
  }

  if (candidateFilters.length > 0) {
    const candidates = await User.find({ $or: candidateFilters })
      .select('_id employeeId name role')
      .lean();

    const byEmployeeId = candidates.find((user) => normalizedSourcedBy && user.employeeId === normalizedSourcedBy);
    if (byEmployeeId) return byEmployeeId;

    const byObjectId = candidates.find((user) => normalizedSourcedBy && String(user._id) === normalizedSourcedBy);
    if (byObjectId) return byObjectId;

    const byNamedEmployee = candidates.find((user) => normalizedSourcedByName && user.role === 'employee' && user.name === normalizedSourcedByName);
    if (byNamedEmployee) return byNamedEmployee;

    const byName = candidates.find((user) => normalizedSourcedByName && user.name === normalizedSourcedByName)
      || candidates.find((user) => normalizedSourcedBy && user.name === normalizedSourcedBy);
    if (byName) return byName;
  }

  if (!fallbackUserId) {
    return null;
  }

  return User.findById(fallbackUserId)
    .select('_id employeeId name role')
    .lean();
}

function mergeScopeAndFilters(scope, filters) {
  if (!filters || Object.keys(filters).length === 0) return scope;
  return { $and: [scope, filters] };
}

function sanitizeEngagementForEmployee(row) {
  if (!row) return row;

  const plain = typeof row.toObject === 'function' ? row.toObject() : { ...row };

  // Expose gross revenue contribution (what this engagement is worth) so the
  // employee can track their annual revenue progress — but hide cost-breakdown
  // details (TDS, net payable, per-trainer rates) which are internal finance data.
  plain.contributionAmount = Number(plain.grossAmount || 0);

  delete plain.grossAmount;
  delete plain.totalAmount;
  delete plain.tdsAmount;
  delete plain.tdsPercent;
  delete plain.tdsApplicable;

  if (Array.isArray(plain.trainers)) {
    plain.trainers = plain.trainers.map((trainer) => ({
      ...trainer,
      dailyRate: undefined,
      amount: undefined
    }));
  }

  return plain;
}

async function syncOrgPaymentReceived(engagementId) {
  await Promise.all([
    Invoice.updateMany(
      { trainingEngagementId: engagementId, status: { $ne: 'Paid' } },
      { $set: { status: 'Paid' } }
    ),
    CycleTrackingRecord.updateMany(
      { trainingEngagementId: engagementId },
      { $set: { orgPaymentStatus: 'Paid', yetToRecover: 0 } }
    )
  ]);
}

async function syncOrgPaymentReverted(engagementId) {
  await Promise.all([
    Invoice.updateMany(
      { trainingEngagementId: engagementId, status: 'Paid' },
      { $set: { status: 'Sent' } }
    ),
    CycleTrackingRecord.updateMany(
      { trainingEngagementId: engagementId, orgPaymentStatus: 'Paid' },
      [
        {
          $set: {
            orgPaymentStatus: 'Recovery Due',
            yetToRecover: '$marginLeft'
          }
        }
      ]
    )
  ]);
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

    res.json(userDoc.role === 'employee' ? rows.map(sanitizeEngagementForEmployee) : rows);
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

    res.json(userDoc.role === 'employee' ? sanitizeEngagementForEmployee(row) : row);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// ── GET latest defaults by trainer ──
// Returns last known dailyHours, learners, and ratePerDay for quick form prefill.
router.get('/defaults/trainer/:trainerId', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const trainerId = req.params.trainerId;
    const filter = mergeScopeAndFilters(await buildEngagementScope(userDoc), {
      'trainers.trainerId': trainerId
    });

    const row = await TrainingEngagement.findOne(filter)
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    if (!row) {
      return res.json({
        found: false,
        defaults: {
          dailyHours: null,
          learners: null,
          ratePerDay: null
        }
      });
    }

    const assignment = (row.trainers || []).find((t) => String(t.trainerId) === String(trainerId));

    return res.json({
      found: true,
      defaults: {
        dailyHours: Number(row.dailyHours || 0),
        learners: Number(row.learners || 0),
        ratePerDay: Number(assignment?.dailyRate || 0)
      },
      sourceEngagementId: row._id
    });
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
      body('selectedDates').optional().isArray(),
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

      const assignedUser = await resolveAssignedUser({
        sourcedBy: req.body.sourcedBy,
        sourcedByName: req.body.sourcedByName,
        fallbackUserId: req.user.id
      });

      const normalizedSourcedBy = assignedUser?.employeeId || req.body.sourcedBy || assignedUser?.name || '';
      const normalizedSourcedByName = req.body.sourcedByName || assignedUser?.name || '';

      const row = new TrainingEngagement({
        user: req.user.id,
        ownerSuperadminId,
        connectionId,
        sourcedByUserId: assignedUser?._id || req.user.id,
        institutionId: req.body.institutionId,
        clientId: req.body.clientId,
        engagementTitle: req.body.engagementTitle || '',
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        selectedDates: Array.isArray(req.body.selectedDates) ? req.body.selectedDates : [],
        dailyHours: Number(req.body.dailyHours || 0),
        learners: Number(req.body.learners || 0),
        trainers: (req.body.trainers || []).map((t) => ({
          trainerId: t.trainerId,
          subjectArea: t.subjectArea || '',
          trainingTopic: t.trainingTopic || '',
          dailyRate: Number(t.dailyRate || 0)
        })),
        tdsApplicable: req.body.tdsApplicable !== false,
        tdsPercent: Number(req.body.tdsPercent || 10),
        tdsAmount: Number(req.body.tdsAmount || 0),
        status: req.body.status || 'Planned',
        orgPaymentReceivedAt: req.body.status === 'Paid'
          ? (req.body.orgPaymentReceivedAt ? new Date(req.body.orgPaymentReceivedAt) : new Date())
          : null,
        notes: req.body.notes || '',
        sourcedBy: normalizedSourcedBy,
        sourcedByName: normalizedSourcedByName
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
    const previousStatus = row.status;
    const requestedStatus = req.body.status;
    const isPaidRollback = previousStatus === 'Paid' && requestedStatus === 'Invoiced';
    const canRollbackPaidStatus = userDoc.role === 'superadmin' || userDoc.role === 'platform_owner';

    // Enforce forward-only status lifecycle
    if (requestedStatus && row.status) {
      const prevIndex = STATUS_FLOW.indexOf(row.status);
      const nextIndex = STATUS_FLOW.indexOf(requestedStatus);
      if (prevIndex !== -1 && nextIndex !== -1 && nextIndex < prevIndex && !(isPaidRollback && canRollbackPaidStatus)) {
        return res.status(400).json({ message: 'Status cannot move backward in lifecycle' });
      }
    }

    const scalarFields = ['institutionId', 'clientId', 'engagementTitle', 'startDate', 'endDate', 'selectedDates', 'dailyHours', 'learners', 'tdsApplicable', 'tdsPercent', 'tdsAmount', 'status', 'notes', 'sourcedBy', 'sourcedByName'];
    scalarFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        row[field] = req.body[field];
      }
    });

    if (req.body.sourcedBy !== undefined || req.body.sourcedByName !== undefined) {
      const assignedUser = await resolveAssignedUser({
        sourcedBy: req.body.sourcedBy !== undefined ? req.body.sourcedBy : row.sourcedBy,
        sourcedByName: req.body.sourcedByName !== undefined ? req.body.sourcedByName : row.sourcedByName,
        fallbackUserId: row.sourcedByUserId || req.user.id
      });

      row.sourcedBy = assignedUser?.employeeId || req.body.sourcedBy || assignedUser?.name || row.sourcedBy || '';
      row.sourcedByName = req.body.sourcedByName || assignedUser?.name || row.sourcedByName || '';

      row.sourcedByUserId = assignedUser?._id || null;
    }

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

    if (req.body.orgPaymentReceivedAt !== undefined) {
      row.orgPaymentReceivedAt = req.body.orgPaymentReceivedAt ? new Date(req.body.orgPaymentReceivedAt) : null;
    } else if (isPaidRollback) {
      row.orgPaymentReceivedAt = null;
    } else if (row.status === 'Paid' && !row.orgPaymentReceivedAt) {
      row.orgPaymentReceivedAt = new Date();
    }

    const saved = await row.save();

    if (previousStatus !== 'Paid' && saved.status === 'Paid') {
      await syncOrgPaymentReceived(saved._id);
    } else if (previousStatus === 'Paid' && saved.status !== 'Paid') {
      await syncOrgPaymentReverted(saved._id);
    }

    res.json(saved);
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ message: err.message || 'Invalid update request' });
  }
});

router.post('/:id/mark-org-paid', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    if (userDoc.role === 'employee') {
      return res.status(403).json({ message: 'Employees cannot mark organization payments as received.' });
    }

    const filter = mergeScopeAndFilters(await buildEngagementScope(userDoc), { _id: req.params.id });
    const row = await TrainingEngagement.findOne(filter);
    if (!row) {
      return res.status(404).json({ message: 'Training engagement not found' });
    }

    row.status = 'Paid';
    row.orgPaymentReceivedAt = req.body?.paymentReceivedAt
      ? new Date(req.body.paymentReceivedAt)
      : new Date();

    if (req.body?.note) {
      row.notes = row.notes
        ? `${row.notes}\n[ORG PAYMENT RECEIVED] ${req.body.note}`
        : `[ORG PAYMENT RECEIVED] ${req.body.note}`;
    }

    const saved = await row.save();
    await syncOrgPaymentReceived(saved._id);

    res.json(saved);
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ message: err.message || 'Unable to mark organization payment as received' });
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

    await CycleTrackingRecord.deleteMany({ trainingEngagementId: row._id });

    res.json({ message: 'Training engagement removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
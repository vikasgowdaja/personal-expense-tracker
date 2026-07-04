const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const TrainerSettlement = require('../models/TrainerSettlement');
const TrainingEngagement = require('../models/TrainingEngagement');
const User = require('../models/User');

const router = express.Router();

async function getUserWithConnections(userId) {
  return User.findById(userId)
    .select('role employeeId name connections')
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

  const sourceKey = String(userDoc.employeeId || userDoc.name || '').trim();
  if (!sourceKey) {
    return { _id: null };
  }

  return { sourcedBy: sourceKey };
}

function mergeScopeAndFilters(scope, filters) {
  if (!filters || Object.keys(filters).length === 0) return scope;
  return { $and: [scope, filters] };
}

function sanitizeSettlementForEmployee(row) {
  const plain = typeof row.toObject === 'function' ? row.toObject() : { ...row };
  delete plain.amount;
  delete plain.perDayPayment;
  return plain;
}

function toMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function getConsumedSettlementAmount(trainingEngagementId, excludeId = null) {
  const query = { trainingEngagementId };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const rows = await TrainerSettlement.find(query).select('amount').lean();
  return rows.reduce((sum, item) => sum + toMoney(item.amount), 0);
}

async function validateSettlementCap({ trainingEngagementId, amount, excludeSettlementId = null, engagement }) {
  const netPayable = toMoney(engagement?.totalAmount);
  const consumed = await getConsumedSettlementAmount(trainingEngagementId, excludeSettlementId);
  const requested = toMoney(amount);
  const nextTotal = consumed + requested;

  // Small epsilon protects against floating-point precision noise.
  if (nextTotal > netPayable + 0.0001) {
    return {
      ok: false,
      netPayable,
      consumed,
      requested,
      remaining: Math.max(netPayable - consumed, 0)
    };
  }

  return {
    ok: true,
    netPayable,
    consumed,
    requested,
    remaining: Math.max(netPayable - consumed, 0)
  };
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

    res.json(userDoc.role === 'employee' ? rows.map(sanitizeSettlementForEmployee) : rows);
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

      const isEmployee = userDoc.role === 'employee';

      // Only enforce the settlement cap for employee-submitted requests.
      // Admins (superadmin / platform_owner) are trusted to set any amount —
      // multi-trainer engagements would otherwise be incorrectly blocked.
      if (isEmployee) {
        const capResult = await validateSettlementCap({
          trainingEngagementId: req.body.trainingEngagementId,
          amount: req.body.amount,
          engagement
        });

        if (!capResult.ok) {
          return res.status(400).json({
            message: 'Settlement amount exceeds engagement net payable limit',
            details: {
              netPayableAmount: capResult.netPayable,
              alreadyAllocatedAmount: capResult.consumed,
              requestedAmount: capResult.requested,
              remainingAllowedAmount: capResult.remaining
            }
          });
        }
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
        perDayPayment: isEmployee ? 0 : Number(req.body.perDayPayment || 0),
        amount: isEmployee ? 0 : Number(req.body.amount || 0),
        paidDate: isEmployee ? null : (req.body.paidDate || new Date().toISOString()),
        status: isEmployee ? 'Pending Approval' : (req.body.status || 'Planned'),
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

    const engagement = await TrainingEngagement.findOne(
      mergeScopeAndFilters(await buildSettlementScope(userDoc), { _id: row.trainingEngagementId })
    ).lean();

    if (!engagement) {
      return res.status(404).json({ message: 'Training engagement not found in your scope' });
    }

    const isEmployee = userDoc.role === 'employee';

    // Only enforce the cap for employee-submitted updates. Admins are trusted
    // to approve any amount; multi-trainer engagements would be wrongly blocked otherwise.
    if (isEmployee) {
      const nextAmount = row.amount;
      const capResult = await validateSettlementCap({
        trainingEngagementId: row.trainingEngagementId,
        amount: nextAmount,
        excludeSettlementId: row._id,
        engagement
      });

      if (!capResult.ok) {
        return res.status(400).json({
          message: 'Settlement amount exceeds engagement net payable limit',
          details: {
            netPayableAmount: capResult.netPayable,
            alreadyAllocatedAmount: capResult.consumed,
            requestedAmount: capResult.requested,
            remainingAllowedAmount: capResult.remaining
          }
        });
      }
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
      'notes'
    ];

    if (!isEmployee) {
      scalarFields.push('perDayPayment', 'amount', 'paidDate', 'status');
    }

    scalarFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        row[field] = req.body[field];
      }
    });

    if (isEmployee) {
      row.status = row.status === 'Paid' ? 'Paid' : 'Pending Approval';
      row.perDayPayment = 0;
      row.amount = 0;
      row.paidDate = null;
    }

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

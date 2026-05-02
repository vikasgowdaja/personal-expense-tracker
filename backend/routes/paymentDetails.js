const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const PaymentDetails = require('../models/PaymentDetails');
const Trainer = require('../models/Trainer');
const User = require('../models/User');

const router = express.Router();

function mergeScopeAndFilters(scope, filters) {
  if (!filters || Object.keys(filters).length === 0) return scope;
  return { $and: [scope, filters] };
}

async function getUserWithConnections(userId) {
  return User.findById(userId)
    .select('role connections')
    .lean();
}

async function buildTrainerScope(userDoc) {
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

    const scopedUserIds = [
      userDoc._id,
      ...managedEmployees.map((row) => row._id)
    ];

    return { user: { $in: scopedUserIds } };
  }

  const activeConnections = (userDoc.connections || []).filter((c) => c.isActive !== false);
  const superadminIds = activeConnections.map((c) => c.superadminId);

  return {
    user: {
      $in: [userDoc._id, ...superadminIds]
    }
  };
}

function isPlatformOwner(req) {
  return req.user?.role === 'platform_owner';
}

function buildPaymentScope(req, filters = {}) {
  return isPlatformOwner(req) ? filters : { ...filters, user: req.user.id };
}

router.get('/', auth, async (req, res) => {
  try {
    const rows = await PaymentDetails.find(buildPaymentScope(req))
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
      const userDoc = await getUserWithConnections(req.user.id);
      if (!userDoc) {
        return res.status(401).json({ message: 'User not found for scope resolution' });
      }

      const trainer = await Trainer.findOne(
        mergeScopeAndFilters(await buildTrainerScope(userDoc), { _id: req.body.trainerId })
      );
      if (!trainer) {
        return res.status(404).json({ message: 'Trainer not found' });
      }

      const payload = {
        user: trainer.user,
        trainerId: req.body.trainerId,
        bankName: req.body.bankName,
        accountNumber: req.body.accountNumber,
        ifscCode: req.body.ifscCode,
        upiId: req.body.upiId,
        panNumber: req.body.panNumber
      };

      const row = await PaymentDetails.findOneAndUpdate(
        { user: trainer.user, trainerId: req.body.trainerId },
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
    const row = await PaymentDetails.findOneAndDelete(buildPaymentScope(req, { _id: req.params.id }));
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
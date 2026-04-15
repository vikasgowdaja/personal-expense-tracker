const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Client = require('../models/Client');
const User = require('../models/User');

const router = express.Router();

async function getUserWithConnections(userId) {
  return User.findById(userId)
    .select('role connections')
    .lean();
}

async function buildClientScope(userDoc) {
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

router.get('/', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const scope = await buildClientScope(userDoc);
    const clients = await Client.find(scope).sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.post(
  '/',
  [auth, [body('name', 'Client name is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const client = new Client({
        user: req.user.id,
        name: req.body.name,
        contactPerson: req.body.contactPerson,
        email: req.body.email,
        phone: req.body.phone,
        billingAddress: req.body.billingAddress
      });
      const saved = await client.save();
      res.json(saved);
    } catch (err) {
      console.error(err.message);
      if (err.code === 11000) {
        return res.status(400).json({ message: 'Client already exists' });
      }
      res.status(500).send('Server error');
    }
  }
);

router.put('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: req.body },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json(client);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json({ message: 'Client removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
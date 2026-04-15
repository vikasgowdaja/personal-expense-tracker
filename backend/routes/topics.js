const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Topic = require('../models/Topic');
const User = require('../models/User');

const router = express.Router();

const DEFAULT_TOPICS = [
  'Core Java',
  'Java FSD',
  'MERN Stack',
  'MEAN Stack',
  'Python',
  'AWS Cloud',
  'Azure Cloud',
  'Database',
  'Frontend Development',
  'Backend Development',
  'Linux & Shell Scripting',
  'DevOps',
  'GenAI & LLM',
  'Interview Preparation'
];

async function getUserWithConnections(userId) {
  return User.findById(userId)
    .select('role connections')
    .lean();
}

async function buildTopicScope(userDoc) {
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

    const scope = await buildTopicScope(userDoc);
    const topics = await Topic.find(scope).sort({ name: 1, createdAt: -1 });
    res.json(topics);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.post(
  '/',
  [auth, [body('name', 'Topic name is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const topic = new Topic({
        user: req.user.id,
        name: req.body.name,
        description: req.body.description,
        isActive: req.body.isActive !== undefined ? !!req.body.isActive : true
      });
      const saved = await topic.save();
      res.json(saved);
    } catch (err) {
      console.error(err.message);
      if (err.code === 11000) {
        return res.status(400).json({ message: 'Topic already exists' });
      }
      res.status(500).send('Server error');
    }
  }
);

router.post('/seed-defaults', auth, async (req, res) => {
  try {
    let inserted = 0;
    let skipped = 0;

    for (const name of DEFAULT_TOPICS) {
      const existing = await Topic.findOne({ user: req.user.id, name });
      if (existing) {
        skipped += 1;
        continue;
      }
      await Topic.create({ user: req.user.id, name, isActive: true });
      inserted += 1;
    }

    res.json({ message: 'Default topics processed', inserted, skipped });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const topic = await Topic.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      {
        $set: {
          name: req.body.name,
          description: req.body.description,
          isActive: req.body.isActive !== undefined ? !!req.body.isActive : true
        }
      },
      { new: true }
    );

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    res.json(topic);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Topic already exists' });
    }
    res.status(500).send('Server error');
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const topic = await Topic.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    res.json({ message: 'Topic removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;

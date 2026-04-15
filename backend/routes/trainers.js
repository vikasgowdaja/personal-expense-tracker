const express = require('express');
const fs = require('fs').promises;
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Trainer = require('../models/Trainer');
const User = require('../models/User');
const { extractTrainerProfileFromPdf } = require('../utils/trainerPdfParser');

const router = express.Router();

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

function mergeScopeAndFilters(scope, filters) {
  if (!filters || Object.keys(filters).length === 0) return scope;
  return { $and: [scope, filters] };
}

fs.mkdir('uploads', { recursive: true }).catch(() => {});

const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype === 'application/pdf' || ext === '.pdf') {
      return cb(null, true);
    }
    cb(new Error('Only PDF files are allowed'));
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const scope = await buildTrainerScope(userDoc);
    const trainers = await Trainer.find(scope).sort({ createdAt: -1 });
    res.json(trainers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.post('/import-pdf', auth, resumeUpload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No PDF uploaded' });
  }

  try {
    const extracted = await extractTrainerProfileFromPdf(req.file.path);

    if (!extracted.fullName && !extracted.email) {
      return res.status(400).json({ message: 'Could not extract trainer details from PDF' });
    }

    let trainer = null;
    if (extracted.email) {
      trainer = await Trainer.findOne({ user: req.user.id, email: extracted.email.toLowerCase() });
    }

    if (trainer) {
      trainer.fullName = extracted.fullName || trainer.fullName;
      trainer.phone = extracted.phone || trainer.phone;
      trainer.yearsOfExperience = extracted.yearsOfExperience || trainer.yearsOfExperience;
      trainer.specialization = extracted.specialization || trainer.specialization;
      await trainer.save();
    } else {
      trainer = await Trainer.create({
        user: req.user.id,
        fullName: extracted.fullName || 'Trainer',
        email: extracted.email || `trainer-${Date.now()}@local.invalid`,
        phone: extracted.phone,
        yearsOfExperience: extracted.yearsOfExperience || 0,
        specialization: extracted.specialization
      });
    }

    res.json({
      message: 'Trainer profile extracted successfully',
      trainer,
      extracted
    });
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ message: err.message || 'Failed to import trainer PDF' });
  } finally {
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupErr) {
      // Ignore cleanup failures
    }
  }
});

router.post(
  '/',
  [
    auth,
    [
      body('fullName', 'Full name is required').not().isEmpty(),
      body('email', 'Valid email is required').isEmail()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const trainer = new Trainer({
        user: req.user.id,
        fullName: req.body.fullName,
        email: req.body.email,
        phone: req.body.phone,
        yearsOfExperience: req.body.yearsOfExperience,
        specialization: req.body.specialization
      });

      const saved = await trainer.save();
      res.json(saved);
    } catch (err) {
      console.error(err.message);
      if (err.code === 11000) {
        return res.status(400).json({ message: 'Trainer email already exists' });
      }
      res.status(500).send('Server error');
    }
  }
);

router.put('/:id', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const scope = await buildTrainerScope(userDoc);
    const trainer = await Trainer.findOneAndUpdate(
      mergeScopeAndFilters(scope, { _id: req.params.id }),
      { $set: req.body },
      { new: true }
    );

    if (!trainer) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    res.json(trainer);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const userDoc = await getUserWithConnections(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ message: 'User not found for scope resolution' });
    }

    const scope = await buildTrainerScope(userDoc);
    const trainer = await Trainer.findOneAndDelete(mergeScopeAndFilters(scope, { _id: req.params.id }));
    if (!trainer) {
      return res.status(404).json({ message: 'Trainer not found' });
    }
    res.json({ message: 'Trainer removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
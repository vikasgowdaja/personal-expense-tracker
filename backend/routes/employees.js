const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');

// All routes: authenticated + privileged roles
router.use(requireAuth, requireRole('superadmin', 'platform_owner'));

async function generateEmployeeId(name) {
  const prefix = name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const count = await User.countDocuments({ employeeId: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
}

function generateConnectionId() {
  return `CNX-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function sanitizeConnectionId(value) {
  const cleaned = String(value || '').trim();
  return cleaned ? cleaned.toUpperCase() : '';
}

async function generateAdminCode() {
  for (let i = 0; i < 10; i += 1) {
    const candidate = `ADM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await User.exists({ adminCode: candidate });
    if (!exists) return candidate;
  }
  return `ADM-${Date.now().toString(36).toUpperCase()}`;
}

async function ensureSuperadminCode(user) {
  if (!user || user.role !== 'superadmin') return;
  if (user.adminCode) return;
  user.adminCode = await generateAdminCode();
  await user.save();
}

function upsertSuperadminConnection(user, superadminId, connectionId) {
  const normalizedConnectionId = sanitizeConnectionId(connectionId) || generateConnectionId();
  const idx = (user.connections || []).findIndex((c) => String(c.superadminId) === String(superadminId));
  if (idx >= 0) {
    user.connections[idx].connectionId = normalizedConnectionId;
    user.connections[idx].isActive = true;
  } else {
    user.connections.push({
      superadminId,
      connectionId: normalizedConnectionId,
      isActive: true
    });
  }
  if (!user.defaultConnectionId) {
    user.defaultConnectionId = normalizedConnectionId;
  }
  return normalizedConnectionId;
}

/**
 * GET /api/employees
 * List all users (employees + admins) for management.
 */
router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'platform_owner') {
      const users = await User.find({ role: { $in: ['superadmin', 'employee'] } })
        .select('-password -otp -otpExpires -refreshToken')
        .sort({ role: 1, name: 1 })
        .lean();
      return res.json(users);
    }

    const meRaw = await User.findById(req.user.id)
      .select('-password -otp -otpExpires -refreshToken');
    if (meRaw) {
      await ensureSuperadminCode(meRaw);
    }

    const employees = await User.find({
      role: 'employee',
      connections: {
        $elemMatch: {
          superadminId: req.user.id,
          isActive: true
        }
      }
    })
      .select('-password -otp -otpExpires -refreshToken')
      .sort({ role: 1, name: 1 })
      .lean();

    return res.json(employees);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * POST /api/employees
 * Create an employee account (superadmin does not need OTP step for created users).
 */
router.post('/', [
  body('name', 'Name is required').not().isEmpty(),
  body('email', 'Valid email required').isEmail(),
  body('password').optional().isLength({ min: 8 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, connectionId } = req.body;
  try {
    let existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== 'employee') {
        return res.status(400).json({ message: 'This account is not an employee and cannot be linked here.' });
      }

      upsertSuperadminConnection(existing, req.user.id, connectionId);
      await existing.save();

      const { password: _p, otp: _o, otpExpires: _oe, refreshToken: _r, ...safeExisting } = existing.toObject();
      return res.status(200).json({
        ...safeExisting,
        message: 'Existing employee linked successfully under this superadmin connection.'
      });
    }

    if (!password) {
      return res.status(400).json({ message: 'Password is required for new employee creation' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const employeeId = await generateEmployeeId(name);

    const employee = new User({
      name,
      email,
      password: hashedPassword,
      role: 'employee',
      employeeId,
      isVerified: true,   // superadmin-created accounts are pre-verified
      defaultConnectionId: sanitizeConnectionId(connectionId),
      connections: []
    });

    upsertSuperadminConnection(employee, req.user.id, connectionId);
    await employee.save();

    const { password: _p, otp: _o, otpExpires: _oe, refreshToken: _r, ...safe } = employee.toObject();
    res.status(201).json(safe);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * PUT /api/employees/:id
 * Update employee name or role.
 */
router.put('/:id', [
  body('name').optional().not().isEmpty().withMessage('Name cannot be empty')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name } = req.body;
  const updates = {};
  if (name) updates.name = name;

  if (req.body.role !== undefined) {
    return res.status(403).json({ message: 'Role changes are allowed only for Platform Owner via role endpoint.' });
  }

  try {
    if (req.user.role === 'superadmin') {
      const managed = await User.findOne({
        _id: req.params.id,
        role: 'employee',
        connections: {
          $elemMatch: {
            superadminId: req.user.id,
            isActive: true
          }
        }
      });

      if (!managed) {
        return res.status(404).json({ message: 'Employee not found for this superadmin scope' });
      }
    } else {
      const managed = await User.findOne({ _id: req.params.id, role: { $in: ['superadmin', 'employee'] } });
      if (!managed) {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select('-password -otp -otpExpires -refreshToken');

    if (user && user.role === 'superadmin') {
      await ensureSuperadminCode(user);
    }

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * PATCH /api/employees/:id/role
 * Promote/demote roles (Platform Owner only).
 */
router.patch('/:id/role', [
  body('role', 'Role must be superadmin or employee').isIn(['superadmin', 'employee'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (req.user.role !== 'platform_owner') {
    return res.status(403).json({ message: 'Only Platform Owner can promote or demote roles.' });
  }

  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'Cannot change your own role' });
  }

  try {
    const managed = await User.findOne({
      _id: req.params.id,
      role: { $in: ['superadmin', 'employee'] }
    });

    if (!managed) {
      return res.status(404).json({ message: 'User not found for role change' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role: req.body.role } },
      { new: true }
    ).select('-password -otp -otpExpires -refreshToken');

    if (user && user.role === 'superadmin') {
      await ensureSuperadminCode(user);
    }

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * PATCH /api/employees/:id/connection
 * Update or create the current superadmin <-> employee connection link.
 */
router.patch('/:id/connection', [
  body('connectionId', 'connectionId is required').not().isEmpty(),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only SuperAdmin can update employee connection links.' });
    }

    const employee = await User.findOne({ _id: req.params.id, role: 'employee' });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const normalizedConnectionId = sanitizeConnectionId(req.body.connectionId);
    const idx = (employee.connections || []).findIndex((c) => String(c.superadminId) === String(req.user.id));
    if (idx >= 0) {
      employee.connections[idx].connectionId = normalizedConnectionId;
      if (req.body.isActive !== undefined) {
        employee.connections[idx].isActive = Boolean(req.body.isActive);
      }
    } else {
      employee.connections.push({
        superadminId: req.user.id,
        connectionId: normalizedConnectionId,
        isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true
      });
    }

    if (!employee.defaultConnectionId) {
      employee.defaultConnectionId = normalizedConnectionId;
    }

    await employee.save();
    const safe = await User.findById(employee._id).select('-password -otp -otpExpires -refreshToken');
    res.json(safe);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * DELETE /api/employees/:id
 * Remove a user account.
 */
router.delete('/:id', async (req, res) => {
  try {
    // Prevent superadmin from deleting themselves
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role !== 'employee') {
      return res.status(400).json({ message: 'Only employee records can be removed from this screen.' });
    }

    user.connections = (user.connections || []).filter(
      (c) => String(c.superadminId) !== String(req.user.id)
    );

    if (user.defaultConnectionId) {
      const stillExists = (user.connections || []).some((c) => c.connectionId === user.defaultConnectionId);
      if (!stillExists) {
        user.defaultConnectionId = user.connections[0]?.connectionId || '';
      }
    }

    if ((user.connections || []).length === 0) {
      await User.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Employee removed fully (no remaining superadmin connections).' });
    }

    await user.save();
    res.json({ message: 'Employee detached from your superadmin scope.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;

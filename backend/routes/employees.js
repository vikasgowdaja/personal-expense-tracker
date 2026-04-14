const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');

// All routes: authenticated + superadmin only
router.use(requireAuth, requireRole('superadmin'));

/**
 * GET /api/employees
 * List all users (employees + admins) for management.
 */
router.get('/', async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('-password -otp -otpExpires -refreshToken')
      .sort({ role: 1, name: 1 })
      .lean();
    res.json(users);
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
  body('password', 'Password must be at least 8 characters').isLength({ min: 8 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password } = req.body;
  try {
    let existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const employee = new User({
      name,
      email,
      password: hashedPassword,
      role: 'employee',
      isVerified: true   // superadmin-created accounts are pre-verified
    });
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
  body('role').optional().isIn(['superadmin', 'employee'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, role } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (role) updates.role = role;

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select('-password -otp -otpExpires -refreshToken');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * PATCH /api/employees/:id/role
 * Promote an employee to superadmin or demote to employee.
 */
router.patch('/:id/role', [
  body('role', 'Role must be superadmin or employee').isIn(['superadmin', 'employee'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'Cannot change your own role' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role: req.body.role } },
      { new: true }
    ).select('-password -otp -otpExpires -refreshToken');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
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
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Employee removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;

/**
 * CLI script to create a privileged account directly in the database.
 *
 * Usage:
 *   node scripts/createAdmin.js <name> <email> <password> [role]
 *
 * Example:
 *   node scripts/createAdmin.js "Vikas Gowda" admin@example.com MyStr0ng!Pass superadmin
 *   node scripts/createAdmin.js "Owner" owner@example.com MyStr0ng!Pass platform_owner
 *
 * Run from the backend/ directory. Requires a valid .env file.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function generateAdminCode() {
  for (let i = 0; i < 10; i += 1) {
    const candidate = `ADM-${require('crypto').randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await User.exists({ adminCode: candidate });
    if (!exists) return candidate;
  }
  return `ADM-${Date.now().toString(36).toUpperCase()}`;
}

const [,, name, email, password, roleArg] = process.argv;
const targetRole = (roleArg || 'superadmin').toLowerCase();

if (!name || !email || !password) {
  console.error('Usage: node scripts/createAdmin.js <name> <email> <password> [role]');
  process.exit(1);
}

if (!['superadmin', 'platform_owner'].includes(targetRole)) {
  console.error('Role must be either "superadmin" or "platform_owner".');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === targetRole) {
      if (!existing.adminCode) {
        existing.adminCode = await generateAdminCode();
        await existing.save();
      }
      console.log(`${targetRole} already exists for ${email}. Nothing changed.`);
      console.log(`Admin code: ${existing.adminCode}`);
    } else {
      existing.role = targetRole;
      existing.isVerified = true;
      if (targetRole === 'superadmin') {
        existing.adminCode = await generateAdminCode();
      }
      await existing.save();
      console.log(`Updated existing user "${existing.name}" to role ${targetRole}.`);
      if (targetRole === 'superadmin') {
        console.log(`Admin code: ${existing.adminCode}`);
      }
    }
    await mongoose.disconnect();
    return;
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const admin = new User({
    name,
    email,
    password: hashedPassword,
    role: targetRole,
    adminCode: targetRole === 'superadmin' ? await generateAdminCode() : undefined,
    isVerified: true
  });
  await admin.save();

  console.log(`${targetRole} created: ${name} <${email}>`);
  if (admin.adminCode) {
    console.log(`Admin code: ${admin.adminCode}`);
  }
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});

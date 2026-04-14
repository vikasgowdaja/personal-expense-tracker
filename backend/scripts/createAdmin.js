/**
 * CLI script to create a SuperAdmin account directly in the database.
 *
 * Usage:
 *   node scripts/createAdmin.js <name> <email> <password>
 *
 * Example:
 *   node scripts/createAdmin.js "Vikas Gowda" admin@example.com MyStr0ng!Pass
 *
 * Run from the backend/ directory. Requires a valid .env file.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const [,, name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: node scripts/createAdmin.js <name> <email> <password>');
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
    if (existing.role === 'superadmin') {
      console.log(`SuperAdmin already exists for ${email}. Nothing changed.`);
    } else {
      existing.role = 'superadmin';
      existing.isVerified = true;
      await existing.save();
      console.log(`Promoted existing user "${existing.name}" to SuperAdmin.`);
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
    role: 'superadmin',
    isVerified: true
  });
  await admin.save();

  console.log(`SuperAdmin created: ${name} <${email}>`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return '';
  }
  return String(process.argv[index + 1] || '').trim();
}

function printUsage() {
  console.log('Usage: npm run password:reset -- --email <email> --password <new_password>');
}

async function run() {
  const email = getArgValue('--email').toLowerCase();
  const newPassword = getArgValue('--password');

  if (!email || !newPassword) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (newPassword.length < 8) {
    console.error('Password must be at least 8 characters long.');
    process.exitCode = 1;
    return;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker';

  try {
    await mongoose.connect(mongoUri);

    const user = await User.findOne({ email });
    if (!user) {
      console.error(`User not found for email: ${email}`);
      process.exitCode = 1;
      return;
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);

    // Invalidate active sessions and pending OTPs after password reset.
    user.refreshToken = null;
    user.otp = null;
    user.otpExpires = null;

    await user.save();

    console.log(`Password reset successful for: ${email}`);
  } catch (error) {
    console.error('Password reset failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

run();

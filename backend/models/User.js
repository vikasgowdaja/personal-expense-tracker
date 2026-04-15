const mongoose = require('mongoose');

const userConnectionSchema = new mongoose.Schema({
  superadminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  connectionId: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['platform_owner', 'superadmin', 'employee'],
    default: 'employee'
  },
  adminCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true,
    default: undefined
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
    default: null
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true,
    default: null
  },
  defaultConnectionId: {
    type: String,
    trim: true,
    default: ''
  },
  connections: {
    type: [userConnectionSchema],
    default: []
  },
  mobile: {
    type: String,
    trim: true,
    default: ''
  },
  profilePhoto: {
    type: String,
    trim: true,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);

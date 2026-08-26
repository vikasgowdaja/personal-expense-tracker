const mongoose = require('mongoose');

const userSettingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  namespace: { type: String, required: true, trim: true },
  values: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

userSettingSchema.index({ userId: 1, namespace: 1 }, { unique: true });

module.exports = mongoose.model('UserSetting', userSettingSchema);
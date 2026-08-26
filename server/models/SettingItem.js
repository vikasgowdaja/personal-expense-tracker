const mongoose = require('mongoose');

const settingItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  namespace: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  lowercaseName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  color: { type: String, trim: true },
  icon: { type: String, trim: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SettingItem', default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  usageCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

settingItemSchema.index({ userId: 1, namespace: 1, status: 1 });
settingItemSchema.index({ userId: 1, namespace: 1, lowercaseName: 1 }, { unique: true });

settingItemSchema.pre('validate', function normalizeName(next) {
  if (typeof this.name === 'string') {
    this.name = this.name.trim();
    this.lowercaseName = this.name.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('SettingItem', settingItemSchema);
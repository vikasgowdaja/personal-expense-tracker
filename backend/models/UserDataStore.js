const mongoose = require('mongoose');

const UserDataStoreSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    key: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

UserDataStoreSchema.index({ userId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('UserDataStore', UserDataStoreSchema);

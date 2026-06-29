const mongoose = require('mongoose');

const RawImageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    s3Key: {
      type: String,
      required: true,
      trim: true
    },
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending'
    },
    extractedTransactionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
      }
    ]
  },
  {
    timestamps: true
  }
);

RawImageSchema.index({ userId: 1, uploadedAt: -1 });

module.exports = mongoose.model('RawImage', RawImageSchema);

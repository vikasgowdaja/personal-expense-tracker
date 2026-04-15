const mongoose = require('mongoose');

const SETTLEMENT_STATUS = ['Planned', 'Partially Paid', 'Paid'];

const trainerSettlementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    ownerSuperadminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null
    },
    connectionId: {
      type: String,
      trim: true,
      index: true,
      default: ''
    },
    sourcedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null
    },
    sourcedBy: {
      type: String,
      trim: true,
      default: ''
    },
    sourcedByName: {
      type: String,
      trim: true,
      default: ''
    },
    trainingEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingEngagement',
      required: true,
      index: true
    },
    engagementLabel: {
      type: String,
      trim: true,
      default: ''
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      default: null,
      index: true
    },
    trainerName: {
      type: String,
      trim: true,
      default: ''
    },
    collegeName: {
      type: String,
      trim: true,
      default: ''
    },
    organizationName: {
      type: String,
      trim: true,
      default: ''
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    totalDays: {
      type: Number,
      min: 0,
      default: 0
    },
    perDayPayment: {
      type: Number,
      min: 0,
      default: 0
    },
    amount: {
      type: Number,
      min: 0,
      required: true
    },
    paidDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: SETTLEMENT_STATUS,
      default: 'Planned'
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

trainerSettlementSchema.index({ ownerSuperadminId: 1, connectionId: 1, paidDate: -1 });

module.exports = mongoose.model('TrainerSettlement', trainerSettlementSchema);

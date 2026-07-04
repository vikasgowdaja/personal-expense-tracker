const mongoose = require('mongoose');

const CYCLE_INDICATOR = ['Within 30 days', 'Crossed 30 days', 'Crossed 45 days'];
const ORG_STATUS = ['Paid', 'Not Matured', 'Recovery Due', 'Recovery Overdue'];
const TRAINER_STATUS = ['Paid', 'Not Started', 'Partially Paid', 'Pending'];

const cycleTrackingRecordSchema = new mongoose.Schema(
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
      default: '',
      index: true
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
      index: true,
      default: null
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
    engagementLabel: {
      type: String,
      trim: true,
      default: ''
    },
    endDate: {
      type: Date,
      default: null,
      index: true
    },
    ageDays: {
      type: Number,
      min: 0,
      default: 0
    },
    indicator: {
      type: String,
      enum: CYCLE_INDICATOR,
      default: 'Within 30 days'
    },
    orgPaymentStatus: {
      type: String,
      enum: ORG_STATUS,
      default: 'Not Matured'
    },
    trainerSettlementStatus: {
      type: String,
      enum: TRAINER_STATUS,
      default: 'Not Started'
    },
    paidFromCompanyPocket: {
      type: Number,
      default: 0
    },
    yetToRecover: {
      type: Number,
      default: 0
    },
    marginLeft: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

cycleTrackingRecordSchema.index({ ownerSuperadminId: 1, connectionId: 1, endDate: -1 });
cycleTrackingRecordSchema.index({ trainingEngagementId: 1, user: 1 });

module.exports = mongoose.model('CycleTrackingRecord', cycleTrackingRecordSchema);
const mongoose = require('mongoose');

const STATUS = ['Planned', 'Ongoing', 'Completed', 'Invoiced', 'Paid'];

// One trainer assignment within an engagement
const trainerAssignmentSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true
    },
    subjectArea: {
      type: String,
      trim: true,
      default: ''
    },
    trainingTopic: {
      type: String,
      trim: true,
      default: ''
    },
    dailyRate: {
      type: Number,
      min: 0,
      default: 0
    },
    // auto-computed: totalDays * dailyRate
    amount: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  { _id: true }
);

// One engagement is bounded by one institution + one client.
// Multiple trainers can work under it, each on different subjects.
const trainingEngagementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // ── Engagement-level bounds ──
  institutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  engagementTitle: {
    type: String,
    trim: true,
    default: ''
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalDays: {
    type: Number,
    min: 1,
    default: 1
  },
  // ── Trainer assignments (one per trainer, each with their own subject/rate) ──
  trainers: {
    type: [trainerAssignmentSchema],
    default: []
  },
  // ── Auto-computed: sum of all trainer amounts ──
  totalAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: STATUS,
    default: 'Planned'
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  // ── Who sourced / created this engagement (employeeId or admin name) ──
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

trainingEngagementSchema.pre('validate', function computeFields(next) {
  if (!this.startDate || !this.endDate) {
    return next();
  }

  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  if (end < start) {
    return next(new Error('endDate cannot be before startDate'));
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / dayMs) + 1;
  this.totalDays = Math.max(1, diffDays);

  // Compute per-trainer amounts and sum for engagement total
  let engagementTotal = 0;
  (this.trainers || []).forEach((t) => {
    t.amount = this.totalDays * Number(t.dailyRate || 0);
    engagementTotal += t.amount;
  });
  this.totalAmount = engagementTotal;
  next();
});

module.exports = mongoose.model('TrainingEngagement', trainingEngagementSchema);
const mongoose = require('mongoose');

const STATUS = ['Planned', 'Ongoing', 'Completed', 'Invoiced', 'Paid'];

function normalizeSelectedDates(input) {
  if (!Array.isArray(input)) return [];

  const valid = input
    .map((v) => String(v || '').trim())
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));

  return [...new Set(valid)].sort((a, b) => new Date(a) - new Date(b));
}

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
  selectedDates: {
    type: [String],
    default: []
  },
  totalDays: {
    type: Number,
    min: 1,
    default: 1
  },
  dailyHours: {
    type: Number,
    min: 0,
    default: 0
  },
  learners: {
    type: Number,
    min: 0,
    default: 0
  },
  // ── Trainer assignments (one per trainer, each with their own subject/rate) ──
  trainers: {
    type: [trainerAssignmentSchema],
    default: []
  },
  grossAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  tdsApplicable: {
    type: Boolean,
    default: true
  },
  tdsPercent: {
    type: Number,
    min: 0,
    default: 10
  },
  tdsAmount: {
    type: Number,
    min: 0,
    default: 0
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
  const normalizedSelectedDates = normalizeSelectedDates(this.selectedDates || []);
  if (normalizedSelectedDates.length > 0) {
    this.selectedDates = normalizedSelectedDates;
    this.startDate = new Date(`${normalizedSelectedDates[0]}T00:00:00.000Z`);
    this.endDate = new Date(`${normalizedSelectedDates[normalizedSelectedDates.length - 1]}T00:00:00.000Z`);
    this.totalDays = normalizedSelectedDates.length;
  } else {
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
  }

  // Compute per-trainer amounts and totals
  let grossTotal = 0;
  (this.trainers || []).forEach((t) => {
    t.amount = this.totalDays * Number(t.dailyRate || 0);
    grossTotal += t.amount;
  });

  this.grossAmount = grossTotal;

  const shouldApplyTds = this.tdsApplicable !== false;
  this.tdsApplicable = shouldApplyTds;
  if (!shouldApplyTds) {
    this.tdsPercent = 0;
    this.tdsAmount = 0;
  } else {
    const percent = Number(this.tdsPercent);
    const safePercent = Number.isFinite(percent) && percent >= 0 ? percent : 10;
    this.tdsPercent = safePercent;
    this.tdsAmount = (grossTotal * safePercent) / 100;
  }

  this.totalAmount = Math.max(grossTotal - Number(this.tdsAmount || 0), 0);
  next();
});

module.exports = mongoose.model('TrainingEngagement', trainingEngagementSchema);
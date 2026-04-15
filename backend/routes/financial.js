const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const TrainingEngagement = require('../models/TrainingEngagement');
const Expense = require('../models/Expense');
const User = require('../models/User');

// All routes require authentication AND superadmin role
router.use(requireAuth, requireRole('superadmin', 'platform_owner'));

async function tenantScopeForSuperadmin(superadminId) {
  const managedEmployees = await User.find({
    role: 'employee',
    connections: {
      $elemMatch: {
        superadminId,
        isActive: true
      }
    }
  }).select('_id').lean();

  const managedEmployeeIds = managedEmployees.map((e) => e._id);

  return {
    $or: [
      { ownerSuperadminId: superadminId },
      { user: superadminId },
      ...(managedEmployeeIds.length ? [{ user: { $in: managedEmployeeIds } }] : [])
    ]
  };
}

async function getFinancialScopeForUser(userId) {
  const user = await User.findById(userId).select('role').lean();
  if (!user) return { _id: null };
  if (user.role === 'platform_owner') return {};
  return tenantScopeForSuperadmin(userId);
}

/**
 * GET /api/financial/summary
 * Business financial summary: revenue, expenses, margin, payout pool.
 */
router.get('/summary', async (req, res) => {
  try {
    const engagementScope = await getFinancialScopeForUser(req.user.id);
    const [engagements, expenses] = await Promise.all([
      TrainingEngagement.find(engagementScope).lean(),
      Expense.find().lean()
    ]);

    const totalRevenue = engagements.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
    const totalTrainerPayout = engagements.reduce((sum, e) => sum + (e.trainerFee || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const grossMargin = totalRevenue - totalTrainerPayout - totalExpenses;
    const marginPercent = totalRevenue > 0 ? ((grossMargin / totalRevenue) * 100).toFixed(2) : 0;

    res.json({
      totalRevenue,
      totalTrainerPayout,
      totalExpenses,
      grossMargin,
      marginPercent: parseFloat(marginPercent)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * GET /api/financial/payouts
 * Per-engagement payout detail.
 */
router.get('/payouts', async (req, res) => {
  try {
    const scope = await getFinancialScopeForUser(req.user.id);
    const engagements = await TrainingEngagement.find(scope)
      .populate('trainer', 'name email')
      .populate('institution', 'name')
      .lean();

    const payouts = engagements.map(e => ({
      id: e._id,
      trainer: e.trainer,
      institution: e.institution,
      topic: e.topic,
      totalAmount: e.totalAmount || 0,
      trainerFee: e.trainerFee || 0,
      margin: (e.totalAmount || 0) - (e.trainerFee || 0),
      status: e.status,
      startDate: e.startDate
    }));

    res.json(payouts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * GET /api/financial/margins
 * Month-wise margin breakdown.
 */
router.get('/margins', async (req, res) => {
  try {
    const scope = await getFinancialScopeForUser(req.user.id);
    const engagements = await TrainingEngagement.find(scope).lean();

    const byMonth = {};
    for (const e of engagements) {
      const month = e.startDate
        ? new Date(e.startDate).toISOString().slice(0, 7)
        : 'unknown';
      if (!byMonth[month]) byMonth[month] = { revenue: 0, payout: 0 };
      byMonth[month].revenue += e.totalAmount || 0;
      byMonth[month].payout += e.trainerFee || 0;
    }

    const margins = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        payout: data.payout,
        margin: data.revenue - data.payout,
        marginPercent: data.revenue > 0
          ? parseFloat(((data.revenue - data.payout) / data.revenue * 100).toFixed(2))
          : 0
      }));

    res.json(margins);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;

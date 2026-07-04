const express = require('express');
const requireAuth = require('../middleware/auth');
const UserDataStore = require('../models/UserDataStore');

const router = express.Router();

const ALLOWED_KEYS = new Set([
  'training_engagements',
  'trainer_profiles',
  'trainer_settlements',
  'teaching_sessions',
  'daily_logs'
]);

function normalizeKey(key) {
  return String(key || '').trim();
}

function isPlatformOwner(req) {
  return req.user?.role === 'platform_owner';
}

function resolveTargetUserId(req, fallbackToCurrent = true) {
  const requestedUserId = req.query.userId || req.body?.userId;
  if (isPlatformOwner(req) && requestedUserId) {
    return String(requestedUserId).trim();
  }
  return fallbackToCurrent ? req.user.id : null;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const keys = String(req.query.keys || '')
      .split(',')
      .map((k) => normalizeKey(k))
      .filter((k) => ALLOWED_KEYS.has(k));

    const targetUserId = resolveTargetUserId(req, false);
    const query = targetUserId ? { userId: targetUserId } : {};
    if (keys.length > 0) {
      query.key = { $in: keys };
    }

    const rows = await UserDataStore.find(query)
      .select('userId key payload updatedAt')
      .lean();

    res.json({
      items: rows.map((row) => ({
        userId: row.userId,
        key: row.key,
        payload: row.payload,
        updatedAt: row.updatedAt
      }))
    });
  } catch (error) {
    console.error('User data fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch user data' });
  }
});

router.put('/:key', requireAuth, async (req, res) => {
  try {
    const key = normalizeKey(req.params.key);
    const targetUserId = resolveTargetUserId(req, true);
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ message: 'Unsupported key' });
    }

    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'payload')) {
      return res.status(400).json({ message: 'payload is required' });
    }

    const updated = await UserDataStore.findOneAndUpdate(
      { userId: targetUserId, key },
      { $set: { payload: req.body.payload } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('userId key payload updatedAt');

    res.json({
      userId: updated.userId,
      key: updated.key,
      payload: updated.payload,
      updatedAt: updated.updatedAt
    });
  } catch (error) {
    console.error('User data upsert error:', error);
    res.status(500).json({ message: 'Failed to save user data' });
  }
});

router.post('/bulk-upsert', requireAuth, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const defaultUserId = resolveTargetUserId(req, true);
    if (items.length === 0) {
      return res.status(400).json({ message: 'items is required' });
    }

    const operations = items
      .map((item) => ({
        userId: isPlatformOwner(req) && item?.userId ? String(item.userId).trim() : defaultUserId,
        key: normalizeKey(item?.key),
        payload: item?.payload
      }))
      .filter((item) => item.userId && ALLOWED_KEYS.has(item.key));

    if (operations.length === 0) {
      return res.status(400).json({ message: 'No valid keys supplied' });
    }

    await UserDataStore.bulkWrite(
      operations.map((item) => ({
        updateOne: {
          filter: { userId: item.userId, key: item.key },
          update: { $set: { payload: item.payload } },
          upsert: true
        }
      }))
    );

    const updatedRows = await UserDataStore.find({
      $or: operations.map((item) => ({ userId: item.userId, key: item.key }))
    })
      .select('userId key payload updatedAt')
      .lean();

    res.json({
      items: updatedRows.map((row) => ({
        userId: row.userId,
        key: row.key,
        payload: row.payload,
        updatedAt: row.updatedAt
      }))
    });
  } catch (error) {
    console.error('User data bulk-upsert error:', error);
    res.status(500).json({ message: 'Failed to save user data' });
  }
});

router.delete('/:key', requireAuth, async (req, res) => {
  try {
    const key = normalizeKey(req.params.key);
    const targetUserId = resolveTargetUserId(req, true);
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ message: 'Unsupported key' });
    }

    await UserDataStore.deleteOne({ userId: targetUserId, key });
    res.json({ success: true });
  } catch (error) {
    console.error('User data delete error:', error);
    res.status(500).json({ message: 'Failed to delete user data' });
  }
});

module.exports = router;

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

router.get('/', requireAuth, async (req, res) => {
  try {
    const keys = String(req.query.keys || '')
      .split(',')
      .map((k) => normalizeKey(k))
      .filter((k) => ALLOWED_KEYS.has(k));

    const query = { userId: req.user.id };
    if (keys.length > 0) {
      query.key = { $in: keys };
    }

    const rows = await UserDataStore.find(query)
      .select('key payload updatedAt')
      .lean();

    res.json({
      items: rows.map((row) => ({
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
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ message: 'Unsupported key' });
    }

    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'payload')) {
      return res.status(400).json({ message: 'payload is required' });
    }

    const updated = await UserDataStore.findOneAndUpdate(
      { userId: req.user.id, key },
      { $set: { payload: req.body.payload } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('key payload updatedAt');

    res.json({
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
    if (items.length === 0) {
      return res.status(400).json({ message: 'items is required' });
    }

    const operations = items
      .map((item) => ({
        key: normalizeKey(item?.key),
        payload: item?.payload
      }))
      .filter((item) => ALLOWED_KEYS.has(item.key));

    if (operations.length === 0) {
      return res.status(400).json({ message: 'No valid keys supplied' });
    }

    await UserDataStore.bulkWrite(
      operations.map((item) => ({
        updateOne: {
          filter: { userId: req.user.id, key: item.key },
          update: { $set: { payload: item.payload } },
          upsert: true
        }
      }))
    );

    const updatedRows = await UserDataStore.find({
      userId: req.user.id,
      key: { $in: operations.map((item) => item.key) }
    })
      .select('key payload updatedAt')
      .lean();

    res.json({
      items: updatedRows.map((row) => ({
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
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ message: 'Unsupported key' });
    }

    await UserDataStore.deleteOne({ userId: req.user.id, key });
    res.json({ success: true });
  } catch (error) {
    console.error('User data delete error:', error);
    res.status(500).json({ message: 'Failed to delete user data' });
  }
});

module.exports = router;

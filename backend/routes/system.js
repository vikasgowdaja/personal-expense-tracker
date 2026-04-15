const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const { EXPECTED_COLLECTIONS, RENAME_SUGGESTIONS } = require('../config/collections');

const router = express.Router();

async function getExistingCollectionNames() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not ready');
  }

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  return collections.map((c) => c.name);
}

function buildCollectionStatus(existingNames) {
  const existingSet = new Set(existingNames);
  const expected = EXPECTED_COLLECTIONS.map((item) => ({
    ...item,
    exists: existingSet.has(item.collectionName)
  }));

  const unknown = existingNames.filter(
    (name) => !EXPECTED_COLLECTIONS.some((item) => item.collectionName === name)
  );

  return { expected, unknown };
}

router.get('/collections/status', requireAuth, requireRole('platform_owner'), async (req, res) => {
  try {
    const existingNames = await getExistingCollectionNames();
    const { expected, unknown } = buildCollectionStatus(existingNames);

    res.json({
      database: mongoose.connection.name,
      expected,
      unknown,
      renameSuggestions: RENAME_SUGGESTIONS.map((item) => ({
        ...item,
        canRename: existingNames.includes(item.from) && !existingNames.includes(item.to)
      }))
    });
  } catch (error) {
    console.error('Collection status error:', error);
    res.status(500).json({ message: 'Unable to fetch collection status' });
  }
});

router.post('/collections/ensure', requireAuth, requireRole('platform_owner'), async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: 'Database connection is not ready' });
    }

    const existingNames = await getExistingCollectionNames();
    const existingSet = new Set(existingNames);

    const created = [];
    for (const item of EXPECTED_COLLECTIONS) {
      if (!existingSet.has(item.collectionName)) {
        await db.createCollection(item.collectionName);
        created.push(item.collectionName);
      }
    }

    const refreshed = await getExistingCollectionNames();
    const status = buildCollectionStatus(refreshed);

    res.json({
      message: created.length ? 'Missing collections created' : 'All expected collections already exist',
      created,
      ...status
    });
  } catch (error) {
    console.error('Ensure collections error:', error);
    res.status(500).json({ message: 'Unable to ensure collections' });
  }
});

router.post('/collections/rename-suggested', requireAuth, requireRole('platform_owner'), async (req, res) => {
  try {
    const { confirmPhrase } = req.body || {};
    if (confirmPhrase !== 'RENAME_COLLECTIONS') {
      return res.status(400).json({
        message: 'Rename operation blocked. Send confirmPhrase="RENAME_COLLECTIONS" to proceed.'
      });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: 'Database connection is not ready' });
    }

    const existingNames = await getExistingCollectionNames();
    const existingSet = new Set(existingNames);

    const renamed = [];
    const skipped = [];

    for (const pair of RENAME_SUGGESTIONS) {
      const fromExists = existingSet.has(pair.from);
      const toExists = existingSet.has(pair.to);

      if (!fromExists) {
        skipped.push({ ...pair, reason: 'source-missing' });
        continue;
      }
      if (toExists) {
        skipped.push({ ...pair, reason: 'target-already-exists' });
        continue;
      }

      await db.collection(pair.from).rename(pair.to, { dropTarget: false });
      existingSet.delete(pair.from);
      existingSet.add(pair.to);
      renamed.push(pair);
    }

    res.json({
      message: renamed.length ? 'Suggested collection renames applied' : 'No rename was applied',
      renamed,
      skipped
    });
  } catch (error) {
    console.error('Rename collections error:', error);
    res.status(500).json({ message: 'Unable to rename collections' });
  }
});

module.exports = router;

require('dotenv').config();
const mongoose = require('mongoose');
const { EXPECTED_COLLECTIONS, RENAME_SUGGESTIONS } = require('../config/collections');

async function listExisting(db) {
  const rows = await db.listCollections({}, { nameOnly: true }).toArray();
  return rows.map((r) => r.name);
}

function printStatus(existing) {
  const set = new Set(existing);
  const expected = EXPECTED_COLLECTIONS.map((item) => ({
    ...item,
    exists: set.has(item.collectionName)
  }));

  console.log('Database:', mongoose.connection.name);
  console.log('Expected collections:');
  expected.forEach((item) => {
    console.log(`- ${item.collectionName} (${item.logicalName}) => ${item.exists ? 'present' : 'missing'}`);
  });

  const unknown = existing.filter(
    (name) => !EXPECTED_COLLECTIONS.some((item) => item.collectionName === name)
  );

  if (unknown.length) {
    console.log('Unmapped collections:');
    unknown.forEach((name) => console.log(`- ${name}`));
  }

  console.log('Rename suggestions:');
  RENAME_SUGGESTIONS.forEach((pair) => {
    const canRename = set.has(pair.from) && !set.has(pair.to);
    console.log(`- ${pair.from} -> ${pair.to} (${canRename ? 'ready' : 'skip'})`);
  });
}

async function ensureCollections(db) {
  const existing = await listExisting(db);
  const set = new Set(existing);
  const created = [];

  for (const item of EXPECTED_COLLECTIONS) {
    if (!set.has(item.collectionName)) {
      await db.createCollection(item.collectionName);
      created.push(item.collectionName);
      set.add(item.collectionName);
    }
  }

  if (!created.length) {
    console.log('All expected collections are already present.');
  } else {
    console.log('Created collections:');
    created.forEach((name) => console.log(`- ${name}`));
  }
}

async function renameSuggested(db) {
  const existing = await listExisting(db);
  const set = new Set(existing);
  const renamed = [];

  for (const pair of RENAME_SUGGESTIONS) {
    const fromExists = set.has(pair.from);
    const toExists = set.has(pair.to);
    if (!fromExists || toExists) continue;

    await db.collection(pair.from).rename(pair.to, { dropTarget: false });
    set.delete(pair.from);
    set.add(pair.to);
    renamed.push(pair);
  }

  if (!renamed.length) {
    console.log('No suggested rename was applied.');
  } else {
    console.log('Applied renames:');
    renamed.forEach((pair) => console.log(`- ${pair.from} -> ${pair.to}`));
  }
}

async function run() {
  const command = process.argv[2] || 'status';
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  if (command === 'status') {
    const existing = await listExisting(db);
    printStatus(existing);
  } else if (command === 'ensure') {
    await ensureCollections(db);
  } else if (command === 'rename') {
    await renameSuggested(db);
  } else {
    console.log('Usage: node scripts/collectionsManager.js <status|ensure|rename>');
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Collections manager failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

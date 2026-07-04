require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Institution = require('../models/Institution');
const Client = require('../models/Client');
const Topic = require('../models/Topic');
const Trainer = require('../models/Trainer');
const PaymentDetails = require('../models/PaymentDetails');
const TrainingEngagement = require('../models/TrainingEngagement');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');

const DEMO_TAG = '[DEMO_SEED_2026]';
const RUN_COLLECTION = 'demo_seed_runs';
const STATUS_FLOW = ['Planned', 'Ongoing', 'Completed', 'Invoiced', 'Paid'];
const args = process.argv.slice(2);

function generateRunId() {
  return `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function getArgValue(flag) {
  const idx = args.findIndex((a) => a === flag);
  if (idx === -1) return '';
  return args[idx + 1] || '';
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(p) {
  return Math.random() < p;
}

function buildEmail(base, seed) {
  const normalized = String(base || 'trainer').toLowerCase().replace(/[^a-z0-9]+/g, '.');
  return `${normalized}.${seed}@demo.local`;
}

function uniqueName(base, i) {
  return `Demo ${base} ${String(i + 1).padStart(2, '0')}`;
}

function isoDateOffset(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getConnectionIdForEmployee(employee, superadminId) {
  const link = (employee.connections || []).find(
    (c) => String(c.superadminId) === String(superadminId) && c.isActive !== false
  );
  return link ? link.connectionId : '';
}

function emptyCreatedIds() {
  return {
    institutions: [],
    clients: [],
    topics: [],
    trainers: [],
    paymentDetails: [],
    engagements: [],
    invoices: [],
    expenses: []
  };
}

async function insertSeedRunDocument(doc) {
  await mongoose.connection.collection(RUN_COLLECTION).insertOne(doc);
}

async function getSeedRunDocument(runId) {
  return mongoose.connection.collection(RUN_COLLECTION).findOne({ runId });
}

async function listSeedRuns(limit = 20) {
  return mongoose.connection
    .collection(RUN_COLLECTION)
    .find({}, { projection: { _id: 0, runId: 1, createdAt: 1, mode: 1, superadminCount: 1, removedAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

async function markRunRemoved(runId) {
  await mongoose.connection.collection(RUN_COLLECTION).updateOne(
    { runId },
    { $set: { removedAt: new Date() } }
  );
}

async function clearExistingDemoForUser(userId) {
  const demoTrainers = await Trainer.find({ user: userId, email: /@demo\.local$/i }).select('_id').lean();
  const trainerIds = demoTrainers.map((t) => t._id);

  const demoEngagements = await TrainingEngagement.find({
    ownerSuperadminId: userId,
    notes: { $regex: DEMO_TAG, $options: 'i' }
  }).select('_id').lean();
  const demoEngagementIds = demoEngagements.map((e) => e._id);

  await Promise.all([
    trainerIds.length
      ? PaymentDetails.deleteMany({ user: userId, trainerId: { $in: trainerIds } })
      : Promise.resolve(),
    Trainer.deleteMany({ user: userId, email: /@demo\.local$/i }),
    demoEngagementIds.length
      ? Invoice.deleteMany({
          $or: [
            { user: userId, invoiceNumber: /^DEMO-/ },
            { trainingEngagementId: { $in: demoEngagementIds } }
          ]
        })
      : Invoice.deleteMany({ user: userId, invoiceNumber: /^DEMO-/ }),
    TrainingEngagement.deleteMany({
      ownerSuperadminId: userId,
      notes: { $regex: DEMO_TAG, $options: 'i' }
    }),
    Topic.deleteMany({ user: userId, name: /^Demo / }),
    Institution.deleteMany({ user: userId, name: /^Demo / }),
    Client.deleteMany({ user: userId, name: /^Demo / }),
    Expense.deleteMany({ user: userId, $or: [{ title: /^Demo / }, { description: { $regex: DEMO_TAG, $options: 'i' } }] })
  ]);
}

async function seedForSuperadmin(superadmin, globalPools, runId) {
  const result = {
    superadmin: superadmin.email,
    superadminId: String(superadmin._id),
    institutions: 0,
    clients: 0,
    topics: 0,
    trainers: 0,
    paymentDetails: 0,
    engagements: 0,
    invoices: 0,
    expenses: 0,
    createdIds: emptyCreatedIds()
  };

  await clearExistingDemoForUser(superadmin._id);

  const topicSeeds = globalPools.topics.length
    ? globalPools.topics.slice(0, 10)
    : ['Java', 'Python', 'React', 'Node.js', 'Data Analytics', 'SQL'];
  const citySeeds = globalPools.locations.length
    ? globalPools.locations.slice(0, 10)
    : ['Bengaluru', 'Mysuru', 'Hyderabad', 'Chennai', 'Pune'];
  const orgSeeds = globalPools.clientNames.length
    ? globalPools.clientNames.slice(0, 10)
    : ['SkillBridge', 'Edvanta', 'TechLearn', 'FutureWorks'];
  const trainerNameSeeds = globalPools.trainerNames.length
    ? globalPools.trainerNames.slice(0, 12)
    : ['Arjun Rao', 'Sneha Iyer', 'Nisha Verma', 'Rohan Das', 'Meera Singh'];

  const institutions = [];
  for (let i = 0; i < 6; i += 1) {
    const row = await Institution.create({
      user: superadmin._id,
      name: uniqueName(`Institute ${pick(citySeeds)}`, i),
      location: pick(citySeeds),
      contactPerson: `Coordinator ${i + 1} ${runId}`,
      contactEmail: `coord${i + 1}.${String(superadmin._id).slice(-5)}@demo.local`,
      contactPhone: `9${randInt(100000000, 999999999)}`
    });
    institutions.push(row);
    result.institutions += 1;
    result.createdIds.institutions.push(String(row._id));
  }

  const clients = [];
  for (let i = 0; i < 6; i += 1) {
    const row = await Client.create({
      user: superadmin._id,
      name: uniqueName(`${pick(orgSeeds)} Org`, i),
      contactPerson: `Client SPOC ${i + 1}`,
      email: `client${i + 1}.${String(superadmin._id).slice(-5)}@demo.local`,
      phone: `8${randInt(100000000, 999999999)}`,
      billingAddress: `${pick(citySeeds)} - Demo Block ${i + 1}`
    });
    clients.push(row);
    result.clients += 1;
    result.createdIds.clients.push(String(row._id));
  }

  for (let i = 0; i < Math.min(8, topicSeeds.length); i += 1) {
    const topic = await Topic.create({
      user: superadmin._id,
      name: uniqueName(topicSeeds[i], i),
      description: `${DEMO_TAG} ${runId} Demo topic for showcase`,
      isActive: true
    });
    result.topics += 1;
    result.createdIds.topics.push(String(topic._id));
  }

  const trainers = [];
  for (let i = 0; i < 8; i += 1) {
    const nameSeed = trainerNameSeeds[i % trainerNameSeeds.length];
    const trainer = await Trainer.create({
      user: superadmin._id,
      fullName: `Demo ${nameSeed}`,
      email: buildEmail(nameSeed, `${String(superadmin._id).slice(-4)}.${i + 1}`),
      phone: `7${randInt(100000000, 999999999)}`,
      yearsOfExperience: randInt(2, 14),
      specialization: pick(topicSeeds)
    });
    trainers.push(trainer);
    result.trainers += 1;
    result.createdIds.trainers.push(String(trainer._id));

    if (chance(0.75)) {
      const payment = await PaymentDetails.create({
        user: superadmin._id,
        trainerId: trainer._id,
        bankName: pick(['HDFC Bank', 'ICICI Bank', 'SBI']),
        accountNumber: `${randInt(10000000, 99999999)}${randInt(1000, 9999)}`,
        ifscCode: `DEMO0${randInt(1000, 9999)}`,
        upiId: `demo${i + 1}@upi`,
        panNumber: `ABCDE${randInt(1000, 9999)}F`
      });
      result.paymentDetails += 1;
      result.createdIds.paymentDetails.push(String(payment._id));
    }
  }

  const connectedEmployees = await User.find({
    role: 'employee',
    connections: {
      $elemMatch: {
        superadminId: superadmin._id,
        isActive: true
      }
    }
  })
    .select('_id employeeId name connections')
    .lean();

  let invoiceCounter = 1;
  for (let i = 0; i < 20; i += 1) {
    const startBack = randInt(5, 140);
    const duration = randInt(1, 5);
    const startDate = isoDateOffset(startBack);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + duration - 1);

    let sourceUser = superadmin;
    if (connectedEmployees.length && chance(0.45)) {
      sourceUser = pick(connectedEmployees);
    }

    const assigned = [pick(trainers), pick(trainers)].filter((v, idx, arr) => arr.findIndex((x) => String(x._id) === String(v._id)) === idx);

    const engagement = await TrainingEngagement.create({
      user: sourceUser._id,
      ownerSuperadminId: superadmin._id,
      connectionId:
        String(sourceUser._id) === String(superadmin._id)
          ? superadmin.defaultConnectionId || `SA-${String(superadmin._id).slice(-6).toUpperCase()}`
          : getConnectionIdForEmployee(sourceUser, superadmin._id),
      sourcedByUserId: sourceUser._id,
      institutionId: pick(institutions)._id,
      clientId: pick(clients)._id,
      engagementTitle: `Demo Engagement ${i + 1}`,
      startDate,
      endDate,
      trainers: assigned.map((t) => ({
        trainerId: t._id,
        subjectArea: pick(topicSeeds),
        trainingTopic: pick(topicSeeds),
        dailyRate: randInt(2200, 9500)
      })),
      status: pick(STATUS_FLOW),
      notes: `${DEMO_TAG} ${runId} seeded engagement`,
      sourcedBy: sourceUser.employeeId || sourceUser.name || '',
      sourcedByName: sourceUser.name || ''
    });

    result.engagements += 1;
    result.createdIds.engagements.push(String(engagement._id));

    if (chance(0.72)) {
      const invoice = await Invoice.create({
        user: superadmin._id,
        invoiceNumber: `DEMO-${String(superadmin._id).slice(-4).toUpperCase()}-${String(invoiceCounter).padStart(4, '0')}-${runId.slice(-4)}`,
        trainingEngagementId: engagement._id,
        invoiceDate: new Date(endDate),
        dueDate: new Date(endDate.getTime() + 15 * 86400000),
        paymentTerms: 'Net 15',
        subtotal: Number(engagement.totalAmount || 0),
        taxAmount: 0,
        totalDue: Number(engagement.totalAmount || 0),
        status: pick(['Draft', 'Sent', 'Paid', 'Overdue'])
      });
      invoiceCounter += 1;
      result.invoices += 1;
      result.createdIds.invoices.push(String(invoice._id));
    }
  }

  for (let i = 0; i < 16; i += 1) {
    const expense = await Expense.create({
      user: superadmin._id,
      title: `Demo Expense ${i + 1}`,
      amount: randInt(300, 8500),
      category: pick(['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Other']),
      date: isoDateOffset(randInt(1, 90)),
      description: `${DEMO_TAG} ${runId} operational expense`
    });
    result.expenses += 1;
    result.createdIds.expenses.push(String(expense._id));
  }

  return result;
}

async function removeSeedRun(runId) {
  const run = await getSeedRunDocument(runId);
  if (!run) {
    throw new Error(`No seed run found for runId: ${runId}`);
  }
  if (run.removedAt) {
    console.log(`Run ${runId} is already marked removed at ${new Date(run.removedAt).toISOString()}.`);
    return;
  }

  const allIds = emptyCreatedIds();
  for (const perSa of run.superadmins || []) {
    const created = perSa.createdIds || {};
    Object.keys(allIds).forEach((k) => {
      allIds[k].push(...(created[k] || []));
    });
  }

  const toObjectIds = (arr) => arr.map((id) => new mongoose.Types.ObjectId(id));

  await Promise.all([
    allIds.paymentDetails.length
      ? PaymentDetails.deleteMany({ _id: { $in: toObjectIds(allIds.paymentDetails) } })
      : Promise.resolve(),
    allIds.invoices.length
      ? Invoice.deleteMany({ _id: { $in: toObjectIds(allIds.invoices) } })
      : Promise.resolve(),
    allIds.engagements.length
      ? TrainingEngagement.deleteMany({ _id: { $in: toObjectIds(allIds.engagements) } })
      : Promise.resolve(),
    allIds.trainers.length
      ? Trainer.deleteMany({ _id: { $in: toObjectIds(allIds.trainers) } })
      : Promise.resolve(),
    allIds.topics.length
      ? Topic.deleteMany({ _id: { $in: toObjectIds(allIds.topics) } })
      : Promise.resolve(),
    allIds.institutions.length
      ? Institution.deleteMany({ _id: { $in: toObjectIds(allIds.institutions) } })
      : Promise.resolve(),
    allIds.clients.length
      ? Client.deleteMany({ _id: { $in: toObjectIds(allIds.clients) } })
      : Promise.resolve(),
    allIds.expenses.length
      ? Expense.deleteMany({ _id: { $in: toObjectIds(allIds.expenses) } })
      : Promise.resolve()
  ]);

  await markRunRemoved(runId);
  console.log(`Removed seed run ${runId}.`);
}

async function buildGlobalPools() {
  const [topics, institutions, clients, trainers] = await Promise.all([
    Topic.find({ name: { $not: /^Demo / } }).select('name').lean(),
    Institution.find({ name: { $not: /^Demo / } }).select('name location').lean(),
    Client.find({ name: { $not: /^Demo / } }).select('name').lean(),
    Trainer.find({ email: { $not: /@demo\.local$/i } }).select('fullName').lean()
  ]);

  return {
    topics: [...new Set(topics.map((x) => String(x.name || '').trim()).filter(Boolean))],
    locations: [...new Set(institutions.map((x) => String(x.location || '').trim()).filter(Boolean))],
    clientNames: [...new Set(clients.map((x) => String(x.name || '').trim()).filter(Boolean))],
    trainerNames: [...new Set(trainers.map((x) => String(x.fullName || '').trim()).filter(Boolean))]
  };
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  if (args.includes('--list-runs')) {
    const runs = await listSeedRuns(30);
    if (!runs.length) {
      console.log('No tracked seed runs found.');
    } else {
      runs.forEach((r) => {
        console.log(`- ${r.runId} | createdAt=${new Date(r.createdAt).toISOString()} | superadmins=${r.superadminCount || 0} | removedAt=${r.removedAt ? new Date(r.removedAt).toISOString() : 'active'}`);
      });
    }
    await mongoose.disconnect();
    return;
  }

  const hasRemoveFlag = args.includes('--remove-run');
  const removeRunId = getArgValue('--remove-run');
  if (hasRemoveFlag && !removeRunId) {
    console.log('Usage: node scripts/seedDemoData.js --remove-run <RUN_ID>');
    await mongoose.disconnect();
    return;
  }
  if (removeRunId) {
    await removeSeedRun(removeRunId);
    await mongoose.disconnect();
    return;
  }

  const globalPools = await buildGlobalPools();

  const superadmins = await User.find({ role: 'superadmin' })
    .select('_id email name defaultConnectionId')
    .lean();

  if (!superadmins.length) {
    console.log('No superadmins found. Seed skipped.');
    await mongoose.disconnect();
    return;
  }

  const runId = generateRunId();
  const summary = [];
  for (const sa of superadmins) {
    const seeded = await seedForSuperadmin(sa, globalPools, runId);
    summary.push(seeded);
  }

  await insertSeedRunDocument({
    runId,
    mode: 'seed-demo',
    createdAt: new Date(),
    superadminCount: summary.length,
    superadmins: summary,
    notes: `${DEMO_TAG} tracked seed run`
  });

  console.log('Demo seed complete.');
  console.log(`Seed run ID: ${runId}`);
  console.log('Platform Owner records were not modified.');
  summary.forEach((row) => {
    console.log(`- ${row.superadmin}: institutions=${row.institutions}, clients=${row.clients}, topics=${row.topics}, trainers=${row.trainers}, paymentDetails=${row.paymentDetails}, engagements=${row.engagements}, invoices=${row.invoices}, expenses=${row.expenses}`);
  });

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Seed failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

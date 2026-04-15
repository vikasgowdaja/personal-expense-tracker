const EXPECTED_COLLECTIONS = [
  { logicalName: 'users', collectionName: 'users', purpose: 'auth and role hierarchy' },
  { logicalName: 'expenses', collectionName: 'expenses', purpose: 'expense tracking' },
  { logicalName: 'categories', collectionName: 'categories', purpose: 'expense categories' },
  { logicalName: 'clients', collectionName: 'clients', purpose: 'organizations and clients' },
  { logicalName: 'institutions', collectionName: 'institutions', purpose: 'colleges and institutions' },
  { logicalName: 'trainers', collectionName: 'trainers', purpose: 'trainer profiles' },
  { logicalName: 'topics', collectionName: 'topics', purpose: 'training topics' },
  { logicalName: 'training_engagements', collectionName: 'trainingengagements', purpose: 'training engagement records' },
  { logicalName: 'invoices', collectionName: 'invoices', purpose: 'invoice records' },
  { logicalName: 'payment_details', collectionName: 'paymentdetails', purpose: 'trainer payment details' },
  { logicalName: 'processed_data', collectionName: 'processeddatas', purpose: 'OCR/AI processed data' },
  { logicalName: 'user_data_store', collectionName: 'userdatastores', purpose: 'db-backed cache payloads' },
  { logicalName: 'demo_seed_runs', collectionName: 'demo_seed_runs', purpose: 'seed run tracking and rollback' }
];

const RENAME_SUGGESTIONS = [
  { from: 'trainingengagements', to: 'training_engagements' },
  { from: 'paymentdetails', to: 'payment_details' },
  { from: 'processeddatas', to: 'processed_data' },
  { from: 'userdatastores', to: 'user_data_store' }
];

module.exports = {
  EXPECTED_COLLECTIONS,
  RENAME_SUGGESTIONS
};

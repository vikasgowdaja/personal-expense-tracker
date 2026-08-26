const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const UserSetting = require('../models/UserSetting');
const SettingItem = require('../models/SettingItem');
const defaults = require('../config/settingsDefaults');

const router = express.Router();
const settingNamespaces = new Set([
  'preferences', 'locale', 'notifications', 'notifications/email', 'notifications/push',
  'notifications/reminders', 'notifications/alerts', 'reports/preferences', 'integrations/api'
]);
const resourceNamespaces = new Set([
  'expenses/categories', 'income/sources', 'budget/budgets', 'integrations/accounts', 'workspace/members'
]);
const forbiddenKeys = new Set(['password', 'token', 'secret', 'apiKey', 'clientSecret', 'refreshToken']);
const resourceFields = ['name', 'description', 'status', 'color', 'icon', 'parentId', 'metadata'];

function fail(res, status, message, details) {
  return res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!plainObject(value)) return false;
  return Object.entries(value).some(([key, child]) => forbiddenKeys.has(key) || hasSensitiveKey(child));
}

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function checkValidation(req, res) {
  const errors = validationResult(req);
  return errors.isEmpty() ? false : fail(res, 400, 'Validation failed', errors.array());
}

function resourcePayload(input) {
  return Object.fromEntries(resourceFields
    .filter((field) => Object.prototype.hasOwnProperty.call(input, field))
    .map((field) => [field, input[field]]));
}

function checkResourceNamespace(req, res) {
  return resourceNamespaces.has(req.params.namespace) || fail(res, 404, 'Unknown resource namespace');
}

// Resource routes precede setting routes because namespaces may contain slashes.
router.get('/resources/:namespace(*)', auth, async (req, res) => {
  if (!checkResourceNamespace(req, res)) return;
  try {
    const filter = { userId: req.user.id, namespace: req.params.namespace };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) filter.name = { $regex: String(req.query.search).slice(0, 100), $options: 'i' };
    const items = await SettingItem.find(filter).sort({ name: 1 }).lean();
    return res.json({ namespace: req.params.namespace, items });
  } catch (error) {
    return fail(res, 500, 'Unable to load settings resources');
  }
});

router.post('/resources/:namespace(*)', [auth, body('name').isString().trim().isLength({ min: 1, max: 200 })], async (req, res) => {
  if (!checkResourceNamespace(req, res)) return;
  if (checkValidation(req, res) || hasSensitiveKey(req.body)) return hasSensitiveKey(req.body) ? fail(res, 400, 'Sensitive keys are not allowed in settings') : undefined;
  try {
    const payload = resourcePayload(req.body);
    if (payload.parentId && (!validId(payload.parentId) || !(await SettingItem.exists({
      _id: payload.parentId, userId: req.user.id, namespace: req.params.namespace
    })))) return fail(res, 400, 'parentId must reference a resource in this namespace');
    const item = await SettingItem.create({ ...payload, userId: req.user.id, namespace: req.params.namespace });
    return res.status(201).json(item);
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, 'A resource with this name already exists');
    return fail(res, 400, 'Unable to create settings resource');
  }
});

router.put('/resources/:namespace(*)/:id', [auth, body('name').optional().isString().trim().isLength({ min: 1, max: 200 })], async (req, res) => {
  if (!checkResourceNamespace(req, res)) return;
  if (!validId(req.params.id)) return fail(res, 400, 'Invalid resource id');
  if (checkValidation(req, res)) return;
  if (hasSensitiveKey(req.body)) return fail(res, 400, 'Sensitive keys are not allowed in settings');
  const updates = resourcePayload(req.body);
  if (updates.parentId && (!validId(updates.parentId) || String(updates.parentId) === req.params.id)) {
    return fail(res, 400, 'parentId must be a valid resource other than itself');
  }
  try {
    if (updates.parentId && !(await SettingItem.exists({
      _id: updates.parentId, userId: req.user.id, namespace: req.params.namespace
    }))) return fail(res, 400, 'parentId must reference a resource in this namespace');
    const item = await SettingItem.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, namespace: req.params.namespace }, updates,
      { new: true, runValidators: true }
    );
    if (!item) return fail(res, 404, 'Settings resource not found');
    return res.json(item);
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, 'A resource with this name already exists');
    return fail(res, 400, 'Unable to update settings resource');
  }
});

async function setStatus(req, res, status) {
  if (!checkResourceNamespace(req, res)) return;
  if (!validId(req.params.id)) return fail(res, 400, 'Invalid resource id');
  try {
    const item = await SettingItem.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, namespace: req.params.namespace }, { status },
      { new: true, runValidators: true }
    );
    if (!item) return fail(res, 404, 'Settings resource not found');
    return res.json(item);
  } catch (error) {
    return fail(res, 400, 'Unable to update settings resource status');
  }
}

router.post('/resources/:namespace(*)/:id/archive', auth, (req, res) => setStatus(req, res, 'archived'));
router.post('/resources/:namespace(*)/:id/restore', auth, (req, res) => setStatus(req, res, 'active'));

router.delete('/resources/:namespace(*)/:id', auth, async (req, res) => {
  if (!checkResourceNamespace(req, res)) return;
  if (!validId(req.params.id)) return fail(res, 400, 'Invalid resource id');
  try {
    const item = await SettingItem.findOne({ _id: req.params.id, userId: req.user.id, namespace: req.params.namespace });
    if (!item) return fail(res, 404, 'Settings resource not found');
    if (item.usageCount > 0) return fail(res, 409, 'Resource has dependencies and cannot be deleted', { usageCount: item.usageCount });
    await item.deleteOne();
    return res.json({ message: 'Settings resource deleted' });
  } catch (error) {
    return fail(res, 500, 'Unable to delete settings resource');
  }
});

router.get('/security/sessions', auth, (req, res) => res.json({
  sessions: [{ id: 'current', userId: req.user.id, issuedAt: req.user.iat || null, expiresAt: req.user.exp || null }]
}));
router.delete('/security/sessions/:id', auth, (req, res) => fail(res, 501, 'Session revocation is not supported yet'));

router.post('/danger-zone/clear-user-data', auth, async (req, res) => {
  if (req.body.confirmation !== 'DELETE MY DATA') return fail(res, 400, "Confirmation must be exactly 'DELETE MY DATA'");
  try {
    const [items, userSettings] = await Promise.all([
      SettingItem.deleteMany({ userId: req.user.id }), UserSetting.deleteMany({ userId: req.user.id })
    ]);
    return res.json({ message: 'User settings data cleared', deleted: { settingItems: items.deletedCount, userSettings: userSettings.deletedCount } });
  } catch (error) {
    return fail(res, 500, 'Unable to clear user settings data');
  }
});

router.get('/:namespace(*)', auth, async (req, res) => {
  if (!settingNamespaces.has(req.params.namespace)) return fail(res, 404, 'Unknown settings namespace');
  try {
    const setting = await UserSetting.findOne({ userId: req.user.id, namespace: req.params.namespace }).lean();
    return res.json({ namespace: req.params.namespace, values: { ...(defaults[req.params.namespace] || {}), ...(setting?.values || {}) } });
  } catch (error) {
    return fail(res, 500, 'Unable to load settings');
  }
});

router.put('/:namespace(*)', auth, async (req, res) => {
  if (!settingNamespaces.has(req.params.namespace)) return fail(res, 404, 'Unknown settings namespace');
  const values = req.body.values;
  if (!plainObject(values) || hasSensitiveKey(values)) return fail(res, 400, 'Settings values must be an object and cannot contain sensitive keys');
  try {
    const current = req.body.replace === true || req.body.mode === 'replace'
      ? {} : (await UserSetting.findOne({ userId: req.user.id, namespace: req.params.namespace }).lean())?.values || {};
    const setting = await UserSetting.findOneAndUpdate(
      { userId: req.user.id, namespace: req.params.namespace }, { $set: { values: { ...current, ...values } } },
      { upsert: true, new: true, runValidators: true }
    );
    return res.json({ namespace: req.params.namespace, values: setting.values });
  } catch (error) {
    return fail(res, 400, 'Unable to update settings');
  }
});

module.exports = router;
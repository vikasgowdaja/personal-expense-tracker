import { userDataAPI } from './api';

const DB_BACKED_KEYS = [
  'training_engagements',
  'trainer_profiles',
  'trainer_settlements',
  'teaching_sessions',
  'daily_logs'
];

let initialized = false;
let isHydrating = false;
let nativeSetItem = null;
let nativeRemoveItem = null;
const syncTimers = new Map();

function hasAuthToken() {
  return Boolean(localStorage.getItem('token'));
}

function parseLocalValue(raw) {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function writeLocalWithoutSync(key, value) {
  if (!nativeSetItem) return;
  nativeSetItem.call(localStorage, key, value);
}

function removeLocalWithoutSync(key) {
  if (!nativeRemoveItem) return;
  nativeRemoveItem.call(localStorage, key);
}

function scheduleSync(key, rawValue) {
  if (!DB_BACKED_KEYS.includes(key)) return;
  if (!hasAuthToken()) return;

  const pending = syncTimers.get(key);
  if (pending) {
    clearTimeout(pending);
  }

  const pushNow = async () => {
    try {
      await userDataAPI.upsert(key, parseLocalValue(rawValue));
      syncTimers.delete(key);
    } catch {
      // Retry shortly if network/auth is temporarily unavailable.
      const retryTimer = setTimeout(pushNow, 1000);
      syncTimers.set(key, retryTimer);
    }
  };

  pushNow();
}

async function migrateLocalOnlyData(serverKeySet = new Set()) {
  const payloadItems = DB_BACKED_KEYS
    .filter((key) => !serverKeySet.has(key))
    .map((key) => ({ key, raw: localStorage.getItem(key) }))
    .filter((entry) => entry.raw !== null)
    .map((entry) => ({ key: entry.key, payload: parseLocalValue(entry.raw) }));

  if (payloadItems.length === 0) return;

  try {
    await userDataAPI.bulkUpsert(payloadItems);
  } catch {
    // Ignore migration failures; local data still exists.
  }
}

export async function initDbBackedStorage() {
  if (typeof window === 'undefined') return;

  if (!initialized) {
    const storageProto = Object.getPrototypeOf(window.localStorage);
    nativeSetItem = storageProto.setItem;
    nativeRemoveItem = storageProto.removeItem;

    storageProto.setItem = function setItemPatched(key, value) {
      nativeSetItem.call(this, key, value);
      if (this === window.localStorage && !isHydrating) {
        scheduleSync(String(key), value);
      }
    };

    storageProto.removeItem = function removeItemPatched(key) {
      nativeRemoveItem.call(this, key);
      if (this === window.localStorage && !isHydrating && DB_BACKED_KEYS.includes(String(key)) && hasAuthToken()) {
        userDataAPI.remove(String(key)).catch(() => {
          // Best effort delete; local key is already removed.
        });
      }
    };

    initialized = true;
  }

  if (!hasAuthToken()) return;

  try {
    const response = await userDataAPI.getAll(DB_BACKED_KEYS);
    const serverItems = Array.isArray(response.data?.items) ? response.data.items : [];
    const serverMap = new Map(serverItems.map((item) => [item.key, item.payload]));
    const serverKeySet = new Set(serverItems.map((item) => item.key));

    isHydrating = true;
    DB_BACKED_KEYS.forEach((key) => {
      if (serverMap.has(key)) {
        writeLocalWithoutSync(key, JSON.stringify(serverMap.get(key)));
      }
    });
    isHydrating = false;

    await migrateLocalOnlyData(serverKeySet);
  } catch {
    // If server fetch fails, app continues with localStorage only.
    isHydrating = false;
  }
}

export { DB_BACKED_KEYS };

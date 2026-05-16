const CACHE_KEY = 'mayatrack:cache:v1';
const CACHE_VERSION = 1;

const FAILED_WRITES_KEY = 'mayatrack:failed-writes:v1';

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== CACHE_VERSION) return null;
    if (!data.userId || !data.family) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveCache(snapshot) {
  try {
    const payload = JSON.stringify({ version: CACHE_VERSION, ...snapshot });
    localStorage.setItem(CACHE_KEY, payload);
  } catch (err) {
    console.warn('cache: save failed', err);
  }
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// Failed writes: persisted across reloads so a user can't lose a record by
// closing the tab while a save was failing. Each entry has enough info to
// retry the original Firestore operation later.
export function loadFailedWrites() {
  try {
    const raw = localStorage.getItem(FAILED_WRITES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveFailedWrites(list) {
  try {
    if (!list || list.length === 0) {
      localStorage.removeItem(FAILED_WRITES_KEY);
      return;
    }
    localStorage.setItem(FAILED_WRITES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('cache: failed-writes save failed', err);
  }
}

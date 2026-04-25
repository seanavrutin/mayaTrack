const CACHE_KEY = 'mayatrack:cache:v1';
const CACHE_VERSION = 1;

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

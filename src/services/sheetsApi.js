const DEFAULT_URL =
  'https://script.google.com/macros/s/AKfycbxrS8UBdBt8U4z3-QaR30rDp4z-VC2Mzm_RUsajIC8p1KbxWOGpgOqcth5RmJnhjNVIHA/exec';
const URL_KEY = 'maya-script-url';

function getUrl() {
  return localStorage.getItem(URL_KEY) || DEFAULT_URL;
}

export function isConfigured() {
  return true;
}

export function setScriptUrl(url) {
  localStorage.setItem(URL_KEY, url.trim());
}

export function clearScriptUrl() {
  localStorage.removeItem(URL_KEY);
}

function toBool(v) {
  return v === true || v === 'TRUE' || v === 'true';
}

export async function fetchAll() {
  const res = await fetch(getUrl(), { redirect: 'follow' });
  const data = await res.json();

  const settingsObj = {};
  (data.settings || []).forEach((s) => {
    settingsObj[s.key] = Number(s.value) || s.value;
  });

  return {
    feeding: (data.feeding || []).reverse().map((e) => ({
      ...e,
      formula: Number(e.formula) || 0,
      pumpedMilk: Number(e.pumpedMilk) || 0,
      breastfeedingMinutes: Number(e.breastfeedingMinutes) || 0,
    })),
    diaper: (data.diaper || []).reverse().map((e) => ({
      ...e,
      pee: toBool(e.pee),
      poop: toBool(e.poop),
      empty: toBool(e.empty),
    })),
    pumping: (data.pumping || []).reverse().map((e) => ({
      ...e,
      durationMinutes: Number(e.durationMinutes) || 0,
    })),
    vitaminD: (data.vitaminD || []).reverse(),
    settings: {
      feedingIntervalMinutes: settingsObj.feedingIntervalMinutes || 180,
      pumpingIntervalMinutes: settingsObj.pumpingIntervalMinutes || 180,
    },
  };
}

async function post(payload) {
  await fetch(getUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
}

export function addEntry(sheet, data) {
  return post({ action: 'add', sheet, data });
}

export function deleteEntry(sheet, id) {
  return post({ action: 'delete', sheet, id });
}

export function updateSetting(key, value) {
  return post({ action: 'updateSetting', key, value });
}

// Helpers shared by SleepPill, Summary, and SidePanel. The data model is
// "one Firestore doc per sleep session" with endTime=null meaning the
// session is currently in progress. All derivations work off that.

export function getActiveSleep(sleepEntries) {
  if (!Array.isArray(sleepEntries)) return null;
  // Prefer the most-recent start time among open sessions in case a race
  // condition created more than one.
  let best = null;
  for (const e of sleepEntries) {
    if (!e || e.endTime) continue;
    if (!e.startTime) continue;
    if (!best || new Date(e.startTime).getTime() > new Date(best.startTime).getTime()) {
      best = e;
    }
  }
  return best;
}

export function getLastCompletedSleep(sleepEntries) {
  if (!Array.isArray(sleepEntries)) return null;
  let best = null;
  for (const e of sleepEntries) {
    if (!e || !e.endTime) continue;
    if (!best || new Date(e.endTime).getTime() > new Date(best.endTime).getTime()) {
      best = e;
    }
  }
  return best;
}

export function sleepDurationMs(entry, nowMs) {
  if (!entry || !entry.startTime) return 0;
  const start = new Date(entry.startTime).getTime();
  const end = entry.endTime ? new Date(entry.endTime).getTime() : nowMs;
  return Math.max(0, end - start);
}

export function formatDurationHM(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} דק׳`;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function formatDurationLongHM(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} דק׳`;
  if (m === 0) return `${h} שע׳`;
  return `${h} שע׳ ${m} דק׳`;
}

export function awakeSinceMs(sleepEntries, nowMs) {
  const lastSleep = getLastCompletedSleep(sleepEntries);
  if (!lastSleep || !lastSleep.endTime) return null;
  return Math.max(0, nowMs - new Date(lastSleep.endTime).getTime());
}

// Total sleep in the last `windowMs` milliseconds (closed segments only — for
// the active session we count whatever portion falls inside the window).
export function sleepInWindow(sleepEntries, nowMs, windowMs) {
  if (!Array.isArray(sleepEntries)) return 0;
  const windowStart = nowMs - windowMs;
  let total = 0;
  for (const e of sleepEntries) {
    if (!e?.startTime) continue;
    const start = new Date(e.startTime).getTime();
    const end = e.endTime ? new Date(e.endTime).getTime() : nowMs;
    const overlapStart = Math.max(start, windowStart);
    const overlapEnd = Math.min(end, nowMs);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
}

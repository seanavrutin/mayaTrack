// Helpers shared by SleepPill, Summary, SidePanel, and GraphModal.
// Data model: one Firestore doc per sleep session; endTime=null = in progress.
// Optional `period: 'day' | 'night'` tags naps vs overnight sleep. A "sleep day"
// is wake-after-night → next wake-after-night (daytime + its night).
// Legacy docs without `period` still work: period is inferred, and graph day
// boundaries ignore short overnight fragments so old data does not shatter.

export const SLEEP_PERIOD_DAY = 'day';
export const SLEEP_PERIOD_NIGHT = 'night';

/** Min duration for a legacy (untagged) session to close a sleep-day window. */
const LEGACY_NIGHT_BOUNDARY_MS = 3 * 3_600_000;

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

/**
 * Resolve day/night for an entry.
 * Explicit `period` always wins. Legacy docs without it are inferred from
 * duration (long → night) then start hour — never throws / never requires migration.
 */
export function getSleepPeriod(entry, nowMs = Date.now()) {
  if (entry?.period === SLEEP_PERIOD_DAY || entry?.period === SLEEP_PERIOD_NIGHT) {
    return entry.period;
  }
  if (!entry?.startTime) return SLEEP_PERIOD_NIGHT;
  const duration = sleepDurationMs(entry, nowMs);
  // Long sessions are overnight even if started mid-afternoon.
  if (duration >= LEGACY_NIGHT_BOUNDARY_MS) return SLEEP_PERIOD_NIGHT;
  const h = new Date(entry.startTime).getHours();
  if (h >= 17 || h < 8) return SLEEP_PERIOD_NIGHT;
  return SLEEP_PERIOD_DAY;
}

/**
 * Whether this completed session should close a sleep-day (wake boundary).
 * Explicit night always counts. Legacy inferred nights only count when long
 * enough, so brief overnight stirs do not split the graph.
 */
export function isNightSleepBoundary(entry, nowMs = Date.now()) {
  if (!entry?.startTime || !entry.endTime) return false;
  if (entry.period === SLEEP_PERIOD_DAY) return false;
  if (entry.period === SLEEP_PERIOD_NIGHT) return true;
  // Untagged legacy: only long overnight sleeps define day boundaries.
  return getSleepPeriod(entry, nowMs) === SLEEP_PERIOD_NIGHT
    && sleepDurationMs(entry, nowMs) >= LEGACY_NIGHT_BOUNDARY_MS;
}

/** Sensible default for the day/night toggle from the current clock. */
export function inferDefaultPeriod(nowMs) {
  const h = new Date(nowMs).getHours();
  if (h >= 17 || h < 8) return SLEEP_PERIOD_NIGHT;
  return SLEEP_PERIOD_DAY;
}

export function periodLabelHe(period) {
  return period === SLEEP_PERIOD_DAY ? 'יום' : 'לילה';
}

/** Calendar midnight→midnight windows — fallback when no night boundaries exist. */
function computeCalendarDayWindows(sleepEntries, nowMs) {
  const times = [];
  for (const e of sleepEntries) {
    if (!e?.startTime) continue;
    times.push(new Date(e.startTime).getTime());
    if (e.endTime) times.push(new Date(e.endTime).getTime());
  }
  if (!times.length) return [];

  const earliest = Math.min(...times);
  const latest = Math.max(...times, nowMs);

  const startDay = new Date(earliest);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(latest);
  endDay.setHours(0, 0, 0, 0);

  const windows = [];
  const cursor = new Date(startDay);
  while (cursor.getTime() <= endDay.getTime()) {
    const startMs = cursor.getTime();
    const next = new Date(cursor);
    next.setDate(next.getDate() + 1);
    const endMs = next.getTime();
    const isCurrent = startMs <= nowMs && nowMs < endMs;
    windows.push({
      startMs,
      endMs: isCurrent ? Math.max(nowMs, startMs + 1) : endMs,
      labelDate: new Date(startMs),
      isCurrent,
      calendarFallback: true,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return windows.reverse();
}

/**
 * Build sleep-day windows: each spans wake-after-night → next wake-after-night
 * (daytime + its night). Labeled by the calendar date of the starting wake.
 * Returns newest-first. If no night boundaries can be found (common for
 * untagged legacy data), falls back to calendar days so the graph stays usable.
 */
export function computeSleepDayWindows(sleepEntries, nowMs) {
  if (!Array.isArray(sleepEntries) || !sleepEntries.length) return [];

  const nights = sleepEntries
    .filter((e) => isNightSleepBoundary(e, nowMs))
    .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());

  if (nights.length === 0) {
    return computeCalendarDayWindows(sleepEntries, nowMs);
  }

  const windows = [];

  for (let i = 0; i < nights.length; i++) {
    const night = nights[i];
    const endMs = new Date(night.endTime).getTime();
    let startMs;
    if (i > 0) {
      startMs = new Date(nights[i - 1].endTime).getTime();
    } else {
      // No prior wake on record — start at the earliest session in this cycle,
      // capped so we don't pull in ancient history.
      const nightStart = new Date(night.startTime).getTime();
      const candidates = sleepEntries
        .filter((e) => e?.startTime && new Date(e.startTime).getTime() < endMs)
        .map((e) => new Date(e.startTime).getTime());
      const earliest = candidates.length ? Math.min(...candidates) : nightStart;
      startMs = Math.max(earliest, endMs - 36 * 3_600_000, nightStart - 18 * 3_600_000);
    }
    if (endMs <= startMs) continue;
    windows.push({
      startMs,
      endMs,
      labelDate: new Date(startMs),
      isCurrent: false,
    });
  }

  // Ongoing sleep-day after the last night wake.
  const lastWake = new Date(nights[nights.length - 1].endTime).getTime();
  if (nowMs >= lastWake) {
    windows.push({
      startMs: lastWake,
      endMs: Math.max(nowMs, lastWake + 1),
      labelDate: new Date(lastWake),
      isCurrent: true,
    });
  }

  // Newest first for offset navigation.
  return windows.reverse();
}

/**
 * Clip sleep sessions into one sleep-day window. Positions are fractions of
 * the window duration (not a fixed calendar 24h).
 */
export function computeSleepDayRow(sleepEntries, window, nowMs) {
  const durationMs = Math.max(1, window.endMs - window.startMs);
  const segments = [];
  let totalMinutes = 0;
  let dayMinutes = 0;
  let nightMinutes = 0;

  for (const e of sleepEntries) {
    if (!e?.startTime) continue;
    const s = new Date(e.startTime).getTime();
    const en = e.endTime ? new Date(e.endTime).getTime() : nowMs;
    if (en <= s) continue;

    const segStartMs = Math.max(s, window.startMs);
    const segEndMs = Math.min(en, window.endMs);
    if (segEndMs <= segStartMs) continue;

    const minutes = Math.round((segEndMs - segStartMs) / 60_000);
    const period = getSleepPeriod(e, nowMs);
    totalMinutes += minutes;
    if (period === SLEEP_PERIOD_DAY) dayMinutes += minutes;
    else nightMinutes += minutes;

    segments.push({
      startFrac: (segStartMs - window.startMs) / durationMs,
      endFrac: (segEndMs - window.startMs) / durationMs,
      startMs: segStartMs,
      endMs: segEndMs,
      minutes,
      period,
      isOpen: !e.endTime && segEndMs === Math.min(en, window.endMs),
    });
  }

  segments.sort((a, b) => a.startFrac - b.startFrac);

  return {
    startMs: window.startMs,
    endMs: window.endMs,
    durationMs,
    labelDate: window.labelDate,
    isCurrent: Boolean(window.isCurrent),
    segments,
    totalMinutes,
    dayMinutes,
    nightMinutes,
  };
}

// Helpers shared by SleepPill, Summary, SidePanel, and GraphModal.
// Data model: one Firestore doc per sleep session; endTime=null = in progress.
//
// Day vs night comes from the user and nothing else: `period: 'day' | 'night'`,
// set from the sun/moon toggle. Nothing is inferred from clock hours or
// durations, and a session with no `period` is simply unmarked.
//
// Day boundaries are then derived from those tags rather than asked for
// separately: the night is over at the end of the last night sleep before the
// first day nap. A date with no such transition falls back to the calendar day,
// because guessing a wake time would be inventing user input.

export const SLEEP_PERIOD_DAY = 'day';
export const SLEEP_PERIOD_NIGHT = 'night';

// Only used to pre-position the toggle before the user commits; never to
// classify anything already stored.
const EVENING_START_H = 18;
const MORNING_START_H = 5;
const MAX_SLEEP_DAYS = 400;

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
 * The user's day/night marking for a session, or null when it was never
 * marked. Deliberately never guesses — an unmarked session stays unmarked
 * until someone sets it via the toggle or the table editor.
 */
export function getSleepPeriod(entry) {
  if (entry?.period === SLEEP_PERIOD_DAY) return SLEEP_PERIOD_DAY;
  if (entry?.period === SLEEP_PERIOD_NIGHT) return SLEEP_PERIOD_NIGHT;
  return null;
}

/** Where to park the toggle before the user commits. Not a classification. */
export function inferDefaultPeriod(nowMs) {
  const h = new Date(nowMs).getHours();
  if (h >= EVENING_START_H || h < MORNING_START_H) return SLEEP_PERIOD_NIGHT;
  return SLEEP_PERIOD_DAY;
}

export function periodLabelHe(period) {
  if (period === SLEEP_PERIOD_DAY) return 'יום';
  if (period === SLEEP_PERIOD_NIGHT) return 'לילה';
  return 'לא סומן';
}

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Where each day begins, derived entirely from the 🌙/☀️ tags: the night is over
 * when a night sleep ends and the next sleep is a day nap (or nothing has
 * followed yet). One night sleep followed by another is the same night, so
 * waking at 03:00 and settling back 20 minutes later never starts a day.
 *
 * Keyed by the calendar date of the wake, earliest wins — a mistagged evening
 * nap can then never push a date's start into the night.
 */
function dayStartsByDate(sleepEntries) {
  const sorted = sleepEntries
    .filter((e) => e?.startTime)
    .slice()
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const dayStarts = new Map();
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (!e.endTime || getSleepPeriod(e) !== SLEEP_PERIOD_NIGHT) continue;
    const endMs = new Date(e.endTime).getTime();
    if (!(endMs > new Date(e.startTime).getTime())) continue;

    const next = sorted[i + 1];
    if (next && getSleepPeriod(next) !== SLEEP_PERIOD_DAY) continue;

    const key = dayKey(endMs);
    if (!dayStarts.has(key) || endMs < dayStarts.get(key)) dayStarts.set(key, endMs);
  }
  return dayStarts;
}

/**
 * Build sleep-day windows — one per calendar date, each running from that day's
 * wake through the next day's wake, so a day covers the daytime plus its night.
 * Dates with no night→day transition to derive a wake from fall back to the
 * calendar day rather than a guessed hour. Anchoring on dates also guarantees
 * pages stay ~24h and today always has one. Returns newest-first.
 */
export function computeSleepDayWindows(sleepEntries, nowMs) {
  if (!Array.isArray(sleepEntries) || !sleepEntries.length) return [];

  const starts = sleepEntries
    .filter((e) => e?.startTime)
    .map((e) => new Date(e.startTime).getTime());
  if (!starts.length) return [];

  const wakes = dayStartsByDate(sleepEntries);
  // Midnight is the honest fallback: with no night sleep tagged that morning we
  // don't know when her day began, so we don't pretend to.
  const boundaryFor = (dayDate) => wakes.get(dayKey(dayDate.getTime())) ?? dayDate.getTime();
  const isWake = (dayDate) => wakes.has(dayKey(dayDate.getTime()));

  const firstDay = startOfDay(Math.min(...starts));
  const lastDay = startOfDay(nowMs);
  const oldestAllowed = new Date(lastDay);
  oldestAllowed.setDate(oldestAllowed.getDate() - (MAX_SLEEP_DAYS - 1));
  const cursor = firstDay.getTime() < oldestAllowed.getTime() ? oldestAllowed : firstDay;

  const windows = [];
  for (const day = new Date(cursor); day.getTime() <= lastDay.getTime(); day.setDate(day.getDate() + 1)) {
    const startMs = boundaryFor(day);
    // The day hasn't begun yet — she's still inside the previous day's night.
    if (nowMs < startMs) continue;

    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const rawEndMs = boundaryFor(nextDay);
    if (rawEndMs <= startMs) continue;

    const isCurrent = nowMs < rawEndMs;
    const endMs = isCurrent ? Math.max(nowMs, startMs + 1) : rawEndMs;
    windows.push({
      startMs,
      endMs,
      labelDate: new Date(day),
      isCurrent,
      // Lets the chart distinguish a real wake from the midnight fallback.
      startsAtWake: isWake(day),
      endsAtWake: !isCurrent && isWake(nextDay),
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
  let unmarkedMinutes = 0;

  for (const e of sleepEntries) {
    if (!e?.startTime) continue;
    const s = new Date(e.startTime).getTime();
    const en = e.endTime ? new Date(e.endTime).getTime() : nowMs;
    if (en <= s) continue;

    const segStartMs = Math.max(s, window.startMs);
    const segEndMs = Math.min(en, window.endMs);
    if (segEndMs <= segStartMs) continue;

    const minutes = Math.round((segEndMs - segStartMs) / 60_000);
    const period = getSleepPeriod(e);
    totalMinutes += minutes;
    if (period === SLEEP_PERIOD_DAY) dayMinutes += minutes;
    else if (period === SLEEP_PERIOD_NIGHT) nightMinutes += minutes;
    else unmarkedMinutes += minutes;

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
    startsAtWake: Boolean(window.startsAtWake),
    endsAtWake: Boolean(window.endsAtWake),
    segments,
    totalMinutes,
    dayMinutes,
    nightMinutes,
    unmarkedMinutes,
  };
}

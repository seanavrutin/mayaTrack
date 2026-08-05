import { useState } from 'react';
import {
  getActiveSleep,
  awakeSinceMs,
  sleepDurationMs,
  formatDurationLongHM,
  getSleepPeriod,
  inferDefaultPeriod,
  periodLabelHe,
  SLEEP_PERIOD_DAY,
  SLEEP_PERIOD_NIGHT,
} from '../utils/sleep';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtTimeFromDate(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Sliding pill switch between day (☀️) and night (🌙). Icon-only, and the knob
// makes it read as switchable. Selecting never saves on its own — it only sets
// what the next נרדמה / התעוררה press will record.
export function PeriodToggle({ value, onChange, disabled, mode = 'sleep' }) {
  const isDay = value === SLEEP_PERIOD_DAY;
  const next = isDay ? SLEEP_PERIOD_NIGHT : SLEEP_PERIOD_DAY;
  const label = mode === 'active'
    ? (isDay ? 'זה נמנום יום' : 'זו שינת הלילה')
    : (isDay ? 'נמנום יום' : 'שינת לילה');
  return (
    <button
      type="button"
      className={`sleep-period-toggle sleep-period-toggle--${isDay ? 'day' : 'night'}`}
      onClick={() => onChange(next)}
      disabled={disabled}
      role="switch"
      aria-checked={!isDay}
      aria-label={`${label} — לחצי להחלפה`}
      title={`${label} — לחצי להחלפה`}
    >
      <span className="sleep-period-knob" aria-hidden="true" />
      <span className="sleep-period-opt sleep-period-opt-day" aria-hidden="true">☀️</span>
      <span className="sleep-period-opt sleep-period-opt-night" aria-hidden="true">🌙</span>
    </button>
  );
}

export default function SleepPill({
  sleepEntries = [],
  now,
  formTime,
  awakeAlertMinutes = 180,
  onStartSleep,
  onEndSleep,
}) {
  const [busy, setBusy] = useState(false);
  const nowMs = now instanceof Date ? now.getTime() : (typeof now === 'number' ? now : 0);
  // Only remember an explicit tap. Otherwise the toggle follows the clock, so a
  // session opened at bedtime can't inherit a stale "day" from the morning —
  // this app stays mounted all day.
  const [periodOverride, setPeriodOverride] = useState(null);

  const active = getActiveSleep(sleepEntries);
  const awakeMs = active ? null : awakeSinceMs(sleepEntries, nowMs);

  // While asleep, duration ticks live (the parent's useNow drives re-renders).
  const asleepMs = active ? sleepDurationMs(active, nowMs) : 0;
  const awakeOverThreshold = awakeMs !== null && awakeAlertMinutes > 0
    && awakeMs >= awakeAlertMinutes * 60_000;

  // Use the parent's time picker if it's been pulled meaningfully off "now"
  // (more than 60s), so the same date/time that drives bottle/diaper/pumping
  // entries also drives sleep start/end. The 60s threshold avoids treating
  // useNow's natural drift as an intentional manual edit.
  const pickerMs = formTime instanceof Date ? formTime.getTime() : nowMs;
  const usingPickerTime = Math.abs(pickerMs - nowMs) > 60_000;
  const effectiveDate = usingPickerTime ? new Date(pickerMs) : new Date(nowMs);

  // Which kind of sleep this is — a day nap or the night sleep. Awake it applies
  // to the sleep about to start; asleep it can still be corrected (a nap that
  // turned into the night) and is written when התעוררה is pressed. Either way
  // it's a pending choice that saves nothing on its own.
  const period = periodOverride
    ?? (active ? getSleepPeriod(active) : null)
    ?? inferDefaultPeriod(effectiveDate.getTime());

  const handleStart = async () => {
    if (busy || active) return;
    setBusy(true);
    try {
      // `time` mirrors `startTime` so the doc shows up in subscriptions ordered
      // by `time` (Firestore silently excludes docs missing the orderBy field).
      const startIso = effectiveDate.toISOString();
      await onStartSleep({
        time: startIso,
        startTime: startIso,
        endTime: null,
        period,
      });
      setPeriodOverride(null);
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (busy || !active) return;
    setBusy(true);
    try {
      // Guard against invalid end-before-start (user picked a time earlier
      // than when the sleep began). Fall back to "now" in that case so we
      // never write a negative-duration sleep.
      const activeStartMs = new Date(active.startTime).getTime();
      const endMs = effectiveDate.getTime() > activeStartMs ? effectiveDate.getTime() : nowMs;
      await onEndSleep(active.id, {
        endTime: new Date(endMs).toISOString(),
        // Re-saved so flipping the toggle mid-sleep sticks. The graph derives
        // day boundaries from this tag, so it's the only thing it needs.
        period,
      });
      setPeriodOverride(null);
    } finally {
      setBusy(false);
    }
  };

  if (active) {
    const activeStartMs = new Date(active.startTime).getTime();
    const pickerInvalidForEnd = usingPickerTime && effectiveDate.getTime() <= activeStartMs;
    const wakeLabel = busy
      ? 'שומר...'
      : usingPickerTime && !pickerInvalidForEnd
        ? `☀️ התעוררה ב-${fmtTimeFromDate(effectiveDate)}`
        : '☀️ התעוררה';
    return (
      <div className="sleep-pill sleep-pill-asleep" role="status">
        <div className="sleep-pill-asleep-main">
          <div className="sleep-pill-asleep-text">
            <span className="sleep-pill-icon sleep-pill-icon-pulse">💤</span>
            <span>ישנה · {formatDurationLongHM(asleepMs)}</span>
          </div>
          <div className="sleep-pill-actions">
            <PeriodToggle value={period} onChange={setPeriodOverride} disabled={busy} mode="active" />
            <button
              type="button"
              className="sleep-pill-wake-btn"
              onClick={handleEnd}
              disabled={busy}
            >
              {wakeLabel}
            </button>
          </div>
        </div>
        <div className="sleep-pill-asleep-sub">
          נרדמה ב-{fmtTime(active.startTime)}
        </div>
      </div>
    );
  }

  const awakeLabel = awakeMs == null
    ? 'ערה'
    : `ערה כבר ${formatDurationLongHM(awakeMs)}`;

  const sleepBtnLabel = busy
    ? '...'
    : usingPickerTime
      ? `💤 נרדמה ב-${fmtTimeFromDate(effectiveDate)}`
      : '💤 נרדמה';

  return (
    <div
      className={`sleep-pill sleep-pill-awake ${awakeOverThreshold ? 'sleep-pill-awake-long' : ''}`}
      role="status"
    >
      <div className="sleep-pill-awake-text">
        <span className="sleep-pill-icon">👶</span>
        <span>{awakeLabel}</span>
      </div>
      <div className="sleep-pill-actions">
        <PeriodToggle value={period} onChange={setPeriodOverride} disabled={busy} mode="sleep" />
        <button
          type="button"
          className="sleep-pill-sleep-btn"
          onClick={handleStart}
          disabled={busy}
        >
          {sleepBtnLabel}
        </button>
      </div>
    </div>
  );
}

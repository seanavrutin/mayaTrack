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

export function PeriodToggle({ value, onChange, disabled }) {
  return (
    <div className="sleep-period-toggle" role="group" aria-label="יום או לילה">
      <button
        type="button"
        className={`sleep-period-btn ${value === SLEEP_PERIOD_DAY ? 'selected' : ''}`}
        onClick={() => onChange(SLEEP_PERIOD_DAY)}
        disabled={disabled}
        aria-pressed={value === SLEEP_PERIOD_DAY}
      >
        ☀️ יום
      </button>
      <button
        type="button"
        className={`sleep-period-btn ${value === SLEEP_PERIOD_NIGHT ? 'selected' : ''}`}
        onClick={() => onChange(SLEEP_PERIOD_NIGHT)}
        disabled={disabled}
        aria-pressed={value === SLEEP_PERIOD_NIGHT}
      >
        🌙 לילה
      </button>
    </div>
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
  const [period, setPeriod] = useState(() => inferDefaultPeriod(nowMs || Date.now()));

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
      await onEndSleep(active.id, { endTime: new Date(endMs).toISOString() });
      // After night ends, the next sleep is usually a day nap.
      if (getSleepPeriod(active) === SLEEP_PERIOD_NIGHT) {
        setPeriod(SLEEP_PERIOD_DAY);
      }
    } finally {
      setBusy(false);
    }
  };

  if (active) {
    const activeStartMs = new Date(active.startTime).getTime();
    const pickerInvalidForEnd = usingPickerTime && effectiveDate.getTime() <= activeStartMs;
    const activePeriod = getSleepPeriod(active);
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
            <span className={`sleep-period-badge sleep-period-badge--${activePeriod}`}>
              {periodLabelHe(activePeriod)}
            </span>
          </div>
          <button
            type="button"
            className="sleep-pill-wake-btn"
            onClick={handleEnd}
            disabled={busy}
          >
            {wakeLabel}
          </button>
        </div>
        <div className="sleep-pill-asleep-sub">נרדמה ב-{fmtTime(active.startTime)}</div>
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
      <div className="sleep-pill-awake-actions">
        <PeriodToggle value={period} onChange={setPeriod} disabled={busy} />
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

import {
  getActiveSleep,
  getLastCompletedSleep,
  sleepInWindow,
  awakeSinceMs,
  sleepDurationMs,
  formatDurationLongHM,
} from '../utils/sleep';

function formatTime(isoString) {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateShort(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function timeAgo(isoString, now) {
  if (!isoString) return '';
  const diff = now - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return `לפני ${hrs} שע׳ ${remMins > 0 ? `ו-${remMins} דק׳` : ''}`;
  return `לפני ${Math.floor(hrs / 24)} ימים`;
}

function addMinutesToISO(isoString, minutes) {
  const d = new Date(isoString);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function isOverdue(isoString, now) {
  return isoString && new Date(isoString).getTime() < now;
}

function timeUntil(isoString, now) {
  if (!isoString) return '';
  const diff = new Date(isoString).getTime() - now;
  if (diff <= 0) return 'עבר הזמן!';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `עוד ${mins} דק׳`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `עוד ${hrs} שע׳ ${remMins > 0 ? `ו-${remMins} דק׳` : ''}`;
}

function isToday(isoString, now) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const ref = new Date(now);
  return d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate();
}

export default function Summary({ feedingEntries, diaperEntries, pumpingEntries, sleepEntries = [], medications = [], medicationLogs = [], onLogMedication, settings, loading, now, firstSyncDone = true }) {
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>טוען נתונים...</p>
      </div>
    );
  }

  const lastFeeding = feedingEntries[0] ?? null;
  const lastPumping = pumpingEntries[0] ?? null;
  const lastPeeDiaper = diaperEntries.find((e) => e.pee) ?? null;
  const lastPoopDiaper = diaperEntries.find((e) => e.poop) ?? null;

  const todayMedLogs = medicationLogs.filter(e => isToday(e.time, now));
  const getMedTakenToday = (medName) =>
    todayMedLogs.filter(e => e.medicationName === medName).length;
  const getLastMedLog = (medName) => {
    let latest = null;
    for (const e of medicationLogs) {
      if (e.medicationName !== medName || !e.time) continue;
      if (!latest || new Date(e.time).getTime() > new Date(latest.time).getTime()) {
        latest = e;
      }
    }
    return latest;
  };

  const nextFeedingTime = lastFeeding
    ? addMinutesToISO(lastFeeding.time, settings.feedingIntervalMinutes)
    : null;
  const nextPumpingTime = lastPumping
    ? addMinutesToISO(lastPumping.time, settings.pumpingIntervalMinutes)
    : null;

  // Suppress alarm-style "overdue" / missing-med styling until we've completed
  // a fresh sync, so cached/stale data doesn't trigger false red warnings.
  const showWarnings = firstSyncDone;
  const feedingOverdue = showWarnings && isOverdue(nextFeedingTime, now);
  const pumpingOverdue = showWarnings && isOverdue(nextPumpingTime, now);
  const anyMedMissing = showWarnings && medications.length > 0 &&
    medications.some(m => getMedTakenToday(m.name) < m.timesPerDay);

  // `now` always comes from useNow in App.jsx (a number). Defensive fallback
  // is 0 (renders as stale data for one tick) to keep this function pure.
  const nowMs = typeof now === 'number' ? now : (now instanceof Date ? now.getTime() : 0);
  const activeSleep = getActiveSleep(sleepEntries);
  const lastSleep = getLastCompletedSleep(sleepEntries);
  const sleepLast24h = sleepInWindow(sleepEntries, nowMs, 24 * 60 * 60_000);
  const awakeMs = activeSleep ? null : awakeSinceMs(sleepEntries, nowMs);
  const awakeAlertMs = (settings.awakeAlertMinutes ?? 0) * 60_000;
  const awakeOverdue = showWarnings && awakeMs !== null && awakeAlertMs > 0 && awakeMs >= awakeAlertMs;
  const sleepCardOverdue = showWarnings && awakeOverdue;

  return (
    <div className="summary">
      {/* Sleep card — also shown when there's no data yet, so the section is discoverable */}
      <div className={`summary-card sleep-summary-card ${sleepCardOverdue ? 'overdue' : ''} ${activeSleep ? 'sleeping' : ''}`}>
        <div className="summary-card-icon">{activeSleep ? '💤' : '😴'}</div>
        <div className="summary-card-content">
          <h3 className="summary-card-title">שינה</h3>
          {activeSleep ? (
            <div className="summary-row">
              <span className="summary-row-icon">💤</span>
              <div className="summary-row-text">
                <span className="summary-row-label">ישנה עכשיו · החל מ-</span>
                <span className="summary-row-time">{formatTime(activeSleep.startTime)}</span>
              </div>
              <span className="summary-row-ago">{formatDurationLongHM(sleepDurationMs(activeSleep, nowMs))}</span>
            </div>
          ) : (
            <div className="summary-row">
              <span className="summary-row-icon">{awakeOverdue ? '🟠' : '👶'}</span>
              <div className="summary-row-text">
                <span className={`summary-row-label ${awakeOverdue ? 'warning' : ''}`}>ערה</span>
                {lastSleep && (
                  <span className="summary-row-time">מאז {formatTime(lastSleep.endTime)}</span>
                )}
              </div>
              {awakeMs !== null && (
                <span className={`summary-row-ago ${awakeOverdue ? 'warning' : ''}`}>{formatDurationLongHM(awakeMs)}</span>
              )}
            </div>
          )}
          {lastSleep && (
            <div className="summary-row">
              <span className="summary-row-icon">🕐</span>
              <div className="summary-row-text">
                <span className="summary-row-label">נמנום אחרון</span>
                <span className="summary-row-time bf-time-range">
                  {formatTime(lastSleep.startTime)} → {formatTime(lastSleep.endTime)}
                </span>
              </div>
              <span className="summary-row-ago">{formatDurationLongHM(sleepDurationMs(lastSleep, nowMs))}</span>
            </div>
          )}
          <div className="summary-row">
            <span className="summary-row-icon">📊</span>
            <div className="summary-row-text">
              <span className="summary-row-label">סה״כ ב-24 שעות</span>
            </div>
            <span className="summary-row-ago">{formatDurationLongHM(sleepLast24h)}</span>
          </div>
        </div>
      </div>

      {/* Feeding card */}
      <div className={`summary-card ${lastFeeding?.type !== 'breastfeeding' && feedingOverdue ? 'overdue' : ''}`}>
        <div className="summary-card-icon">{lastFeeding?.type === 'breastfeeding' ? '🤱' : '🍼'}</div>
        <div className="summary-card-content">
          <h3 className="summary-card-title">
            {lastFeeding?.type === 'breastfeeding' ? 'הנקה' : 'האכלה'}
          </h3>
          {lastFeeding?.type === 'breastfeeding' ? (
            <>
              <div className="summary-row">
                <span className="summary-row-icon">🕐</span>
                <div className="summary-row-text">
                  <span className="summary-row-time bf-time-range">
                    {formatTime(lastFeeding.startTime)} → {formatTime(lastFeeding.endTime)}
                  </span>
                </div>
                <span className="summary-row-ago">{timeAgo(lastFeeding.startTime, now)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-icon">⏱</span>
                <div className="summary-row-text">
                  <span className="summary-row-label">
                    התחילה בצד <strong>{lastFeeding.startedBreast === 'right' ? 'ימין' : 'שמאל'}</strong> וינקה <strong>{lastFeeding.breastfeedingMinutes} דקות</strong>
                  </span>
                </div>
              </div>
              {(lastFeeding.formula > 0 || lastFeeding.pumpedMilk > 0) && (
                <div className="summary-row">
                  <span className="summary-row-icon">🍼</span>
                  <div className="summary-row-text">
                    <span className="summary-row-label">
                      השלמה: {[
                        lastFeeding.formula > 0 && `תמ״ל ${lastFeeding.formula} מ״ל`,
                        lastFeeding.pumpedMilk > 0 && `חלב שאוב ${lastFeeding.pumpedMilk} מ״ל`,
                      ].filter(Boolean).join(' + ')}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="summary-row">
                <span className="summary-row-icon">✅</span>
                <div className="summary-row-text">
                  <span className="summary-row-label">אחרונה</span>
                  <span className="summary-row-time">{formatTime(lastFeeding?.time)}</span>
                </div>
                <span className="summary-row-ago">{timeAgo(lastFeeding?.time, now)}</span>
              </div>
              {lastFeeding?.breastfeedingMinutes > 0 && (
                <div className="summary-row">
                  <span className="summary-row-icon">🤱</span>
                  <div className="summary-row-text">
                    <span className="summary-row-label">
                      + הנקה {lastFeeding.breastfeedingMinutes} דקות
                    </span>
                  </div>
                </div>
              )}
              <div className="summary-row">
                <span className="summary-row-icon">{feedingOverdue ? '🔴' : '⏰'}</span>
                <div className="summary-row-text">
                  <span className="summary-row-label">הבאה עד</span>
                  <span className={`summary-row-time ${feedingOverdue ? 'warning' : ''}`}>
                    {formatTime(nextFeedingTime)}
                  </span>
                </div>
                <span className={`summary-row-countdown ${feedingOverdue ? 'warning' : ''}`}>
                  {timeUntil(nextFeedingTime, now)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pumping card */}
      <div className={`summary-card ${settings.pumpingIntervalMinutes > 0 && pumpingOverdue ? 'overdue' : ''}`}>
        <div className="summary-card-icon">🧴</div>
        <div className="summary-card-content">
          <h3 className="summary-card-title">שאיבה</h3>
          <div className="summary-row">
            <span className="summary-row-icon">✅</span>
            <div className="summary-row-text">
              <span className="summary-row-label">אחרונה</span>
              <span className="summary-row-time">{formatTime(lastPumping?.time)}</span>
              {lastPumping?.side && (
                <span className="summary-row-label">
                  ({lastPumping.side === 'right' ? 'ימין' : lastPumping.side === 'left' ? 'שמאל' : 'שתיהן'})
                </span>
              )}
            </div>
            <span className="summary-row-ago">{timeAgo(lastPumping?.time, now)}</span>
          </div>
          {settings.pumpingIntervalMinutes > 0 && (
            <div className="summary-row">
              <span className="summary-row-icon">{pumpingOverdue ? '🔴' : '⏰'}</span>
              <div className="summary-row-text">
                <span className="summary-row-label">הבאה בשעה</span>
                <span className={`summary-row-time ${pumpingOverdue ? 'warning' : ''}`}>
                  {formatTime(nextPumpingTime)}
                </span>
              </div>
              <span className={`summary-row-countdown ${pumpingOverdue ? 'warning' : ''}`}>
                {timeUntil(nextPumpingTime, now)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Diaper card */}
      <div className="summary-card">
        <div className="summary-card-icon">🚼</div>
        <div className="summary-card-content">
          <h3 className="summary-card-title">טיטול</h3>
          <div className="summary-row">
            <span className="summary-row-icon">💧</span>
            <div className="summary-row-text">
              <span className="summary-row-label">פיפי אחרון</span>
              <span className="summary-row-time">{formatTime(lastPeeDiaper?.time)}</span>
            </div>
            <span className="summary-row-ago">{timeAgo(lastPeeDiaper?.time, now)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-row-icon">💩</span>
            <div className="summary-row-text">
              <span className="summary-row-label">קקי אחרון</span>
              <span className="summary-row-time">{formatTime(lastPoopDiaper?.time)}</span>
            </div>
            <span className="summary-row-ago">{timeAgo(lastPoopDiaper?.time, now)}</span>
          </div>
        </div>
      </div>

      {/* Medications card */}
      {medications.length > 0 && (
        <div className={`summary-card ${anyMedMissing ? 'overdue' : ''}`}>
          <div className="summary-card-icon">💊</div>
          <div className="summary-card-content">
            <h3 className="summary-card-title">תרופות</h3>
            {medications.map((med) => {
              const taken = getMedTakenToday(med.name);
              const done = taken >= med.timesPerDay;
              const lastLog = getLastMedLog(med.name);
              const lastIsToday = lastLog && isToday(lastLog.time, now);
              return (
                <div key={med.name} className="summary-row summary-med-row">
                  <span className="summary-row-icon">{done ? '✅' : '❌'}</span>
                  <div className="summary-row-text">
                    <span className={`summary-row-label ${!done ? 'warning' : ''}`}>
                      {med.name}
                    </span>
                  </div>
                  {lastLog && (
                    <span className="summary-med-last">
                      {lastIsToday
                        ? formatTime(lastLog.time)
                        : `${formatDateShort(lastLog.time)} ${formatTime(lastLog.time)}`}
                    </span>
                  )}
                  <button
                    className={`med-counter-btn ${done ? 'counter-done' : ''}`}
                    onClick={() => !done && onLogMedication(med.name)}
                    disabled={done}
                  >
                    {taken}/{med.timesPerDay}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

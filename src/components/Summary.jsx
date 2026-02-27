function formatTime(isoString) {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
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

function isOverdue(isoString) {
  return isoString && new Date(isoString) < new Date();
}

function timeUntil(isoString) {
  if (!isoString) return '';
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return 'עבר הזמן!';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `עוד ${mins} דק׳`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `עוד ${hrs} שע׳ ${remMins > 0 ? `ו-${remMins} דק׳` : ''}`;
}

export default function Summary({ feedingEntries, diaperEntries, pumpingEntries, settings }) {
  const lastFeeding = feedingEntries[0] ?? null;
  const lastPumping = pumpingEntries[0] ?? null;
  const lastPeeDiaper = diaperEntries.find((e) => e.pee) ?? null;
  const lastPoopDiaper = diaperEntries.find((e) => e.poop) ?? null;

  const nextFeedingTime = lastFeeding
    ? addMinutesToISO(lastFeeding.time, settings.feedingIntervalMinutes)
    : null;
  const nextPumpingTime = lastPumping
    ? addMinutesToISO(lastPumping.time, settings.pumpingIntervalMinutes)
    : null;

  const feedingOverdue = isOverdue(nextFeedingTime);
  const pumpingOverdue = isOverdue(nextPumpingTime);

  return (
    <div className="summary">
      {/* Feeding card */}
      <div className={`summary-card ${feedingOverdue ? 'overdue' : ''}`}>
        <div className="summary-card-icon">🍼</div>
        <div className="summary-card-content">
          <h3 className="summary-card-title">האכלה</h3>
          <div className="summary-row">
            <span className="summary-row-icon">✅</span>
            <div className="summary-row-text">
              <span className="summary-row-label">אחרונה</span>
              <span className="summary-row-time">{formatTime(lastFeeding?.time)}</span>
            </div>
            <span className="summary-row-ago">{timeAgo(lastFeeding?.time)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-row-icon">{feedingOverdue ? '🔴' : '⏰'}</span>
            <div className="summary-row-text">
              <span className="summary-row-label">הבאה עד</span>
              <span className={`summary-row-time ${feedingOverdue ? 'warning' : ''}`}>
                {formatTime(nextFeedingTime)}
              </span>
            </div>
            <span className={`summary-row-countdown ${feedingOverdue ? 'warning' : ''}`}>
              {timeUntil(nextFeedingTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Pumping card */}
      <div className={`summary-card ${pumpingOverdue ? 'overdue' : ''}`}>
        <div className="summary-card-icon">🧴</div>
        <div className="summary-card-content">
          <h3 className="summary-card-title">שאיבה</h3>
          <div className="summary-row">
            <span className="summary-row-icon">✅</span>
            <div className="summary-row-text">
              <span className="summary-row-label">אחרונה</span>
              <span className="summary-row-time">{formatTime(lastPumping?.time)}</span>
            </div>
            <span className="summary-row-ago">{timeAgo(lastPumping?.time)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-row-icon">{pumpingOverdue ? '🔴' : '⏰'}</span>
            <div className="summary-row-text">
              <span className="summary-row-label">הבאה בשעה</span>
              <span className={`summary-row-time ${pumpingOverdue ? 'warning' : ''}`}>
                {formatTime(nextPumpingTime)}
              </span>
            </div>
            <span className={`summary-row-countdown ${pumpingOverdue ? 'warning' : ''}`}>
              {timeUntil(nextPumpingTime)}
            </span>
          </div>
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
            <span className="summary-row-ago">{timeAgo(lastPeeDiaper?.time)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-row-icon">💩</span>
            <div className="summary-row-text">
              <span className="summary-row-label">קקי אחרון</span>
              <span className="summary-row-time">{formatTime(lastPoopDiaper?.time)}</span>
            </div>
            <span className="summary-row-ago">{timeAgo(lastPoopDiaper?.time)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

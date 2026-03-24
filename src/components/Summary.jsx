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

function isToday(isoString) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

export default function Summary({ feedingEntries, diaperEntries, pumpingEntries, medications = [], medicationLogs = [], onLogMedication, settings, loading }) {
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

  const todayMedLogs = medicationLogs.filter(e => isToday(e.time));
  const getMedTakenToday = (medName) =>
    todayMedLogs.filter(e => e.medicationName === medName).length;
  const anyMedMissing = medications.length > 0 &&
    medications.some(m => getMedTakenToday(m.name) < m.timesPerDay);

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
                <span className="summary-row-ago">{timeAgo(lastFeeding.startTime)}</span>
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
                <span className="summary-row-ago">{timeAgo(lastFeeding?.time)}</span>
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
                  {timeUntil(nextFeedingTime)}
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
            <span className="summary-row-ago">{timeAgo(lastPumping?.time)}</span>
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
                {timeUntil(nextPumpingTime)}
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

      {/* Medications card */}
      {medications.length > 0 && (
        <div className={`summary-card ${anyMedMissing ? 'overdue' : ''}`}>
          <div className="summary-card-icon">💊</div>
          <div className="summary-card-content">
            <h3 className="summary-card-title">תרופות</h3>
            {medications.map((med) => {
              const taken = getMedTakenToday(med.name);
              const done = taken >= med.timesPerDay;
              return (
                <div key={med.name} className="summary-row summary-med-row">
                  <span className="summary-row-icon">{done ? '✅' : '❌'}</span>
                  <div className="summary-row-text">
                    <span className={`summary-row-label ${!done ? 'warning' : ''}`}>
                      {med.name}
                    </span>
                  </div>
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

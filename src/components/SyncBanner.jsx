const SOURCE_LABELS = {
  feedings: 'האכלות',
  diapers: 'טיטולים',
  pumpings: 'שאיבות',
  vitaminD: 'ויטמין D',
  medicationLogs: 'תרופות',
  kids: 'ילדים',
  settings: 'הגדרות',
};

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function SyncBanner({
  sourceStatus,
  lastUpdated,
  showUpdatedToast,
  onRetry,
}) {
  const entries = Object.entries(sourceStatus);
  if (entries.length === 0) return null;

  const states = entries.map(([, s]) => s);
  const anySyncing = states.includes('syncing');
  const errorSources = entries.filter(([, s]) => s === 'error').map(([k]) => k);
  const allError = errorSources.length === entries.length;
  const allOk = states.every((s) => s === 'ok');

  if (allError) {
    return (
      <div className="sync-banner sync-banner-error" role="status">
        <span>
          <span className="sync-banner-icon">⚠</span>
          {' '}אין חיבור{lastUpdated ? ` · מציג נתונים מ-${fmtTime(lastUpdated)}` : ''}
        </span>
        {onRetry && (
          <button className="sync-banner-retry" onClick={onRetry}>נסה שוב</button>
        )}
      </div>
    );
  }

  if (errorSources.length > 0 && !anySyncing) {
    const labels = errorSources.map((s) => SOURCE_LABELS[s] || s).join(', ');
    return (
      <div className="sync-banner sync-banner-warning" role="status">
        <span>
          <span className="sync-banner-icon">⚠</span>
          {' '}חלק מהנתונים לא התעדכנו ({labels}){lastUpdated ? ` · מ-${fmtTime(lastUpdated)}` : ''}
        </span>
        {onRetry && (
          <button className="sync-banner-retry" onClick={onRetry}>נסה שוב</button>
        )}
      </div>
    );
  }

  if (showUpdatedToast && allOk) {
    return (
      <div className="sync-banner sync-banner-success" role="status">
        <span className="sync-banner-icon">✓</span> עודכן · {fmtTime(lastUpdated)}
      </div>
    );
  }

  if (anySyncing && lastUpdated) {
    return (
      <div className="sync-banner sync-banner-syncing" role="status">
        <span className="sync-banner-spinner" /> מציג נתונים מ-{fmtTime(lastUpdated)} · מתעדכן...
      </div>
    );
  }

  return null;
}

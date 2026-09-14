// Tells the family that something in the data can't be true, so the numbers
// built on it can't be trusted either. It never repairs anything: only the
// person who was there knows which of two overlapping records is the real
// sleep, so the app's job is to point at them and open the place to fix it.

function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function describePair({ a, b, overlapMs }) {
  const minutes = Math.round(overlapMs / 60_000);
  const amount = minutes >= 60
    ? `${Math.floor(minutes / 60)} שע׳${minutes % 60 ? ` ${minutes % 60} דק׳` : ''}`
    : `${minutes} דק׳`;
  const range = (e) => `${fmt(e.startTime)}–${e.endTime ? fmt(e.endTime) : 'פעיל'}`;
  return `${fmtDate(a.startTime)} · ${range(a)} ו-${range(b)} חופפות ב-${amount}`;
}

export default function DataIssuesBanner({ overlaps, onOpenSleep, onDismiss }) {
  const pairs = overlaps?.pairs ?? [];
  if (pairs.length === 0) return null;

  // The newest problem first — that's the one whose numbers are on screen now.
  const sorted = [...pairs].sort(
    (x, y) => new Date(y.a.startTime).getTime() - new Date(x.a.startTime).getTime(),
  );
  const shown = sorted.slice(0, 3);

  return (
    <div className="data-issues-banner" role="alert">
      <div className="data-issues-header">
        <span className="data-issues-icon">⚠</span>
        <span>
          {pairs.length === 1
            ? 'רשומת שינה כפולה — סכומי השינה לא מדויקים'
            : `${pairs.length} רשומות שינה כפולות — סכומי השינה לא מדויקים`}
        </span>
        <button
          type="button"
          className="data-issues-dismiss"
          onClick={onDismiss}
          aria-label="התעלם"
          title="התעלם"
        >
          ✕
        </button>
      </div>
      <ul className="data-issues-list">
        {shown.map((pair) => (
          <li key={`${pair.a.id}-${pair.b.id}`} className="data-issues-item">
            {describePair(pair)}
          </li>
        ))}
        {sorted.length > shown.length && (
          <li className="data-issues-item data-issues-more">
            ועוד {sorted.length - shown.length}
          </li>
        )}
      </ul>
      <button type="button" className="data-issues-action" onClick={onOpenSleep}>
        פתחי את טבלת השינה לתיקון
      </button>
    </div>
  );
}

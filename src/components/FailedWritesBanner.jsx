import { useState } from 'react';

const COLLECTION_LABELS = {
  feedings: 'האכלה',
  diapers: 'טיטול',
  pumpings: 'שאיבה',
  vitaminD: 'ויטמין D',
  medicationLogs: 'תרופה',
  kids: 'ילד/ה',
  settings: 'הגדרות',
};

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function describeOp(op) {
  if (op === 'add') return 'שמירת';
  if (op === 'update') return 'עדכון';
  if (op === 'delete') return 'מחיקת';
  return '';
}

export default function FailedWritesBanner({ failedWrites, onRetry, onDismiss }) {
  const [retryingIds, setRetryingIds] = useState({});

  if (!failedWrites || failedWrites.length === 0) return null;

  const handleRetry = async (failure) => {
    if (retryingIds[failure.id]) return;
    setRetryingIds((prev) => ({ ...prev, [failure.id]: true }));
    try {
      await onRetry(failure);
    } finally {
      setRetryingIds((prev) => {
        const next = { ...prev };
        delete next[failure.id];
        return next;
      });
    }
  };

  return (
    <div className="failed-writes-banner" role="alert">
      <div className="failed-writes-header">
        <span className="failed-writes-icon">⚠</span>
        <span>
          {failedWrites.length === 1
            ? 'רשומה אחת לא נשמרה'
            : `${failedWrites.length} רשומות לא נשמרו`}
        </span>
      </div>
      <ul className="failed-writes-list">
        {failedWrites.map((failure) => {
          const label = COLLECTION_LABELS[failure.collectionName] || failure.collectionName;
          const op = describeOp(failure.op);
          const isRetrying = !!retryingIds[failure.id];
          return (
            <li key={failure.id} className="failed-writes-item">
              <span className="failed-writes-item-label">
                {op} {label}
                {failure.timestamp ? ` · ${fmtTime(failure.timestamp)}` : ''}
              </span>
              <div className="failed-writes-actions">
                <button
                  type="button"
                  className="failed-writes-retry"
                  onClick={() => handleRetry(failure)}
                  disabled={isRetrying}
                >
                  {isRetrying ? 'מנסה...' : 'נסה שוב'}
                </button>
                <button
                  type="button"
                  className="failed-writes-dismiss"
                  onClick={() => onDismiss(failure.id)}
                  aria-label="התעלם"
                  title="התעלם"
                  disabled={isRetrying}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

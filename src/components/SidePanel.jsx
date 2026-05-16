import { useState } from 'react';
import { logOut } from '../services/firebase';
import GraphModal from './GraphModal';
import { formatDurationHM } from '../utils/sleep';

function fmt(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const TABLE_TITLES = {
  feeding: '🍼 טבלת אוכל',
  diaper: '🚼 טבלת טיטול',
  pumping: '🧴 טבלת שאיבה',
  sleep: '😴 טבלת שינה',
  medications: '💊 טבלת תרופות',
};

// Build the "YYYY-MM-DDTHH:mm" string a datetime-local input expects, in
// the user's local timezone (NOT UTC — datetime-local has no timezone).
function toLocalDateTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInput(localStr) {
  if (!localStr) return null;
  // datetime-local strings are interpreted as local time by the Date ctor.
  const d = new Date(localStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function SidePanel({
  isOpen,
  onClose,
  feedingEntries,
  diaperEntries,
  pumpingEntries,
  sleepEntries = [],
  medicationLogs = [],
  onDeleteFeeding,
  onDeleteDiaper,
  onDeletePumping,
  onDeleteSleep,
  onUpdateSleep,
  onDeleteMedicationLog,
  family,
  activeKid,
  onOpenSettings,
}) {
  const [activeTable, setActiveTable] = useState(null);
  const [activeGraph, setActiveGraph] = useState(null);
  const [openSection, setOpenSection] = useState('tables');
  const tablesOpen = openSection === 'tables';
  const graphsOpen = openSection === 'graphs';

  const [editingSleep, setEditingSleep] = useState(null);
  const [editSleepStart, setEditSleepStart] = useState('');
  const [editSleepEnd, setEditSleepEnd] = useState('');
  const [editSleepBusy, setEditSleepBusy] = useState(false);
  const [editSleepError, setEditSleepError] = useState(null);

  const openSleepEditor = (entry) => {
    setEditingSleep(entry);
    setEditSleepStart(toLocalDateTimeInput(entry.startTime));
    setEditSleepEnd(toLocalDateTimeInput(entry.endTime));
    setEditSleepError(null);
  };

  const closeSleepEditor = () => {
    if (editSleepBusy) return;
    setEditingSleep(null);
    setEditSleepStart('');
    setEditSleepEnd('');
    setEditSleepError(null);
  };

  const saveSleepEdit = async () => {
    if (!editingSleep || editSleepBusy) return;
    const startIso = fromLocalDateTimeInput(editSleepStart);
    if (!startIso) {
      setEditSleepError('שעת התחלה לא תקינה');
      return;
    }
    const endIso = editSleepEnd ? fromLocalDateTimeInput(editSleepEnd) : null;
    if (editSleepEnd && !endIso) {
      setEditSleepError('שעת סיום לא תקינה');
      return;
    }
    if (endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setEditSleepError('הסיום חייב להיות אחרי ההתחלה');
      return;
    }
    setEditSleepBusy(true);
    setEditSleepError(null);
    try {
      // Always send `time` alongside `startTime` so the subscription's
      // orderBy('time') still sees the doc after the edit.
      await onUpdateSleep(editingSleep.id, {
        time: startIso,
        startTime: startIso,
        endTime: endIso,
      });
      setEditingSleep(null);
      setEditSleepStart('');
      setEditSleepEnd('');
    } catch (err) {
      console.warn('sleep edit failed', err);
      setEditSleepError('השמירה נכשלה — נסי שוב');
    } finally {
      setEditSleepBusy(false);
    }
  };

  return (
    <>
      <div
        className={`side-panel-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <div className={`side-panel ${isOpen ? 'open' : ''}`}>
        <div className="side-panel-header">
          <h2>{activeKid && family ? `${activeKid.name} ${family.name}` : family ? `משפחת ${family.name}` : 'טבלאות'}</h2>
          <div className="side-panel-header-buttons">
            <button className="settings-icon-btn" onClick={onOpenSettings} title="הגדרות">⚙️</button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="side-panel-content">
          <button className="sp-section-toggle" onClick={() => setOpenSection(tablesOpen ? null : 'tables')}>
            <span>📋 טבלאות</span>
            <span className={`sp-chevron ${tablesOpen ? 'open' : ''}`}>◀</span>
          </button>
          {tablesOpen && (
            <div className="sp-section-items">
              <button className="table-btn" onClick={() => setActiveTable('feeding')}>🍼 אוכל</button>
              <button className="table-btn" onClick={() => setActiveTable('diaper')}>🚼 טיטול</button>
              <button className="table-btn" onClick={() => setActiveTable('pumping')}>🧴 שאיבה</button>
              <button className="table-btn" onClick={() => setActiveTable('sleep')}>😴 שינה</button>
              <button className="table-btn" onClick={() => setActiveTable('medications')}>💊 תרופות</button>
            </div>
          )}

          <button className="sp-section-toggle" onClick={() => setOpenSection(graphsOpen ? null : 'graphs')}>
            <span>📊 גרפים</span>
            <span className={`sp-chevron ${graphsOpen ? 'open' : ''}`}>◀</span>
          </button>
          {graphsOpen && (
            <div className="sp-section-items">
              <button className="graph-btn" onClick={() => setActiveGraph('pee')}>💧 פיפי</button>
              <button className="graph-btn" onClick={() => setActiveGraph('poop')}>💩 קקי</button>
              <button className="graph-btn" onClick={() => setActiveGraph('food')}>🍼 אוכל</button>
              <button className="graph-btn" onClick={() => setActiveGraph('pumping')}>🧴 שאיבה</button>
              <button className="graph-btn" onClick={() => setActiveGraph('sleep')}>😴 שינה</button>
            </div>
          )}

          <div className="logout-section">
            <button className="logout-btn" onClick={logOut}>
              התנתקות
            </button>
          </div>
        </div>
      </div>

      {activeGraph && (
        <GraphModal
          type={activeGraph}
          diaperEntries={diaperEntries}
          feedingEntries={feedingEntries}
          pumpingEntries={pumpingEntries}
          sleepEntries={sleepEntries}
          onClose={() => setActiveGraph(null)}
        />
      )}

      {editingSleep && (
        <>
          <div className="modal-overlay sleep-edit-overlay" onClick={closeSleepEditor} />
          <div className="modal sleep-edit-modal">
            <div className="modal-header">
              <h2>✏️ עריכת שינה</h2>
              <button className="close-btn" onClick={closeSleepEditor} disabled={editSleepBusy}>✕</button>
            </div>
            <div className="modal-body">
              <div className="sleep-edit-field">
                <label>התחלה</label>
                <input
                  type="datetime-local"
                  className="sleep-edit-input"
                  value={editSleepStart}
                  onChange={(e) => setEditSleepStart(e.target.value)}
                />
              </div>
              <div className="sleep-edit-field">
                <label>סיום (השאירי ריק לשינה פעילה)</label>
                <input
                  type="datetime-local"
                  className="sleep-edit-input"
                  value={editSleepEnd}
                  onChange={(e) => setEditSleepEnd(e.target.value)}
                />
                {editSleepEnd && (
                  <button
                    type="button"
                    className="sleep-edit-clear-end"
                    onClick={() => setEditSleepEnd('')}
                    disabled={editSleepBusy}
                  >
                    נקי סיום (סמן כפעיל)
                  </button>
                )}
              </div>
              {editSleepError && (
                <p className="sleep-edit-error">⚠ {editSleepError}</p>
              )}
              <div className="sleep-edit-actions">
                <button
                  type="button"
                  className="sleep-edit-save"
                  onClick={saveSleepEdit}
                  disabled={editSleepBusy}
                >
                  {editSleepBusy ? 'שומר...' : 'שמור'}
                </button>
                <button
                  type="button"
                  className="sleep-edit-cancel"
                  onClick={closeSleepEditor}
                  disabled={editSleepBusy}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTable && (
        <>
          <div className="modal-overlay" onClick={() => setActiveTable(null)} />
          <div className="modal">
            <div className="modal-header">
              <h2>{TABLE_TITLES[activeTable]}</h2>
              <button className="close-btn" onClick={() => setActiveTable(null)}>✕</button>
            </div>
            <div className="modal-body">
              {activeTable === 'feeding' && (
                feedingEntries.length === 0 ? (
                  <p className="no-data">אין נתונים עדיין</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>שעה</th>
                        <th>תמ״ל</th>
                        <th>חלב</th>
                        <th>הנקה</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedingEntries.map((e) => (
                        <tr key={e.id}>
                          <td className="cell-date">{fmtDate(e.time)}</td>
                          <td className="cell-time">{fmt(e.time)}</td>
                          <td className="cell-num">{e.formula > 0 ? e.formula : <span className="cell-dash">—</span>}</td>
                          <td className="cell-num">{e.pumpedMilk > 0 ? e.pumpedMilk : <span className="cell-dash">—</span>}</td>
                          <td className="cell-num">{e.breastfeedingMinutes > 0 ? `${e.breastfeedingMinutes}׳` : <span className="cell-dash">—</span>}</td>
                          <td className="cell-action">
                            <button className="delete-btn" onClick={() => onDeleteFeeding(e.id)} aria-label="מחק">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeTable === 'diaper' && (
                diaperEntries.length === 0 ? (
                  <p className="no-data">אין נתונים עדיין</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>שעה</th>
                        <th>סוג</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {diaperEntries.map((e) => (
                        <tr key={e.id}>
                          <td className="cell-date">{fmtDate(e.time)}</td>
                          <td className="cell-time">{fmt(e.time)}</td>
                          <td>
                            <div className="badge-group">
                              {e.pee && <span className="badge badge-pee">💧 פיפי</span>}
                              {e.poop && <span className="badge badge-poop">💩 קקי</span>}
                              {e.empty && <span className="badge badge-empty">ריק</span>}
                              {!e.pee && !e.poop && !e.empty && <span className="cell-dash">—</span>}
                            </div>
                          </td>
                          <td className="cell-action">
                            <button className="delete-btn" onClick={() => onDeleteDiaper(e.id)} aria-label="מחק">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeTable === 'pumping' && (
                pumpingEntries.length === 0 ? (
                  <p className="no-data">אין נתונים עדיין</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>שעה</th>
                        <th>משך</th>
                        <th>צד</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pumpingEntries.map((e) => (
                        <tr key={e.id}>
                          <td className="cell-date">{fmtDate(e.time)}</td>
                          <td className="cell-time">{fmt(e.time)}</td>
                          <td className="cell-num">{e.durationMinutes}׳</td>
                          <td>
                            {e.side === 'right' && <span className="badge badge-side">ימין</span>}
                            {e.side === 'left' && <span className="badge badge-side">שמאל</span>}
                            {e.side === 'both' && <span className="badge badge-side">שתיהן</span>}
                            {!e.side && <span className="cell-dash">—</span>}
                          </td>
                          <td className="cell-action">
                            <button className="delete-btn" onClick={() => onDeletePumping(e.id)} aria-label="מחק">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeTable === 'sleep' && (
                sleepEntries.length === 0 ? (
                  <p className="no-data">אין נתונים עדיין</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>התחלה</th>
                        <th>סיום</th>
                        <th>משך</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sleepEntries.map((e) => {
                        const isOpen = !e.endTime;
                        const durationMs = isOpen
                          ? 0
                          : new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
                        return (
                          <tr key={e.id}>
                            <td className="cell-date">{fmtDate(e.startTime)}</td>
                            <td className="cell-time">{fmt(e.startTime)}</td>
                            <td className="cell-time">
                              {isOpen ? <span className="badge badge-side">פעיל</span> : fmt(e.endTime)}
                            </td>
                            <td className="cell-num">
                              {isOpen ? <span className="cell-dash">—</span> : formatDurationHM(durationMs)}
                            </td>
                            <td className="cell-action cell-action-pair">
                              <button className="edit-btn" onClick={() => openSleepEditor(e)} aria-label="ערוך" title="ערוך">✏️</button>
                              <button className="delete-btn" onClick={() => onDeleteSleep(e.id)} aria-label="מחק">✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}

              {activeTable === 'medications' && (
                medicationLogs.length === 0 ? (
                  <p className="no-data">אין נתונים עדיין</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>שעה</th>
                        <th>תרופה</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicationLogs.map((e) => (
                        <tr key={e.id}>
                          <td className="cell-date">{fmtDate(e.time)}</td>
                          <td className="cell-time">{fmt(e.time)}</td>
                          <td><span className="badge badge-med">💊 {e.medicationName}</span></td>
                          <td className="cell-action">
                            <button className="delete-btn" onClick={() => onDeleteMedicationLog(e.id)} aria-label="מחק">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

import { useState } from 'react';
import GraphModal from './GraphModal';

function fmt(isoString) {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDate(isoString) {
  const d = new Date(isoString);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const TABLE_TITLES = {
  feeding: '🍼 טבלת אוכל',
  diaper: '🚼 טבלת טיטול',
  pumping: '🧴 טבלת שאיבה',
  vitaminD: '☀️ טבלת ויטמין D',
};

export default function SidePanel({
  isOpen,
  onClose,
  feedingEntries,
  diaperEntries,
  pumpingEntries,
  vitaminDEntries = [],
  settings,
  onSettingsChange,
  onDeleteFeeding,
  onDeleteDiaper,
  onDeletePumping,
  onDeleteVitaminD,
}) {
  const [activeTable, setActiveTable] = useState(null);
  const [activeGraph, setActiveGraph] = useState(null);

  const handleSetting = (key, value) => {
    const num = Number(value);
    if (!isNaN(num) && num > 0) {
      onSettingsChange({ ...settings, [key]: num });
    }
  };

  return (
    <>
      {/* Side panel overlay */}
      <div
        className={`side-panel-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <div className={`side-panel ${isOpen ? 'open' : ''}`}>
        <div className="side-panel-header">
          <h2>הגדרות וטבלאות</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="side-panel-content">
          <div className="settings-section">
            <h3>⚙️ הגדרות</h3>
            <div className="setting-row">
              <span className="setting-label">מרווח האכלה (דקות)</span>
              <input
                className="setting-input"
                type="number"
                value={settings.feedingIntervalMinutes}
                onChange={(e) =>
                  handleSetting('feedingIntervalMinutes', e.target.value)
                }
              />
            </div>
            <div className="setting-row">
              <span className="setting-label">מרווח שאיבה (דקות)</span>
              <input
                className="setting-input"
                type="number"
                value={settings.pumpingIntervalMinutes}
                onChange={(e) =>
                  handleSetting('pumpingIntervalMinutes', e.target.value)
                }
              />
            </div>
          </div>

          <div className="table-buttons">
            <h3>📋 טבלאות</h3>
            <button className="table-btn" onClick={() => setActiveTable('feeding')}>
              🍼 טבלת אוכל
            </button>
            <button className="table-btn" onClick={() => setActiveTable('diaper')}>
              🚼 טבלת טיטול
            </button>
            <button className="table-btn" onClick={() => setActiveTable('pumping')}>
              🧴 טבלת שאיבה
            </button>
            <button className="table-btn" onClick={() => setActiveTable('vitaminD')}>
              ☀️ טבלת ויטמין D
            </button>
          </div>

          <div className="table-buttons">
            <h3>📊 גרפים</h3>
            <button className="graph-btn" onClick={() => setActiveGraph('pee')}>
              💧 גרף פיפי
            </button>
            <button className="graph-btn" onClick={() => setActiveGraph('poop')}>
              💩 גרף קקי
            </button>
            <button className="graph-btn" onClick={() => setActiveGraph('food')}>
              🍼 גרף אוכל
            </button>
            <button className="graph-btn" onClick={() => setActiveGraph('pumping')}>
              🧴 גרף שאיבה
            </button>
          </div>
        </div>
      </div>

      {/* Graph popup modal */}
      {activeGraph && (
        <GraphModal
          type={activeGraph}
          diaperEntries={diaperEntries}
          feedingEntries={feedingEntries}
          pumpingEntries={pumpingEntries}
          onClose={() => setActiveGraph(null)}
        />
      )}

      {/* Table popup modal */}
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
                          <td>{fmtDate(e.time)}</td>
                          <td>{fmt(e.time)}</td>
                          <td>{e.formula}</td>
                          <td>{e.pumpedMilk}</td>
                          <td>{e.breastfeedingMinutes}׳</td>
                          <td>
                            <button className="delete-btn" onClick={() => onDeleteFeeding(e.id)}>✕</button>
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
                          <td>{fmtDate(e.time)}</td>
                          <td>{fmt(e.time)}</td>
                          <td>
                            {[e.pee && 'פיפי', e.poop && 'קקי', e.empty && 'ריק']
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </td>
                          <td>
                            <button className="delete-btn" onClick={() => onDeleteDiaper(e.id)}>✕</button>
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
                        <th>משך (דקות)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pumpingEntries.map((e) => (
                        <tr key={e.id}>
                          <td>{fmtDate(e.time)}</td>
                          <td>{fmt(e.time)}</td>
                          <td>{e.durationMinutes}׳</td>
                          <td>
                            <button className="delete-btn" onClick={() => onDeletePumping(e.id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeTable === 'vitaminD' && (
                vitaminDEntries.length === 0 ? (
                  <p className="no-data">אין נתונים עדיין</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>שעה</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitaminDEntries.map((e) => (
                        <tr key={e.id}>
                          <td>{fmtDate(e.time)}</td>
                          <td>{fmt(e.time)}</td>
                          <td>
                            <button className="delete-btn" onClick={() => onDeleteVitaminD(e.id)}>✕</button>
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

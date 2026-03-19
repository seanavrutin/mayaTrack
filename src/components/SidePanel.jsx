import { useState } from 'react';
import { logOut } from '../services/firebase';
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
  onDeleteFeeding,
  onDeleteDiaper,
  onDeletePumping,
  onDeleteVitaminD,
  family,
  activeKid,
  onOpenSettings,
}) {
  const [activeTable, setActiveTable] = useState(null);
  const [activeGraph, setActiveGraph] = useState(null);

  return (
    <>
      {/* Side panel overlay */}
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

          <div className="logout-section">
            <button className="logout-btn" onClick={logOut}>
              התנתקות
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

import { useRef, useState } from 'react';
import { logOut } from '../services/firebase';
import GraphView from './GraphModal';
import {
  formatDurationHM,
  getSleepPeriod,
  periodLabelHe,
  SLEEP_PERIOD_DAY,
  SLEEP_PERIOD_NIGHT,
} from '../utils/sleep';
import { PeriodToggle } from './SleepPill';

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

// Unified item list shown in the side panel. Each item opens a single modal
// that contains both the table and the graph for that topic, switchable via
// the tab strip at the top (or by swiping left/right). Medications has no
// graph yet, so its modal only shows the table tab.
const PANEL_ITEMS = [
  { id: 'feeding',     emoji: '🍼', label: 'אוכל',   graphType: 'food' },
  { id: 'diaper',      emoji: '🚼', label: 'טיטול',  graphType: 'diaper' },
  { id: 'pumping',     emoji: '🧴', label: 'שאיבה',  graphType: 'pumping' },
  { id: 'sleep',       emoji: '😴', label: 'שינה',   graphType: 'sleep' },
  { id: 'medications', emoji: '💊', label: 'תרופות', graphType: null },
];

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

// ─────────────────────────────────────────────────────────────────────────────
// Per-type table renderers. Pulled out so DetailModal can stay focused on
// chrome + tab logic.
// ─────────────────────────────────────────────────────────────────────────────

function FeedingTable({ entries, onDelete }) {
  if (entries.length === 0) return <p className="no-data">אין נתונים עדיין</p>;
  return (
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
        {entries.map((e) => (
          <tr key={e.id}>
            <td className="cell-date">{fmtDate(e.time)}</td>
            <td className="cell-time">{fmt(e.time)}</td>
            <td className="cell-num">{e.formula > 0 ? e.formula : <span className="cell-dash">—</span>}</td>
            <td className="cell-num">{e.pumpedMilk > 0 ? e.pumpedMilk : <span className="cell-dash">—</span>}</td>
            <td className="cell-num">{e.breastfeedingMinutes > 0 ? `${e.breastfeedingMinutes}׳` : <span className="cell-dash">—</span>}</td>
            <td className="cell-action">
              <button className="delete-btn" onClick={() => onDelete(e.id)} aria-label="מחק">✕</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiaperTable({ entries, onDelete }) {
  if (entries.length === 0) return <p className="no-data">אין נתונים עדיין</p>;
  return (
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
        {entries.map((e) => (
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
              <button className="delete-btn" onClick={() => onDelete(e.id)} aria-label="מחק">✕</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PumpingTable({ entries, onDelete }) {
  if (entries.length === 0) return <p className="no-data">אין נתונים עדיין</p>;
  return (
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
        {entries.map((e) => (
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
              <button className="delete-btn" onClick={() => onDelete(e.id)} aria-label="מחק">✕</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SleepTable({ entries, onDelete, onEdit }) {
  if (entries.length === 0) return <p className="no-data">אין נתונים עדיין</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>תאריך</th>
          <th>סוג</th>
          <th>התחלה</th>
          <th>סיום</th>
          <th>משך</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const isOpen = !e.endTime;
          const period = getSleepPeriod(e);
          const periodIcon = period === SLEEP_PERIOD_DAY ? '☀️' : period === SLEEP_PERIOD_NIGHT ? '🌙' : '·';
          const durationMs = isOpen
            ? 0
            : new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
          return (
            <tr key={e.id}>
              <td className="cell-date">{fmtDate(e.startTime)}</td>
              <td>
                <span className={`sleep-period-badge sleep-period-badge--${period ?? 'unmarked'}`}>
                  {periodIcon} {periodLabelHe(period)}
                </span>
              </td>
              <td className="cell-time">{fmt(e.startTime)}</td>
              <td className="cell-time">
                {isOpen ? <span className="badge badge-side">פעיל</span> : fmt(e.endTime)}
              </td>
              <td className="cell-num">
                {isOpen ? <span className="cell-dash">—</span> : formatDurationHM(durationMs)}
              </td>
              <td className="cell-action cell-action-pair">
                <button className="edit-btn" onClick={() => onEdit(e)} aria-label="ערוך" title="ערוך">✏️</button>
                <button className="delete-btn" onClick={() => onDelete(e.id)} aria-label="מחק">✕</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MedicationTable({ entries, onDelete }) {
  if (entries.length === 0) return <p className="no-data">אין נתונים עדיין</p>;
  return (
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
        {entries.map((e) => (
          <tr key={e.id}>
            <td className="cell-date">{fmtDate(e.time)}</td>
            <td className="cell-time">{fmt(e.time)}</td>
            <td><span className="badge badge-med">💊 {e.medicationName}</span></td>
            <td className="cell-action">
              <button className="delete-btn" onClick={() => onDelete(e.id)} aria-label="מחק">✕</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified detail modal — one modal per item with [table] / [graph] tabs.
// Defaults to the table view; switch via tap on a tile or horizontal swipe.
// ─────────────────────────────────────────────────────────────────────────────

function DetailModal({
  item,
  feedingEntries,
  diaperEntries,
  pumpingEntries,
  sleepEntries,
  medicationLogs,
  onDeleteFeeding,
  onDeleteDiaper,
  onDeletePumping,
  onDeleteSleep,
  onDeleteMedicationLog,
  onEditSleep,
  onClose,
}) {
  const supportsGraph = Boolean(item.graphType);
  const [view, setView] = useState('table');
  // `slideDir` drives the small enter-animation on the active pane and is
  // null on first render so the initial mount doesn't animate.
  const [slideDir, setSlideDir] = useState(null);

  const switchView = (next) => {
    if (next === view) return;
    // Going to graph (the left tab in the RTL strip) → slide in from the
    // left. Going back to table → slide in from the right. The visual
    // direction matches the physical position of each tab on screen.
    setSlideDir(next === 'graph' ? 'from-left' : 'from-right');
    setView(next);
  };

  // Swipe-to-switch is enabled only for the sleep item.
  //
  // The other items embed horizontally-scrollable charts (food/diaper/
  // pumping bar charts), which makes a generic "horizontal swipe = switch
  // tab" gesture conflict with the browser's native scroll. Limiting the
  // gesture to sleep — whose graph is a vertical actogram with no
  // horizontal scroll anywhere — gives us a reliable swipe without any
  // conflict. Other items still switch via the tab tiles.
  //
  // Detection happens during `touchmove` rather than `touchend`. If the
  // browser decides the gesture is a native scroll, it fires `touchcancel`
  // instead of `touchend` and our end handler never runs — so deferring
  // the decision until the end means we miss legitimate swipes. Committing
  // mid-move (as soon as the horizontal threshold is crossed) sidesteps
  // that race entirely.
  const enableSwipe = item.id === 'sleep';
  const touchStateRef = useRef(null);
  const SWIPE_THRESHOLD = 45;

  const onTouchStart = (e) => {
    if (!enableSwipe || e.targetTouches.length !== 1) {
      touchStateRef.current = null;
      return;
    }
    const t = e.targetTouches[0];
    touchStateRef.current = { startX: t.clientX, startY: t.clientY, fired: false };
  };

  const onTouchMove = (e) => {
    const st = touchStateRef.current;
    if (!st || st.fired) return;
    const t = e.targetTouches[0];
    if (!t) return;
    const dx = st.startX - t.clientX;
    const dy = st.startY - t.clientY;
    if (Math.abs(dx) <= Math.abs(dy)) return;     // mostly vertical → ignore
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;   // not enough yet
    st.fired = true;
    if (dx > 0 && supportsGraph && view === 'table') switchView('graph');
    else if (dx < 0 && view === 'graph') switchView('table');
  };

  const onTouchEnd = () => { touchStateRef.current = null; };
  const onTouchCancel = () => { touchStateRef.current = null; };

  const title = `${item.emoji} ${item.label}`;

  let tableContent = null;
  switch (item.id) {
    case 'feeding':
      tableContent = <FeedingTable entries={feedingEntries} onDelete={onDeleteFeeding} />;
      break;
    case 'diaper':
      tableContent = <DiaperTable entries={diaperEntries} onDelete={onDeleteDiaper} />;
      break;
    case 'pumping':
      tableContent = <PumpingTable entries={pumpingEntries} onDelete={onDeletePumping} />;
      break;
    case 'sleep':
      tableContent = <SleepTable entries={sleepEntries} onDelete={onDeleteSleep} onEdit={onEditSleep} />;
      break;
    case 'medications':
      tableContent = <MedicationTable entries={medicationLogs} onDelete={onDeleteMedicationLog} />;
      break;
    default:
      tableContent = null;
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal detail-modal">
        <div className="modal-header detail-modal-header">
          <button className="close-btn" onClick={onClose}>✕</button>
          {supportsGraph && (
            <div className="detail-tabs-inline" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'table'}
                className={`detail-tab ${view === 'table' ? 'active' : ''}`}
                onClick={() => switchView('table')}
              >
                📋 טבלה
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'graph'}
                className={`detail-tab ${view === 'graph' ? 'active' : ''}`}
                onClick={() => switchView('graph')}
              >
                📊 גרף
              </button>
            </div>
          )}
          <h2>{title}</h2>
        </div>
        <div
          className="modal-body detail-modal-body"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
        >
          {/* Keying on `view` forces React to remount the pane on switch,
              which restarts the slide-in CSS animation. */}
          <div
            key={view}
            className={`detail-view-pane${slideDir ? ` slide-${slideDir}` : ''}`}
          >
            {view === 'table' && tableContent}
            {view === 'graph' && supportsGraph && (
              <GraphView
                type={item.graphType}
                feedingEntries={feedingEntries}
                diaperEntries={diaperEntries}
                pumpingEntries={pumpingEntries}
                sleepEntries={sleepEntries}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SidePanel
// ─────────────────────────────────────────────────────────────────────────────

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
  const [activeItemId, setActiveItemId] = useState(null);
  const activeItem = PANEL_ITEMS.find((i) => i.id === activeItemId) || null;

  // Sleep edit modal state lives at this level so it layers above the detail
  // modal when the user taps the ✏️ button inside the sleep table.
  const [editingSleep, setEditingSleep] = useState(null);
  const [editSleepStart, setEditSleepStart] = useState('');
  const [editSleepEnd, setEditSleepEnd] = useState('');
  const [editSleepPeriod, setEditSleepPeriod] = useState(SLEEP_PERIOD_DAY);
  const [editSleepBusy, setEditSleepBusy] = useState(false);
  const [editSleepError, setEditSleepError] = useState(null);

  const openSleepEditor = (entry) => {
    setEditingSleep(entry);
    setEditSleepStart(toLocalDateTimeInput(entry.startTime));
    setEditSleepEnd(toLocalDateTimeInput(entry.endTime));
    setEditSleepPeriod(getSleepPeriod(entry) ?? SLEEP_PERIOD_NIGHT);
    setEditSleepError(null);
  };

  const closeSleepEditor = () => {
    if (editSleepBusy) return;
    setEditingSleep(null);
    setEditSleepStart('');
    setEditSleepEnd('');
    setEditSleepPeriod(SLEEP_PERIOD_DAY);
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
        period: editSleepPeriod,
      });
      setEditingSleep(null);
      setEditSleepStart('');
      setEditSleepEnd('');
      setEditSleepPeriod(SLEEP_PERIOD_DAY);
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
          <div className="sp-items">
            {PANEL_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="sp-item-btn"
                onClick={() => setActiveItemId(item.id)}
              >
                <span className="sp-item-icon">{item.emoji}</span>
                <span className="sp-item-label">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="logout-section">
            <button className="logout-btn" onClick={logOut}>
              התנתקות
            </button>
          </div>
        </div>
      </div>

      {activeItem && (
        <DetailModal
          // Keying on the item id resets the tab to `table` whenever the
          // user switches to a different item — much simpler than syncing
          // an effect with the parent.
          key={activeItem.id}
          item={activeItem}
          feedingEntries={feedingEntries}
          diaperEntries={diaperEntries}
          pumpingEntries={pumpingEntries}
          sleepEntries={sleepEntries}
          medicationLogs={medicationLogs}
          onDeleteFeeding={onDeleteFeeding}
          onDeleteDiaper={onDeleteDiaper}
          onDeletePumping={onDeletePumping}
          onDeleteSleep={onDeleteSleep}
          onDeleteMedicationLog={onDeleteMedicationLog}
          onEditSleep={openSleepEditor}
          onClose={() => setActiveItemId(null)}
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
                <label>סוג</label>
                <PeriodToggle
                  value={editSleepPeriod}
                  onChange={setEditSleepPeriod}
                  disabled={editSleepBusy}
                  mode="sleep"
                />
              </div>
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
    </>
  );
}

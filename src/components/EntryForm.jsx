import { useState, useRef, useCallback, useEffect } from 'react';
import NumberStepper from './NumberStepper';
import TimeInput from './TimeInput';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 'idle' | 'saving' | 'saved' | 'error'
function useSaveStatus() {
  const [statuses, setStatuses] = useState({});
  const timers = useRef({});

  const setStatus = useCallback((section, status) => {
    setStatuses((prev) => ({ ...prev, [section]: status }));
    clearTimeout(timers.current[section]);
    if (status === 'saved') {
      timers.current[section] = setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [section]: 'idle' }));
      }, 2000);
    }
  }, []);

  const getStatus = useCallback((section) => statuses[section] || 'idle', [statuses]);

  return { setStatus, getStatus };
}

function isToday(isoString, nowMs) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const ref = nowMs ? new Date(nowMs) : new Date();
  return d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate();
}

const MANUAL_EDIT_GRACE_MS = 2 * 60 * 1000;

export default function EntryForm({ now, onAddFeeding, onSupplementFeeding, onAddDiaper, onAddPumping, feedingEntries = [], medications = [], medicationLogs = [], onLogMedication }) {
  const [time, setTime] = useState(() => new Date());
  const [manualEditedAt, setManualEditedAt] = useState(null);

  // Auto-sync the time field to "now" unless the user has manually edited
  // the time within the last MANUAL_EDIT_GRACE_MS (gives them room to submit
  // a backdated entry without being overwritten by the ticker).
  useEffect(() => {
    if (manualEditedAt && now - manualEditedAt < MANUAL_EDIT_GRACE_MS) return;
    if (manualEditedAt) setManualEditedAt(null);
    setTime(new Date(now));
  }, [now, manualEditedAt]);

  const handleTimeChange = useCallback((newDate) => {
    setTime(newDate);
    setManualEditedAt(Date.now());
  }, []);

  const resetTimeToNow = useCallback(() => {
    setManualEditedAt(null);
    setTime(new Date());
  }, []);
  const [bottleType, setBottleType] = useState('formula');
  const [bottleAmount, setBottleAmount] = useState(0);
  const [supplementMode, setSupplementMode] = useState(false);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualBreast, setManualBreast] = useState('right');
  const [bfMode, setBfMode] = useState('timer');
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  const [emptyDiaper, setEmptyDiaper] = useState(false);
  const [pumpingMin, setPumpingMin] = useState(0);
  const [pumpMode, setPumpMode] = useState('timer');

  // Pumping timer state — restored from localStorage on mount
  const PUMP_STORAGE_KEY = 'pump-timer-state';

  const loadSavedPumpState = () => {
    try {
      const raw = localStorage.getItem(PUMP_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  };

  const savedPump = useRef(loadSavedPumpState());

  const [pumpSide, setPumpSide] = useState(savedPump.current?.pumpSide ?? 'both');
  const [pumpTimerRunning, setPumpTimerRunning] = useState(savedPump.current?.pumpTimerRunning ?? false);
  const [pumpTimerStart, setPumpTimerStart] = useState(savedPump.current?.pumpTimerStart ?? null);
  const [pumpPausedElapsed, setPumpPausedElapsed] = useState(savedPump.current?.pumpPausedElapsed ?? 0);
  const [pumpCurrentElapsed, setPumpCurrentElapsed] = useState(0);
  const [pumpSessionStart, setPumpSessionStart] = useState(savedPump.current?.pumpSessionStart ?? null);

  // Breastfeeding timer state — restored from localStorage on mount
  const BF_STORAGE_KEY = 'bf-timer-state';

  const loadSavedBfState = () => {
    try {
      const raw = localStorage.getItem(BF_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  };

  const savedBf = useRef(loadSavedBfState());

  const [activeBreast, setActiveBreast] = useState(savedBf.current?.activeBreast ?? null);
  const [timerRunning, setTimerRunning] = useState(savedBf.current?.timerRunning ?? false);
  const [timerPaused, setTimerPaused] = useState(savedBf.current?.timerPaused ?? false);
  const [timerStart, setTimerStart] = useState(savedBf.current?.timerStart ?? null);
  const [pausedElapsed, setPausedElapsed] = useState(savedBf.current?.pausedElapsed ?? 0);
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const [rightSessions, setRightSessions] = useState(savedBf.current?.rightSessions ?? []);
  const [leftSessions, setLeftSessions] = useState(savedBf.current?.leftSessions ?? []);
  const [bfSessionStart, setBfSessionStart] = useState(savedBf.current?.bfSessionStart ?? null);
  const [firstBreast, setFirstBreast] = useState(savedBf.current?.firstBreast ?? null);

  const { setStatus, getStatus } = useSaveStatus();
  const retryRef = useRef({});

  useEffect(() => {
    if (!timerRunning || !timerStart) return;
    const interval = setInterval(() => {
      setCurrentElapsed(pausedElapsed + Math.floor((Date.now() - timerStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerStart, pausedElapsed]);

  useEffect(() => {
    if (!pumpTimerRunning || !pumpTimerStart) return;
    const interval = setInterval(() => {
      setPumpCurrentElapsed(pumpPausedElapsed + Math.floor((Date.now() - pumpTimerStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [pumpTimerRunning, pumpTimerStart, pumpPausedElapsed]);

  useEffect(() => {
    const hasActivity = activeBreast || rightSessions.length > 0 || leftSessions.length > 0;
    if (hasActivity) {
      localStorage.setItem(BF_STORAGE_KEY, JSON.stringify({
        activeBreast, timerRunning, timerPaused,
        timerStart, pausedElapsed,
        rightSessions, leftSessions,
        bfSessionStart, firstBreast,
      }));
    } else {
      localStorage.removeItem(BF_STORAGE_KEY);
    }
  }, [activeBreast, timerRunning, timerPaused, timerStart,
      pausedElapsed, rightSessions, leftSessions,
      bfSessionStart, firstBreast]);

  useEffect(() => {
    const hasActivity = pumpTimerRunning || pumpPausedElapsed > 0 || pumpSessionStart;
    if (hasActivity) {
      localStorage.setItem(PUMP_STORAGE_KEY, JSON.stringify({
        pumpSide, pumpTimerRunning,
        pumpTimerStart, pumpPausedElapsed, pumpSessionStart,
      }));
    } else {
      localStorage.removeItem(PUMP_STORAGE_KEY);
    }
  }, [pumpSide, pumpTimerRunning, pumpTimerStart, pumpPausedElapsed, pumpSessionStart]);

  const doSave = async (section, addFn, entry, resetFn) => {
    if (getStatus(section) === 'saving') return;
    setStatus(section, 'saving');
    retryRef.current[section] = () => doSave(section, addFn, entry, null);
    try {
      await addFn(entry);
      setStatus(section, 'saved');
      retryRef.current[section] = null;
      if (resetFn) resetFn();
    } catch {
      setStatus(section, 'error');
    }
  };

  const handleRetry = (section) => {
    const fn = retryRef.current[section];
    if (fn) fn();
  };

  // --- Bottle save (formula + pumped milk only) ---
  const handleSaveBottle = () => {
    if (supplementMode && lastFeeding) {
      const update = {};
      if (bottleType === 'formula') {
        update.formula = (lastFeeding.formula || 0) + bottleAmount;
      } else {
        update.pumpedMilk = (lastFeeding.pumpedMilk || 0) + bottleAmount;
      }
      doSave('bottle', () => onSupplementFeeding(lastFeeding.id, update), null, () => {
        setBottleAmount(0);
        setSupplementMode(false);
        resetTimeToNow();
      });
      return;
    }
    const entry = {
      id: generateId(),
      type: 'bottle',
      time: time.toISOString(),
      formula: bottleType === 'formula' ? bottleAmount : 0,
      pumpedMilk: bottleType === 'pumpedMilk' ? bottleAmount : 0,
      breastfeedingMinutes: 0,
    };
    doSave('bottle', onAddFeeding, entry, () => {
      setBottleAmount(0);
      resetTimeToNow();
    });
  };

  // --- Breastfeeding timer helpers ---
  const resetTimerClock = () => {
    setTimerRunning(false);
    setTimerPaused(false);
    setTimerStart(null);
    setPausedElapsed(0);
    setCurrentElapsed(0);
  };

  const resetAll = () => {
    resetTimerClock();
    setBfSessionStart(null);
    setFirstBreast(null);
    setRightSessions([]);
    setLeftSessions([]);
    setActiveBreast(null);
    localStorage.removeItem(BF_STORAGE_KEY);
  };

  const getElapsedSeconds = () => {
    if (timerRunning && timerStart) {
      return pausedElapsed + Math.floor((Date.now() - timerStart) / 1000);
    }
    return pausedElapsed;
  };

  const stopCurrentTimer = () => {
    const total = getElapsedSeconds();
    if (total > 0) {
      if (activeBreast === 'right') {
        setRightSessions((prev) => [...prev, total]);
      } else if (activeBreast === 'left') {
        setLeftSessions((prev) => [...prev, total]);
      }
    }
    resetTimerClock();
    return total;
  };

  const handleBreastSelect = (breast) => {
    if ((timerRunning || timerPaused) && activeBreast && activeBreast !== breast) {
      stopCurrentTimer();
    }
    setActiveBreast(breast);
  };

  const handleTimerStart = () => {
    if (!activeBreast) return;
    if (!bfSessionStart) {
      setBfSessionStart(new Date().toISOString());
      setFirstBreast(activeBreast);
    }
    setTimerRunning(true);
    setTimerPaused(false);
    setTimerStart(Date.now());
    setPausedElapsed(0);
    setCurrentElapsed(0);
  };

  const handleTimerStop = () => {
    stopCurrentTimer();
  };

  const totalTimerSeconds = [...rightSessions, ...leftSessions].reduce((a, b) => a + b, 0)
    + ((timerRunning || timerPaused) ? currentElapsed : 0);

  const hasTimerSessions = rightSessions.length > 0 || leftSessions.length > 0 || timerRunning || timerPaused;

  const buildManualDateTime = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date(time);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const manualDurationMin = (() => {
    if (!manualStartTime || !manualEndTime) return 0;
    const start = buildManualDateTime(manualStartTime);
    const end = buildManualDateTime(manualEndTime);
    if (!start || !end) return 0;
    const diff = (new Date(end) - new Date(start)) / 60000;
    return diff > 0 ? Math.round(diff) : 0;
  })();

  const handleSaveBreastfeeding = () => {
    const buildBfData = () => {
      if (hasTimerSessions) {
        const savedStartTime = bfSessionStart || time.toISOString();
        const savedFirstBreast = firstBreast || activeBreast || 'right';

        let lastSessionSeconds = 0;
        if (timerRunning || timerPaused) {
          lastSessionSeconds = stopCurrentTimer();
        }
        const endTime = new Date().toISOString();

        const allSeconds = [...rightSessions, ...leftSessions].reduce((a, b) => a + b, 0)
          + lastSessionSeconds;
        const totalMinutes = Math.round(allSeconds / 60);

        return { totalMinutes, startTime: savedStartTime, endTime, startedBreast: savedFirstBreast, isTimer: true };
      } else {
        const totalMinutes = manualDurationMin;
        const startTime = buildManualDateTime(manualStartTime) || time.toISOString();
        const endTime = buildManualDateTime(manualEndTime) || new Date().toISOString();
        return { totalMinutes, startTime, endTime, startedBreast: manualBreast, isTimer: false };
      }
    };

    const bfData = buildBfData();

    if (supplementMode && lastFeeding) {
      const update = {
        breastfeedingMinutes: (lastFeeding.breastfeedingMinutes || 0) + bfData.totalMinutes,
        startTime: bfData.startTime,
        endTime: bfData.endTime,
        startedBreast: bfData.startedBreast,
      };
      doSave('breastfeeding', () => onSupplementFeeding(lastFeeding.id, update), null, () => {
        if (bfData.isTimer) resetAll();
        else { setManualStartTime(''); setManualEndTime(''); }
        setSupplementMode(false);
        resetTimeToNow();
      });
      return;
    }

    const entry = {
      id: generateId(),
      type: 'breastfeeding',
      time: bfData.isTimer ? bfData.startTime : time.toISOString(),
      formula: 0,
      pumpedMilk: 0,
      breastfeedingMinutes: bfData.totalMinutes,
      startTime: bfData.startTime,
      endTime: bfData.endTime,
      startedBreast: bfData.startedBreast,
    };
    doSave('breastfeeding', onAddFeeding, entry, () => {
      if (bfData.isTimer) resetAll();
      else { setManualStartTime(''); setManualEndTime(''); }
      resetTimeToNow();
    });
  };

  const handleSaveDiaper = () => {
    const entry = {
      id: generateId(),
      time: time.toISOString(),
      pee,
      poop,
      empty: emptyDiaper,
    };
    doSave('diaper', onAddDiaper, entry, () => {
      setPee(false);
      setPoop(false);
      setEmptyDiaper(false);
      resetTimeToNow();
    });
  };

  const resetPumpTimer = () => {
    setPumpTimerRunning(false);
    setPumpTimerStart(null);
    setPumpPausedElapsed(0);
    setPumpCurrentElapsed(0);
    setPumpSessionStart(null);
    localStorage.removeItem(PUMP_STORAGE_KEY);
  };

  const getPumpElapsedSeconds = () => {
    if (pumpTimerRunning && pumpTimerStart) {
      return pumpPausedElapsed + Math.floor((Date.now() - pumpTimerStart) / 1000);
    }
    return pumpPausedElapsed;
  };

  const handlePumpTimerStart = () => {
    if (!pumpSessionStart) {
      setPumpSessionStart(new Date().toISOString());
    }
    setPumpTimerRunning(true);
    setPumpTimerStart(Date.now());
  };

  const handlePumpTimerStop = () => {
    if (pumpTimerRunning && pumpTimerStart) {
      setPumpPausedElapsed(pumpPausedElapsed + Math.floor((Date.now() - pumpTimerStart) / 1000));
    }
    setPumpTimerRunning(false);
    setPumpTimerStart(null);
  };

  const hasPumpTimerActivity = pumpTimerRunning || pumpPausedElapsed > 0;
  const pumpDisplaySeconds = pumpTimerRunning ? pumpCurrentElapsed : pumpPausedElapsed;

  const handleSavePumping = () => {
    if (pumpMode === 'timer' && hasPumpTimerActivity) {
      const totalSeconds = getPumpElapsedSeconds();
      const savedStartTime = pumpSessionStart || time.toISOString();
      const endTime = new Date().toISOString();
      const totalMinutes = Math.round(totalSeconds / 60);

      const entry = {
        id: generateId(),
        time: time.toISOString(),
        durationMinutes: totalMinutes,
        side: pumpSide,
        startTime: savedStartTime,
        endTime,
      };
      doSave('pumping', onAddPumping, entry, () => {
        resetPumpTimer();
        resetTimeToNow();
      });
    } else {
      const entry = {
        id: generateId(),
        time: time.toISOString(),
        durationMinutes: pumpingMin,
        side: pumpSide,
      };
      doSave('pumping', onAddPumping, entry, () => {
        setPumpingMin(0);
        resetTimeToNow();
      });
    }
  };

  const todayMedLogs = medicationLogs.filter(e => isToday(e.time, now));

  const getMedTakenToday = (medName) =>
    todayMedLogs.filter(e => e.medicationName === medName).length;

  const allMedsDone = medications.length > 0 &&
    medications.every(m => getMedTakenToday(m.name) >= m.timesPerDay);

  const lastBreastSide = feedingEntries
    .filter(e => e.type === 'breastfeeding' && e.startedBreast)
    .sort((a, b) => new Date(b.time) - new Date(a.time))[0]?.startedBreast || null;

  const lastFeeding = feedingEntries.length > 0 ? feedingEntries[0] : null;
  const lastFeedingRecent = lastFeeding && (Date.now() - new Date(lastFeeding.time).getTime()) < 4 * 60 * 60 * 1000;

  const [openSection, setOpenSection] = useState(null);

  const handleTileClick = (key) => {
    if (openSection === key) {
      setOpenSection(null);
      return;
    }
    setSupplementMode(false);
    if (key === 'breastfeeding' && !activeBreast && lastBreastSide) {
      setActiveBreast(lastBreastSide === 'right' ? 'left' : 'right');
    }
    setOpenSection(key);
  };

  const tiles = [
    { key: 'bottle', emoji: '🍼', label: 'בקבוק' },
    { key: 'breastfeeding', emoji: '🤱', label: 'הנקה' },
    { key: 'diaper', emoji: '🚼', label: 'טיטול' },
    { key: 'pumping', emoji: '🧴', label: 'שאיבה' },
    { key: 'medications', emoji: '💊', label: 'תרופות' },
  ];

  const wrappedSave = (saveFn) => {
    return () => {
      saveFn();
      setOpenSection(null);
    };
  };

  return (
    <div className="entry-form">
      <div className="card">
        <TimeInput value={time} onChange={handleTimeChange} />
      </div>

      <div className="tile-grid">
        {tiles.map(({ key, emoji, label }) => (
          <button
            key={key}
            type="button"
            className={`tile ${openSection === key ? 'tile-active' : ''}`}
            onClick={() => handleTileClick(key)}
          >
            <span className="tile-emoji">{emoji}</span>
            <span className="tile-label">{label}</span>
          </button>
        ))}
      </div>

      {openSection === 'bottle' && (
        <div className="card section-expanded">
          <div className="card-title">
            🍼 בקבוק
            {lastFeedingRecent && (
              <label className="supplement-toggle">
                <input
                  type="checkbox"
                  checked={supplementMode}
                  onChange={(e) => setSupplementMode(e.target.checked)}
                />
                <span>השלמה</span>
              </label>
            )}
          </div>
          <div className="section-fields">
            <div className="bottle-type-toggle">
              <button
                type="button"
                className={`bottle-type-btn ${bottleType === 'formula' ? 'selected' : ''}`}
                onClick={() => setBottleType('formula')}
              >
                תמ״ל
              </button>
              <button
                type="button"
                className={`bottle-type-btn ${bottleType === 'pumpedMilk' ? 'selected' : ''}`}
                onClick={() => setBottleType('pumpedMilk')}
              >
                חלב שאוב
              </button>
            </div>
            <NumberStepper label='כמות (מ"ל)' value={bottleAmount} onChange={setBottleAmount} step={5} />
            <div className="quick-picks">
              <button type="button" className={`quick-pick ${bottleAmount === 30 ? 'selected' : ''}`} onClick={() => setBottleAmount(30)}>30</button>
              <button type="button" className={`quick-pick ${bottleAmount === 60 ? 'selected' : ''}`} onClick={() => setBottleAmount(60)}>60</button>
            </div>
          </div>
          <SaveButton
            status={getStatus('bottle')}
            onClick={wrappedSave(handleSaveBottle)}
            onRetry={() => handleRetry('bottle')}
            label={supplementMode ? 'הוסף לארוחה קודמת' : 'שמור בקבוק'}
          />
        </div>
      )}

      {openSection === 'breastfeeding' && (
        <div className="card section-expanded">
          <div className="card-title">
            🤱 הנקה
            {lastFeedingRecent && (
              <label className="supplement-toggle">
                <input
                  type="checkbox"
                  checked={supplementMode}
                  onChange={(e) => setSupplementMode(e.target.checked)}
                />
                <span>השלמה</span>
              </label>
            )}
            <button
              type="button"
              className="bf-mode-toggle"
              onClick={() => setBfMode(bfMode === 'timer' ? 'manual' : 'timer')}
            >
              {bfMode === 'timer' ? '✏️ ידני' : '⏱ שעון'}
            </button>
          </div>
          <div className="section-fields">

            {bfMode === 'manual' ? (
              <div className="bf-manual">
                <div className="bf-breast-label">הנקה התחילה משד:</div>
                <div className="bf-manual-breast-toggle">
                  <button
                    type="button"
                    className={`bf-breast-btn ${manualBreast === 'right' ? 'active' : ''}`}
                    onClick={() => setManualBreast('right')}
                  >
                    ימין
                  </button>
                  <button
                    type="button"
                    className={`bf-breast-btn ${manualBreast === 'left' ? 'active' : ''}`}
                    onClick={() => setManualBreast('left')}
                  >
                    שמאל
                  </button>
                </div>
                <div className="bf-manual-times">
                  <div className="bf-manual-field">
                    <label>התחלה</label>
                    <input
                      type="time"
                      className="bf-time-input"
                      value={manualStartTime}
                      onChange={(e) => setManualStartTime(e.target.value)}
                    />
                  </div>
                  <span className="bf-manual-arrow">→</span>
                  <div className="bf-manual-field">
                    <label>סיום</label>
                    <input
                      type="time"
                      className="bf-time-input"
                      value={manualEndTime}
                      onChange={(e) => setManualEndTime(e.target.value)}
                    />
                  </div>
                </div>
                {manualDurationMin > 0 && (
                  <div className="bf-manual-duration">{manualDurationMin} דקות</div>
                )}
              </div>
            ) : (
            <div className="bf-timer">
              <div className="bf-breast-label">הנקה התחילה משד:</div>
              <div className="bf-breasts">
                <div className="bf-breast-col">
                  <button
                    type="button"
                    className={`bf-breast-btn ${activeBreast === 'right' ? 'active' : ''} ${activeBreast === 'right' && timerRunning ? 'timing' : ''}`}
                    onClick={() => handleBreastSelect('right')}
                  >
                    ימין
                  </button>
                  <div className="bf-sessions">
                    {rightSessions.map((dur, i) => (
                      <div key={i} className="bf-session">{formatDuration(dur)}</div>
                    ))}
                    {activeBreast === 'right' && (timerRunning || timerPaused) && (
                      <div className={`bf-session bf-session-active ${timerPaused ? 'paused' : ''}`}>{formatDuration(currentElapsed)}</div>
                    )}
                  </div>
                </div>

                <div className="bf-breast-col">
                  <button
                    type="button"
                    className={`bf-breast-btn ${activeBreast === 'left' ? 'active' : ''} ${activeBreast === 'left' && timerRunning ? 'timing' : ''}`}
                    onClick={() => handleBreastSelect('left')}
                  >
                    שמאל
                  </button>
                  <div className="bf-sessions">
                    {leftSessions.map((dur, i) => (
                      <div key={i} className="bf-session">{formatDuration(dur)}</div>
                    ))}
                    {activeBreast === 'left' && (timerRunning || timerPaused) && (
                      <div className={`bf-session bf-session-active ${timerPaused ? 'paused' : ''}`}>{formatDuration(currentElapsed)}</div>
                    )}
                  </div>
                </div>
              </div>

              {!timerRunning && !timerPaused && (
                <button
                  type="button"
                  className="bf-timer-btn start"
                  onClick={handleTimerStart}
                  disabled={!activeBreast}
                >
                  ▶ התחל
                </button>
              )}
              {(timerRunning || timerPaused) && (
                <button type="button" className="bf-timer-btn stop" onClick={handleTimerStop}>
                  ⏹ עצור
                </button>
              )}

              {(rightSessions.length > 0 || leftSessions.length > 0 || timerRunning) && (
                <div className="bf-total">
                  סה״כ: {formatDuration(totalTimerSeconds)}
                </div>
              )}
            </div>
            )}
          </div>
          <div className="bf-save-row">
            <SaveButton
              status={getStatus('breastfeeding')}
              onClick={wrappedSave(handleSaveBreastfeeding)}
              onRetry={() => handleRetry('breastfeeding')}
              label={supplementMode ? 'הוסף לארוחה קודמת' : 'שמור הנקה'}
            />
            {hasTimerSessions && (
              <button type="button" className="bf-timer-btn reset" onClick={resetAll}>
                ✕ איפוס
              </button>
            )}
          </div>
        </div>
      )}

      {openSection === 'diaper' && (
        <div className="card section-expanded">
          <div className="card-title">🚼 טיטול</div>
          <div className="section-fields">
            <div className="diaper-options">
              <button type="button" className={`diaper-option ${pee ? 'selected' : ''}`} onClick={() => setPee(!pee)}>פיפי</button>
              <button type="button" className={`diaper-option ${poop ? 'selected' : ''}`} onClick={() => setPoop(!poop)}>קקי</button>
              <button type="button" className={`diaper-option ${emptyDiaper ? 'selected' : ''}`} onClick={() => setEmptyDiaper(!emptyDiaper)}>ריק</button>
            </div>
          </div>
          <SaveButton
            status={getStatus('diaper')}
            onClick={wrappedSave(handleSaveDiaper)}
            onRetry={() => handleRetry('diaper')}
            label="שמור טיטול"
          />
        </div>
      )}

      {openSection === 'pumping' && (
        <div className="card section-expanded">
          <div className="card-title">
            🧴 שאיבה
            <button
              type="button"
              className="bf-mode-toggle"
              onClick={() => setPumpMode(pumpMode === 'timer' ? 'manual' : 'timer')}
            >
              {pumpMode === 'timer' ? '✏️ ידני' : '⏱ שעון'}
            </button>
          </div>
          <div className="section-fields">

            <div className="pump-side-toggle">
              <button
                type="button"
                className={`bf-breast-btn ${pumpSide === 'right' ? 'active' : ''}`}
                onClick={() => setPumpSide('right')}
              >
                ימין
              </button>
              <button
                type="button"
                className={`bf-breast-btn ${pumpSide === 'both' ? 'active' : ''}`}
                onClick={() => setPumpSide('both')}
              >
                שתיהן
              </button>
              <button
                type="button"
                className={`bf-breast-btn ${pumpSide === 'left' ? 'active' : ''}`}
                onClick={() => setPumpSide('left')}
              >
                שמאל
              </button>
            </div>

            {pumpMode === 'manual' ? (
              <>
                <NumberStepper label="זמן שאיבה (דקות)" value={pumpingMin} onChange={setPumpingMin} step={1} />
                <div className="quick-picks">
                  <button type="button" className={`quick-pick ${pumpingMin === 15 ? 'selected' : ''}`} onClick={() => setPumpingMin(15)}>15</button>
                  <button type="button" className={`quick-pick ${pumpingMin === 35 ? 'selected' : ''}`} onClick={() => setPumpingMin(35)}>35</button>
                </div>
              </>
            ) : (
              <div className="bf-timer">
                <div className="pump-timer-display">
                  {formatDuration(pumpDisplaySeconds)}
                </div>

                {!pumpTimerRunning && pumpPausedElapsed === 0 && (
                  <button type="button" className="bf-timer-btn start" onClick={handlePumpTimerStart}>
                    ▶ התחל
                  </button>
                )}
                {pumpTimerRunning && (
                  <button type="button" className="bf-timer-btn stop" onClick={handlePumpTimerStop}>
                    ⏸ עצור
                  </button>
                )}
                {!pumpTimerRunning && pumpPausedElapsed > 0 && (
                  <button type="button" className="bf-timer-btn start" onClick={handlePumpTimerStart}>
                    ▶ המשך
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="bf-save-row">
            <SaveButton
              status={getStatus('pumping')}
              onClick={wrappedSave(handleSavePumping)}
              onRetry={() => handleRetry('pumping')}
              label="שמור שאיבה"
            />
            {hasPumpTimerActivity && (
              <button type="button" className="bf-timer-btn reset" onClick={resetPumpTimer}>
                ✕ איפוס
              </button>
            )}
          </div>
        </div>
      )}

      {openSection === 'medications' && (
        <div className="card section-expanded">
          <div className="card-title">💊 תרופות</div>
          {medications.length === 0 ? (
            <p className="no-data">אין תרופות מוגדרות — הוסיפו בהגדרות ⚙️</p>
          ) : (
            <div className="med-log-list">
              {medications.map((med) => {
                const taken = getMedTakenToday(med.name);
                const done = taken >= med.timesPerDay;
                return (
                  <button
                    key={med.name}
                    className={`med-log-row ${done ? 'med-done' : ''}`}
                    onClick={() => !done && onLogMedication(med.name)}
                    disabled={done}
                  >
                    <span className="med-log-icon">{done ? '✅' : '💊'}</span>
                    <span className="med-log-name">{med.name}</span>
                    <span className={`med-log-counter ${done ? 'counter-done' : ''}`}>
                      {taken}/{med.timesPerDay}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SaveButton({ status, onClick, onRetry, label }) {
  if (status === 'error') {
    return (
      <button className="save-btn save-error" onClick={onRetry}>
        <span className="save-error-icon">✕</span> לא נשמר — לחצי לנסות שוב
      </button>
    );
  }

  const cls =
    status === 'saving' ? 'save-btn saving' :
    status === 'saved' ? 'save-btn saved' : 'save-btn';

  const text =
    status === 'saving' ? 'שומר...' :
    status === 'saved' ? '✓ נשמר!' : label;

  return (
    <button className={cls} onClick={onClick} disabled={status === 'saving'}>
      {status === 'saving' && <span className="save-spinner" />}
      {text}
    </button>
  );
}

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

export default function EntryForm({ onAddFeeding, onAddDiaper, onAddPumping, onAddVitaminD }) {
  const [time, setTime] = useState(() => new Date());
  const [bottleType, setBottleType] = useState('formula');
  const [bottleAmount, setBottleAmount] = useState(0);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualBreast, setManualBreast] = useState('right');
  const [bfMode, setBfMode] = useState('timer');
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  const [emptyDiaper, setEmptyDiaper] = useState(false);
  const [pumpingMin, setPumpingMin] = useState(0);

  // Breastfeeding timer state
  const [activeBreast, setActiveBreast] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerStart, setTimerStart] = useState(null);
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const [rightSessions, setRightSessions] = useState([]);
  const [leftSessions, setLeftSessions] = useState([]);
  const [bfSessionStart, setBfSessionStart] = useState(null);
  const [firstBreast, setFirstBreast] = useState(null);

  const { setStatus, getStatus } = useSaveStatus();
  const retryRef = useRef({});

  useEffect(() => {
    if (!timerRunning || !timerStart) return;
    const interval = setInterval(() => {
      setCurrentElapsed(pausedElapsed + Math.floor((Date.now() - timerStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerStart, pausedElapsed]);

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
      setTime(new Date());
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

  const handleTimerPause = () => {
    const elapsed = pausedElapsed + Math.floor((Date.now() - timerStart) / 1000);
    setTimerRunning(false);
    setTimerPaused(true);
    setPausedElapsed(elapsed);
    setCurrentElapsed(elapsed);
    setTimerStart(null);
  };

  const handleTimerResume = () => {
    setTimerRunning(true);
    setTimerPaused(false);
    setTimerStart(Date.now());
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

      const entry = {
        id: generateId(),
        type: 'breastfeeding',
        time: time.toISOString(),
        formula: 0,
        pumpedMilk: 0,
        breastfeedingMinutes: totalMinutes,
        startTime: savedStartTime,
        endTime,
        startedBreast: savedFirstBreast,
      };
      doSave('breastfeeding', onAddFeeding, entry, () => {
        resetAll();
        setTime(new Date());
      });
    } else {
      const totalMinutes = manualDurationMin;
      const startTime = buildManualDateTime(manualStartTime) || time.toISOString();
      const endTime = buildManualDateTime(manualEndTime) || new Date().toISOString();

      const entry = {
        id: generateId(),
        type: 'breastfeeding',
        time: time.toISOString(),
        formula: 0,
        pumpedMilk: 0,
        breastfeedingMinutes: totalMinutes,
        startTime,
        endTime,
        startedBreast: manualBreast,
      };
      doSave('breastfeeding', onAddFeeding, entry, () => {
        setManualStartTime('');
        setManualEndTime('');
        setTime(new Date());
      });
    }
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
      setTime(new Date());
    });
  };

  const handleSavePumping = () => {
    const entry = {
      id: generateId(),
      time: time.toISOString(),
      durationMinutes: pumpingMin,
    };
    doSave('pumping', onAddPumping, entry, () => {
      setPumpingMin(0);
      setTime(new Date());
    });
  };

  const handleSaveVitaminD = () => {
    const entry = {
      id: generateId(),
      time: new Date().toISOString(),
    };
    doSave('vitaminD', onAddVitaminD, entry, null);
  };

  const [openSection, setOpenSection] = useState(null);

  const tiles = [
    { key: 'bottle', emoji: '🍼', label: 'בקבוק' },
    { key: 'breastfeeding', emoji: '🤱', label: 'הנקה' },
    { key: 'diaper', emoji: '🚼', label: 'טיטול' },
    { key: 'pumping', emoji: '🧴', label: 'שאיבה' },
    { key: 'vitaminD', emoji: '☀️', label: 'ויטמין D' },
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
        <TimeInput value={time} onChange={setTime} />
      </div>

      <div className="tile-grid">
        {tiles.map(({ key, emoji, label }) => (
          <button
            key={key}
            type="button"
            className={`tile ${openSection === key ? 'tile-active' : ''}`}
            onClick={() => setOpenSection(openSection === key ? null : key)}
          >
            <span className="tile-emoji">{emoji}</span>
            <span className="tile-label">{label}</span>
          </button>
        ))}
      </div>

      {openSection === 'bottle' && (
        <div className="card section-expanded">
          <div className="card-title">🍼 בקבוק</div>
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
            label="שמור בקבוק"
          />
        </div>
      )}

      {openSection === 'breastfeeding' && (
        <div className="card section-expanded">
          <div className="card-title">🤱 הנקה</div>
          <div className="section-fields">
            <button
              type="button"
              className="bf-mode-toggle"
              onClick={() => setBfMode(bfMode === 'timer' ? 'manual' : 'timer')}
            >
              {bfMode === 'timer' ? '✏️ הזנה ידנית' : '⏱ שעון עצר'}
            </button>

            {bfMode === 'manual' ? (
              <div className="bf-manual">
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
                <div className="bf-timer-controls">
                  {timerRunning ? (
                    <button type="button" className="bf-timer-btn pause" onClick={handleTimerPause}>
                      ⏸ השהה
                    </button>
                  ) : (
                    <button type="button" className="bf-timer-btn start" onClick={handleTimerResume}>
                      ▶ המשך
                    </button>
                  )}
                  <button type="button" className="bf-timer-btn stop" onClick={handleTimerStop}>
                    ⏹ עצור
                  </button>
                </div>
              )}

              {(rightSessions.length > 0 || leftSessions.length > 0 || timerRunning) && (
                <div className="bf-total">
                  סה״כ: {formatDuration(totalTimerSeconds)}
                </div>
              )}
            </div>
            )}
          </div>
          <SaveButton
            status={getStatus('breastfeeding')}
            onClick={wrappedSave(handleSaveBreastfeeding)}
            onRetry={() => handleRetry('breastfeeding')}
            label="שמור הנקה"
          />
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
          <div className="card-title">🧴 שאיבה</div>
          <div className="section-fields">
            <NumberStepper label="זמן שאיבה (דקות)" value={pumpingMin} onChange={setPumpingMin} step={1} />
            <div className="quick-picks">
              <button type="button" className={`quick-pick ${pumpingMin === 15 ? 'selected' : ''}`} onClick={() => setPumpingMin(15)}>15</button>
              <button type="button" className={`quick-pick ${pumpingMin === 35 ? 'selected' : ''}`} onClick={() => setPumpingMin(35)}>35</button>
            </div>
          </div>
          <SaveButton
            status={getStatus('pumping')}
            onClick={wrappedSave(handleSavePumping)}
            onRetry={() => handleRetry('pumping')}
            label="שמור שאיבה"
          />
        </div>
      )}

      {openSection === 'vitaminD' && (
        <div className="card section-expanded">
          <div className="card-title">☀️ ויטמין D</div>
          <SaveButton
            status={getStatus('vitaminD')}
            onClick={wrappedSave(handleSaveVitaminD)}
            onRetry={() => handleRetry('vitaminD')}
            label="קיבלה ויטמין D"
          />
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

import { useState, useRef, useCallback } from 'react';
import NumberStepper from './NumberStepper';
import TimeInput from './TimeInput';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
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
  const [formula, setFormula] = useState(0);
  const [pumpedMilk, setPumpedMilk] = useState(0);
  const [breastfeedingMin, setBreastfeedingMin] = useState(0);
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  const [emptyDiaper, setEmptyDiaper] = useState(false);
  const [pumpingMin, setPumpingMin] = useState(0);

  const { setStatus, getStatus } = useSaveStatus();
  const retryRef = useRef({});

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

  const handleSaveFeeding = () => {
    const entry = {
      id: generateId(),
      time: time.toISOString(),
      formula,
      pumpedMilk,
      breastfeedingMinutes: breastfeedingMin,
    };
    doSave('feeding', onAddFeeding, entry, () => {
      setFormula(0);
      setPumpedMilk(0);
      setBreastfeedingMin(0);
      setTime(new Date());
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

  return (
    <div className="entry-form">
      <div className="card">
        <TimeInput value={time} onChange={setTime} />
      </div>

      <div className="card">
        <div className="card-title">🍼 אוכל</div>
        <NumberStepper label='כמות תמ"ל (מ"ל)' value={formula} onChange={setFormula} step={5} />
        <div className="quick-picks">
          <button type="button" className={`quick-pick ${formula === 60 ? 'selected' : ''}`} onClick={() => setFormula(60)}>60</button>
        </div>
        <NumberStepper label='כמות חלב שאוב (מ"ל)' value={pumpedMilk} onChange={setPumpedMilk} step={5} />
        <div className="quick-picks">
          <button type="button" className={`quick-pick ${pumpedMilk === 60 ? 'selected' : ''}`} onClick={() => setPumpedMilk(60)}>60</button>
        </div>
        <NumberStepper label="זמן הנקה (דקות)" value={breastfeedingMin} onChange={setBreastfeedingMin} step={1} />
        <div className="quick-picks">
          <button type="button" className={`quick-pick ${breastfeedingMin === 20 ? 'selected' : ''}`} onClick={() => setBreastfeedingMin(20)}>20</button>
        </div>
        <SaveButton
          status={getStatus('feeding')}
          onClick={handleSaveFeeding}
          onRetry={() => handleRetry('feeding')}
          label="שמור אוכל"
        />
      </div>

      <div className="card">
        <div className="card-title">🚼 טיטול</div>
        <div className="diaper-options">
          <button
            type="button"
            className={`diaper-option ${pee ? 'selected' : ''}`}
            onClick={() => setPee(!pee)}
          >
            פיפי
          </button>
          <button
            type="button"
            className={`diaper-option ${poop ? 'selected' : ''}`}
            onClick={() => setPoop(!poop)}
          >
            קקי
          </button>
          <button
            type="button"
            className={`diaper-option ${emptyDiaper ? 'selected' : ''}`}
            onClick={() => setEmptyDiaper(!emptyDiaper)}
          >
            ריק
          </button>
        </div>
        <SaveButton
          status={getStatus('diaper')}
          onClick={handleSaveDiaper}
          onRetry={() => handleRetry('diaper')}
          label="שמור טיטול"
        />
      </div>

      <div className="card">
        <div className="card-title">🧴 שאיבה</div>
        <NumberStepper label="זמן שאיבה (דקות)" value={pumpingMin} onChange={setPumpingMin} step={1} />
        <div className="quick-picks">
          <button type="button" className={`quick-pick ${pumpingMin === 15 ? 'selected' : ''}`} onClick={() => setPumpingMin(15)}>15</button>
          <button type="button" className={`quick-pick ${pumpingMin === 35 ? 'selected' : ''}`} onClick={() => setPumpingMin(35)}>35</button>
        </div>
        <SaveButton
          status={getStatus('pumping')}
          onClick={handleSavePumping}
          onRetry={() => handleRetry('pumping')}
          label="שמור שאיבה"
        />
      </div>

      <div className="card">
        <div className="card-title">☀️ ויטמין D</div>
        <SaveButton
          status={getStatus('vitaminD')}
          onClick={handleSaveVitaminD}
          onRetry={() => handleRetry('vitaminD')}
          label="קיבלה ויטמין D"
        />
      </div>
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

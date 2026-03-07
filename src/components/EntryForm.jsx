import { useState } from 'react';
import NumberStepper from './NumberStepper';
import TimeInput from './TimeInput';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
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
  const [savedSection, setSavedSection] = useState(null);

  const showSaved = (section) => {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 1500);
  };

  const handleSaveFeeding = () => {
    onAddFeeding({
      id: generateId(),
      time: time.toISOString(),
      formula,
      pumpedMilk,
      breastfeedingMinutes: breastfeedingMin,
    });
    setFormula(0);
    setPumpedMilk(0);
    setBreastfeedingMin(0);
    setTime(new Date());
    showSaved('feeding');
  };

  const handleSaveDiaper = () => {
    onAddDiaper({
      id: generateId(),
      time: time.toISOString(),
      pee,
      poop,
      empty: emptyDiaper,
    });
    setPee(false);
    setPoop(false);
    setEmptyDiaper(false);
    setTime(new Date());
    showSaved('diaper');
  };

  const handleSavePumping = () => {
    onAddPumping({
      id: generateId(),
      time: time.toISOString(),
      durationMinutes: pumpingMin,
    });
    setPumpingMin(0);
    setTime(new Date());
    showSaved('pumping');
  };

  const handleSaveVitaminD = () => {
    onAddVitaminD({
      id: generateId(),
      time: new Date().toISOString(),
    });
    showSaved('vitaminD');
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
        <button
          className={`save-btn ${savedSection === 'feeding' ? 'saved' : ''}`}
          onClick={handleSaveFeeding}
        >
          {savedSection === 'feeding' ? '✓ נשמר!' : 'שמור אוכל'}
        </button>
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
        <button
          className={`save-btn ${savedSection === 'diaper' ? 'saved' : ''}`}
          onClick={handleSaveDiaper}
        >
          {savedSection === 'diaper' ? '✓ נשמר!' : 'שמור טיטול'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">🧴 שאיבה</div>
        <NumberStepper label="זמן שאיבה (דקות)" value={pumpingMin} onChange={setPumpingMin} step={1} />
        <div className="quick-picks">
          <button type="button" className={`quick-pick ${pumpingMin === 15 ? 'selected' : ''}`} onClick={() => setPumpingMin(15)}>15</button>
          <button type="button" className={`quick-pick ${pumpingMin === 35 ? 'selected' : ''}`} onClick={() => setPumpingMin(35)}>35</button>
        </div>
        <button
          className={`save-btn ${savedSection === 'pumping' ? 'saved' : ''}`}
          onClick={handleSavePumping}
        >
          {savedSection === 'pumping' ? '✓ נשמר!' : 'שמור שאיבה'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">☀️ ויטמין D</div>
        <button
          className={`save-btn ${savedSection === 'vitaminD' ? 'saved' : ''}`}
          onClick={handleSaveVitaminD}
        >
          {savedSection === 'vitaminD' ? '✓ נשמר!' : 'קיבלה ויטמין D'}
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';

export default function SettingsModal({
  isOpen,
  onClose,
  family,
  user,
  settings,
  onSettingsChange,
  kids,
  onAddKid,
  onUpdateKid,
  onDeleteKid,
}) {
  const [newKidName, setNewKidName] = useState('');
  const [editingKidId, setEditingKidId] = useState(null);
  const [newMedName, setNewMedName] = useState('');
  const [newMedTimes, setNewMedTimes] = useState(1);

  if (!isOpen) return null;

  const handleSetting = (key, value) => {
    const num = Number(value);
    if (!isNaN(num) && num >= 0) {
      onSettingsChange({ ...settings, [key]: num });
    }
  };

  const handleAddKid = () => {
    const name = newKidName.trim();
    if (!name) return;
    onAddKid({ name, medications: [] });
    setNewKidName('');
  };

  const handleDeleteKid = (kidId, kidName) => {
    if (window.confirm(`למחוק את ${kidName}?`)) {
      onDeleteKid(kidId);
    }
  };

  const handleAddMedication = (kid) => {
    const name = newMedName.trim();
    if (!name) return;
    const medications = [...(kid.medications || []), { name, timesPerDay: newMedTimes }];
    onUpdateKid(kid.id, { medications });
    setNewMedName('');
    setNewMedTimes(1);
    setEditingKidId(null);
  };

  const handleDeleteMedication = (kid, medIndex) => {
    const medications = kid.medications.filter((_, i) => i !== medIndex);
    onUpdateKid(kid.id, { medications });
  };

  const handleUpdateMedTimesPerDay = (kid, medIndex, newTimes) => {
    const num = Number(newTimes);
    if (isNaN(num) || num < 1) return;
    const medications = kid.medications.map((m, i) =>
      i === medIndex ? { ...m, timesPerDay: num } : m
    );
    onUpdateKid(kid.id, { medications });
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal settings-modal">
        <div className="modal-header">
          <h2>⚙️ הגדרות</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Family info */}
          {family && (
            <div className="settings-modal-section">
              <h3>👨‍👩‍👧 משפחה</h3>
              <div className="setting-row">
                <span className="setting-label">קוד הצטרפות:</span>
                <span className="family-code-badge">{family.code}</span>
              </div>
              {user && (
                <div className="setting-row">
                  <span className="setting-label family-user-email">{user.email}</span>
                </div>
              )}
            </div>
          )}

          {/* Intervals */}
          <div className="settings-modal-section">
            <h3>⏱ מרווחי זמן</h3>
            <div className="setting-row">
              <span className="setting-label">מרווח האכלה (דקות)</span>
              <input
                className="setting-input"
                type="number"
                value={settings.feedingIntervalMinutes}
                onChange={(e) => handleSetting('feedingIntervalMinutes', e.target.value)}
              />
            </div>
            <div className="setting-row">
              <span className="setting-label">מרווח שאיבה (דקות)</span>
              <input
                className="setting-input"
                type="number"
                value={settings.pumpingIntervalMinutes}
                onChange={(e) => handleSetting('pumpingIntervalMinutes', e.target.value)}
              />
            </div>
          </div>

          {/* Kids & Medications */}
          <div className="settings-modal-section">
            <h3>👶 ילדים ותרופות</h3>

            {kids.length === 0 && (
              <p className="no-data">אין ילדים עדיין — הוסיפו את הילד/ה הראשון/ה</p>
            )}

            {kids.map((kid) => (
              <div key={kid.id} className="kid-card">
                <div className="kid-card-header">
                  <span className="kid-name">{kid.name}</span>
                  <button
                    className="kid-delete-btn"
                    onClick={() => handleDeleteKid(kid.id, kid.name)}
                    title="מחיקה"
                  >✕</button>
                </div>

                {/* Medications list */}
                <div className="kid-meds">
                  {(kid.medications || []).length === 0 ? (
                    <p className="kid-meds-empty">אין תרופות</p>
                  ) : (
                    (kid.medications || []).map((med, idx) => (
                      <div key={idx} className="med-row">
                        <span className="med-name">💊 {med.name}</span>
                        <div className="med-times">
                          <input
                            className="med-times-input"
                            type="number"
                            min="1"
                            value={med.timesPerDay}
                            onChange={(e) => handleUpdateMedTimesPerDay(kid, idx, e.target.value)}
                          />
                          <span className="med-times-label">× ביום</span>
                        </div>
                        <button
                          className="med-delete-btn"
                          onClick={() => handleDeleteMedication(kid, idx)}
                        >✕</button>
                      </div>
                    ))
                  )}

                  {/* Add medication form */}
                  {editingKidId === kid.id ? (
                    <div className="add-med-form">
                      <input
                        className="add-med-input"
                        type="text"
                        placeholder="שם התרופה"
                        value={newMedName}
                        onChange={(e) => setNewMedName(e.target.value)}
                        autoFocus
                      />
                      <div className="add-med-times-row">
                        <input
                          className="med-times-input"
                          type="number"
                          min="1"
                          value={newMedTimes}
                          onChange={(e) => setNewMedTimes(Number(e.target.value) || 1)}
                        />
                        <span className="med-times-label">× ביום</span>
                      </div>
                      <div className="add-med-actions">
                        <button className="add-med-confirm" onClick={() => handleAddMedication(kid)}>
                          הוספה
                        </button>
                        <button className="add-med-cancel" onClick={() => { setEditingKidId(null); setNewMedName(''); setNewMedTimes(1); }}>
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="add-med-btn"
                      onClick={() => { setEditingKidId(kid.id); setNewMedName(''); setNewMedTimes(1); }}
                    >
                      + הוסף תרופה
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Add kid */}
            <div className="add-kid-row">
              <input
                className="add-kid-input"
                type="text"
                placeholder="שם הילד/ה"
                value={newKidName}
                onChange={(e) => setNewKidName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKid()}
              />
              <button className="add-kid-btn" onClick={handleAddKid} disabled={!newKidName.trim()}>
                + הוספה
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

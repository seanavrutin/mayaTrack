import { useState } from 'react';
import { createFamily, joinFamily, getUserFamily } from '../services/firebaseApi';
import { logOut } from '../services/firebase';

export default function FamilyScreen({ user, onFamilyReady }) {
  const [mode, setMode] = useState(null);
  const [familyName, setFamilyName] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdFamily, setCreatedFamily] = useState(null);

  const handleCreate = async () => {
    if (!familyName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await createFamily(user.uid, familyName.trim());
      setCreatedFamily(result);
    } catch (err) {
      setError('יצירת המשפחה נכשלה. נסו שוב.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!familyCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await joinFamily(user.uid, familyCode.trim().toUpperCase());
      onFamilyReady(result);
    } catch (err) {
      setError('הקוד לא נמצא. בדקו ונסו שוב.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    const family = await getUserFamily(user.uid);
    onFamilyReady(family);
  };

  if (createdFamily) {
    return (
      <div className="family-screen">
        <div className="family-card">
          <h1>👶 MayaTrack</h1>
          <div className="family-success">
            <h2>המשפחה נוצרה בהצלחה!</h2>
            <p>שתפו את הקוד הזה עם בני המשפחה:</p>
            <div className="family-code-display">{createdFamily.code}</div>
            <p className="family-code-hint">שמרו את הקוד — בני משפחה ישתמשו בו כדי להצטרף</p>
          </div>
          <button className="save-btn" onClick={handleContinue}>
            המשך לאפליקציה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="family-screen">
      <div className="family-card">
        <h1>👶 MayaTrack</h1>
        <p className="family-subtitle">שלום {user.displayName}!</p>

        {!mode && (
          <div className="family-choices">
            <button className="save-btn" onClick={() => setMode('create')}>
              יצירת משפחה חדשה
            </button>
            <button className="save-btn family-join-btn" onClick={() => setMode('join')}>
              הצטרפות למשפחה קיימת
            </button>
            <button className="family-logout-btn" onClick={logOut}>
              התנתקות
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="family-form">
            <input
              className="setup-input"
              placeholder="שם המשפחה"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
            />
            <button
              className="save-btn"
              onClick={handleCreate}
              disabled={loading || !familyName.trim()}
            >
              {loading ? 'יוצר...' : 'צור משפחה'}
            </button>
            <button className="family-back-btn" onClick={() => { setMode(null); setError(''); }}>
              חזרה
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="family-form">
            <input
              className="setup-input family-code-input"
              placeholder="הכניסו קוד משפחה"
              value={familyCode}
              onChange={(e) => setFamilyCode(e.target.value)}
              dir="ltr"
            />
            <button
              className="save-btn"
              onClick={handleJoin}
              disabled={loading || !familyCode.trim()}
            >
              {loading ? 'מצטרף...' : 'הצטרף'}
            </button>
            <button className="family-back-btn" onClick={() => { setMode(null); setError(''); }}>
              חזרה
            </button>
          </div>
        )}

        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}

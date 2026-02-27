import { useState } from 'react';
import { setScriptUrl, fetchAll } from '../services/sheetsApi';

const STEPS = [
  'צרו Google Sheet חדש (שם חופשי)',
  'בתפריט למעלה: Extensions ➜ Apps Script',
  'מחקו את כל הקוד שמופיע ← הדביקו את הקוד מהקובץ google-apps-script.js שבפרויקט',
  'לחצו Deploy ➜ New deployment',
  'ב-Type בחרו Web app',
  'ב-"Who has access" בחרו Anyone',
  'לחצו Deploy ואשרו את ההרשאות',
  'העתיקו את ה-URL שקיבלתם והדביקו למטה',
];

export default function SetupScreen({ onReady }) {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!url.trim()) return;
    setTesting(true);
    setError('');

    try {
      setScriptUrl(url);
      await fetchAll();
      onReady();
    } catch {
      setError('לא הצלחתי להתחבר. בדקו שה-URL נכון ושהסקריפט פורסם כ-Web App.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>👶 MayaTrack</h1>
        <p className="setup-subtitle">הגדרת חיבור ל-Google Sheets</p>

        <ol className="setup-steps">
          {STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>

        <div className="setup-input-group">
          <input
            type="text"
            className="setup-input"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            dir="ltr"
          />
          <button
            className="save-btn"
            onClick={handleConnect}
            disabled={testing || !url.trim()}
          >
            {testing ? 'בודק חיבור...' : 'התחבר'}
          </button>
        </div>

        {error && <p className="setup-error">{error}</p>}
      </div>
    </div>
  );
}

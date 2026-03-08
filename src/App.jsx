import { useState, useEffect, useCallback, useRef } from 'react';
import { isConfigured, fetchAll, addEntry, deleteEntry, updateSetting } from './services/sheetsApi';
import EntryForm from './components/EntryForm';
import Summary from './components/Summary';
import SidePanel from './components/SidePanel';
import SetupScreen from './components/SetupScreen';
import useSwipe from './hooks/useSwipe';

const SYNC_INTERVAL = 30_000;
const CACHE_KEY = 'maya-cache';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

function App() {
  const [configured, setConfigured] = useState(isConfigured);
  const [syncing, setSyncing] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(!!readCache());
  const [activeTab, setActiveTab] = useState('form');
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  const cached = readCache();
  const [feedingEntries, setFeedingEntries] = useState(cached?.feeding ?? []);
  const [diaperEntries, setDiaperEntries] = useState(cached?.diaper ?? []);
  const [pumpingEntries, setPumpingEntries] = useState(cached?.pumping ?? []);
  const [vitaminDEntries, setVitaminDEntries] = useState(cached?.vitaminD ?? []);
  const [settings, setSettings] = useState(
    cached?.settings ?? { feedingIntervalMinutes: 180, pumpingIntervalMinutes: 180 },
  );

  const syncFromSheet = useCallback(async () => {
    if (!isConfigured()) return;
    setSyncing(true);
    try {
      const data = await fetchAll();
      setFeedingEntries(data.feeding);
      setDiaperEntries(data.diaper);
      setPumpingEntries(data.pumping);
      setVitaminDEntries(data.vitaminD);
      setSettings(data.settings);
      writeCache(data);
    } catch (err) {
      console.error('Sync read error:', err);
    } finally {
      setSyncing(false);
      setInitialSyncDone(true);
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    syncFromSheet(false);
    const id = setInterval(() => syncFromSheet(false), SYNC_INTERVAL);
    return () => clearInterval(id);
  }, [configured, syncFromSheet]);

  /* ── Write helpers: write to Sheet then re-fetch ── */

  const writeAndSync = async (apiFn) => {
    await apiFn();
    await syncFromSheet();
  };

  const addFeeding = (entry) => writeAndSync(() => addEntry('feeding', entry));
  const addDiaper = (entry) => writeAndSync(() => addEntry('diaper', entry));
  const addPumping = (entry) => writeAndSync(() => addEntry('pumping', entry));
  const addVitaminD = (entry) => writeAndSync(() => addEntry('vitaminD', entry));

  const removeFeeding = (id) => writeAndSync(() => deleteEntry('feeding', id));
  const removeDiaper = (id) => writeAndSync(() => deleteEntry('diaper', id));
  const removePumping = (id) => writeAndSync(() => deleteEntry('pumping', id));
  const removeVitaminD = (id) => writeAndSync(() => deleteEntry('vitaminD', id));

  const changeSettings = (newSettings) => {
    setSettings(newSettings);
    Object.entries(newSettings).forEach(([key, value]) => {
      if (settings[key] !== value) {
        updateSetting(key, value).catch(console.error);
      }
    });
  };

  const [slideDir, setSlideDir] = useState(null);
  const mainRef = useRef(null);

  const switchTab = useCallback((tab, dir) => {
    if (tab === activeTab) return;
    setSlideDir(dir);
    requestAnimationFrame(() => {
      setActiveTab(tab);
      const el = mainRef.current;
      if (el) {
        el.addEventListener('animationend', () => setSlideDir(null), { once: true });
      }
    });
  }, [activeTab]);

  const swipeHandlers = useSwipe(
    () => switchTab('form', 'slide-right'),
    () => switchTab('summary', 'slide-left'),
  );

  /* ── Setup screen ── */

  if (!configured) {
    return <SetupScreen onReady={() => { setConfigured(true); }} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <nav className="tabs">
          <button className={activeTab === 'form' ? 'active' : ''} onClick={() => switchTab('form', 'slide-right')}>
            טופס
          </button>
          <button className={activeTab === 'summary' ? 'active' : ''} onClick={() => switchTab('summary', 'slide-left')}>
            סיכום
          </button>
        </nav>
        <h1>MayaTrack 👶</h1>
        <div className="header-left">
          {syncing && <span className="sync-spinner" title="מסנכרן..." />}
          <button className="menu-btn" onClick={() => setSidePanelOpen(true)}>☰</button>
        </div>
      </header>

      <main
        className={`app-main${slideDir ? ` ${slideDir}` : ''}`}
        ref={mainRef}
        {...swipeHandlers}
      >
        {activeTab === 'form' ? (
          <EntryForm onAddFeeding={addFeeding} onAddDiaper={addDiaper} onAddPumping={addPumping} onAddVitaminD={addVitaminD} />
        ) : (
          <Summary
            feedingEntries={feedingEntries}
            diaperEntries={diaperEntries}
            pumpingEntries={pumpingEntries}
            vitaminDEntries={vitaminDEntries}
            settings={settings}
            loading={syncing && !initialSyncDone}
          />
        )}
      </main>

      <SidePanel
        isOpen={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        feedingEntries={feedingEntries}
        diaperEntries={diaperEntries}
        pumpingEntries={pumpingEntries}
        vitaminDEntries={vitaminDEntries}
        settings={settings}
        onSettingsChange={changeSettings}
        onDeleteFeeding={removeFeeding}
        onDeleteDiaper={removeDiaper}
        onDeletePumping={removePumping}
        onDeleteVitaminD={removeVitaminD}
      />
    </div>
  );
}

export default App;

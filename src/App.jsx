import { useState, useEffect, useCallback } from 'react';
import { isConfigured, fetchAll, addEntry, deleteEntry, updateSetting } from './services/sheetsApi';
import EntryForm from './components/EntryForm';
import Summary from './components/Summary';
import SidePanel from './components/SidePanel';
import SetupScreen from './components/SetupScreen';

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

  /* ── Write helpers: optimistic local update + background Sheet write ── */

  const addFeeding = (entry) => {
    setFeedingEntries((prev) => {
      const next = [entry, ...prev];
      writeCache({ feeding: next, diaper: diaperEntries, pumping: pumpingEntries, settings });
      return next;
    });
    addEntry('feeding', entry).catch(console.error);
  };

  const addDiaper = (entry) => {
    setDiaperEntries((prev) => {
      const next = [entry, ...prev];
      writeCache({ feeding: feedingEntries, diaper: next, pumping: pumpingEntries, settings });
      return next;
    });
    addEntry('diaper', entry).catch(console.error);
  };

  const addPumping = (entry) => {
    setPumpingEntries((prev) => {
      const next = [entry, ...prev];
      writeCache({ feeding: feedingEntries, diaper: diaperEntries, pumping: next, settings });
      return next;
    });
    addEntry('pumping', entry).catch(console.error);
  };

  const removeFeeding = (id) => {
    setFeedingEntries((prev) => prev.filter((e) => e.id !== id));
    deleteEntry('feeding', id).catch(console.error);
  };

  const removeDiaper = (id) => {
    setDiaperEntries((prev) => prev.filter((e) => e.id !== id));
    deleteEntry('diaper', id).catch(console.error);
  };

  const removePumping = (id) => {
    setPumpingEntries((prev) => prev.filter((e) => e.id !== id));
    deleteEntry('pumping', id).catch(console.error);
  };

  const changeSettings = (newSettings) => {
    setSettings(newSettings);
    Object.entries(newSettings).forEach(([key, value]) => {
      if (settings[key] !== value) {
        updateSetting(key, value).catch(console.error);
      }
    });
  };

  /* ── Setup screen ── */

  if (!configured) {
    return <SetupScreen onReady={() => { setConfigured(true); }} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <nav className="tabs">
          <button className={activeTab === 'form' ? 'active' : ''} onClick={() => setActiveTab('form')}>
            טופס
          </button>
          <button className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}>
            סיכום
          </button>
        </nav>
        <h1>MayaTrack 👶</h1>
        <div className="header-left">
          {syncing && <span className="sync-spinner" title="מסנכרן..." />}
          <button className="menu-btn" onClick={() => setSidePanelOpen(true)}>☰</button>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'form' ? (
          <EntryForm onAddFeeding={addFeeding} onAddDiaper={addDiaper} onAddPumping={addPumping} />
        ) : (
          <Summary
            feedingEntries={feedingEntries}
            diaperEntries={diaperEntries}
            pumpingEntries={pumpingEntries}
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
        settings={settings}
        onSettingsChange={changeSettings}
        onDeleteFeeding={removeFeeding}
        onDeleteDiaper={removeDiaper}
        onDeletePumping={removePumping}
      />
    </div>
  );
}

export default App;

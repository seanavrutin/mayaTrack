import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { getUserFamily, subscribeToFamily, addEntry, deleteEntry, updateSetting } from './services/firebaseApi';
import EntryForm from './components/EntryForm';
import Summary from './components/Summary';
import SidePanel from './components/SidePanel';
import LoginScreen from './components/LoginScreen';
import FamilyScreen from './components/FamilyScreen';
import useSwipe from './hooks/useSwipe';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [family, setFamily] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(false);

  const [feedingEntries, setFeedingEntries] = useState([]);
  const [diaperEntries, setDiaperEntries] = useState([]);
  const [pumpingEntries, setPumpingEntries] = useState([]);
  const [vitaminDEntries, setVitaminDEntries] = useState([]);
  const [settings, setSettings] = useState({
    feedingIntervalMinutes: 180,
    pumpingIntervalMinutes: 180,
  });
  const [dataReady, setDataReady] = useState(false);

  const [activeTab, setActiveTab] = useState('form');
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [slideDir, setSlideDir] = useState(null);
  const mainRef = useRef(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setFamily(null);
      setFamilyLoading(false);
      return;
    }
    setFamilyLoading(true);
    getUserFamily(user.uid)
      .then(setFamily)
      .catch(console.error)
      .finally(() => setFamilyLoading(false));
  }, [user]);

  useEffect(() => {
    if (!family?.familyId) {
      setDataReady(false);
      setFeedingEntries([]);
      setDiaperEntries([]);
      setPumpingEntries([]);
      setVitaminDEntries([]);
      return;
    }

    const ready = { feedings: false, diapers: false, pumpings: false, vitaminD: false, settings: false };
    function checkReady() {
      if (Object.values(ready).every(Boolean)) setDataReady(true);
    }

    return subscribeToFamily(family.familyId, {
      feedings: (entries) => { setFeedingEntries(entries); ready.feedings = true; checkReady(); },
      diapers: (entries) => { setDiaperEntries(entries); ready.diapers = true; checkReady(); },
      pumpings: (entries) => { setPumpingEntries(entries); ready.pumpings = true; checkReady(); },
      vitaminD: (entries) => { setVitaminDEntries(entries); ready.vitaminD = true; checkReady(); },
      settings: (s) => {
        setSettings({
          feedingIntervalMinutes: s.feedingIntervalMinutes || 180,
          pumpingIntervalMinutes: s.pumpingIntervalMinutes || 180,
        });
        ready.settings = true;
        checkReady();
      },
    });
  }, [family?.familyId]);

  const handleAddEntry = async (collectionName, entry) => {
    await addEntry(family.familyId, collectionName, entry);
  };

  const handleDeleteEntry = async (collectionName, id) => {
    await deleteEntry(family.familyId, collectionName, id);
  };

  const handleSettingsChange = (newSettings) => {
    Object.entries(newSettings).forEach(([key, value]) => {
      if (settings[key] !== value) {
        updateSetting(family.familyId, key, value).catch(console.error);
      }
    });
  };

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

  if (authLoading || familyLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>טוען...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!family) {
    return <FamilyScreen user={user} onFamilyReady={setFamily} />;
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
          <button className="menu-btn" onClick={() => setSidePanelOpen(true)}>☰</button>
        </div>
      </header>

      <main
        className={`app-main${slideDir ? ` ${slideDir}` : ''}`}
        ref={mainRef}
        {...swipeHandlers}
      >
        {activeTab === 'form' ? (
          <EntryForm
            onAddFeeding={(e) => handleAddEntry('feedings', e)}
            onAddDiaper={(e) => handleAddEntry('diapers', e)}
            onAddPumping={(e) => handleAddEntry('pumpings', e)}
            onAddVitaminD={(e) => handleAddEntry('vitaminD', e)}
          />
        ) : (
          <Summary
            feedingEntries={feedingEntries}
            diaperEntries={diaperEntries}
            pumpingEntries={pumpingEntries}
            vitaminDEntries={vitaminDEntries}
            settings={settings}
            loading={!dataReady}
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
        onSettingsChange={handleSettingsChange}
        onDeleteFeeding={(id) => handleDeleteEntry('feedings', id)}
        onDeleteDiaper={(id) => handleDeleteEntry('diapers', id)}
        onDeletePumping={(id) => handleDeleteEntry('pumpings', id)}
        onDeleteVitaminD={(id) => handleDeleteEntry('vitaminD', id)}
        family={family}
        user={user}
      />
    </div>
  );
}

export default App;

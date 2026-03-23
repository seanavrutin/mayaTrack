import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { getUserFamily, subscribeToFamily, addEntry, deleteEntry, updateSetting, addKid, updateKid, deleteKid } from './services/firebaseApi';
import EntryForm from './components/EntryForm';
import Summary from './components/Summary';
import SidePanel from './components/SidePanel';
import SettingsModal from './components/SettingsModal';
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
  const [medicationLogs, setMedicationLogs] = useState([]);
  const [kids, setKids] = useState([]);
  const [settings, setSettings] = useState({
    feedingIntervalMinutes: 180,
    pumpingIntervalMinutes: 180,
  });
  const [dataReady, setDataReady] = useState(false);

  const [activeKidId, setActiveKidId] = useState(null);
  const [activeTab, setActiveTab] = useState('form');
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
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
      setMedicationLogs([]);
      setKids([]);
      return;
    }

    const ready = { feedings: false, diapers: false, pumpings: false, vitaminD: false, medicationLogs: false, kids: false, settings: false };
    function checkReady() {
      if (Object.values(ready).every(Boolean)) setDataReady(true);
    }

    return subscribeToFamily(family.familyId, {
      feedings: (entries) => { setFeedingEntries(entries); ready.feedings = true; checkReady(); },
      diapers: (entries) => { setDiaperEntries(entries); ready.diapers = true; checkReady(); },
      pumpings: (entries) => { setPumpingEntries(entries); ready.pumpings = true; checkReady(); },
      vitaminD: (entries) => { setVitaminDEntries(entries); ready.vitaminD = true; checkReady(); },
      medicationLogs: (entries) => { setMedicationLogs(entries); ready.medicationLogs = true; checkReady(); },
      kids: (k) => { setKids(k); ready.kids = true; checkReady(); },
      settings: (s) => {
        setSettings({
          feedingIntervalMinutes: s.feedingIntervalMinutes ?? 180,
          pumpingIntervalMinutes: s.pumpingIntervalMinutes ?? 180,
        });
        ready.settings = true;
        checkReady();
      },
    });
  }, [family?.familyId]);

  useEffect(() => {
    if (kids.length > 0 && (!activeKidId || !kids.find(k => k.id === activeKidId))) {
      setActiveKidId(kids[0].id);
    }
  }, [kids, activeKidId]);

  const activeKid = kids.find(k => k.id === activeKidId) || null;

  const kidFeedingEntries = feedingEntries.filter(e => e.kidId === activeKidId || !e.kidId);
  const kidDiaperEntries = diaperEntries.filter(e => e.kidId === activeKidId || !e.kidId);

  const legacyVitaminDLogs = vitaminDEntries.map(e => ({
    medicationName: 'ויטמין D',
    kidId: activeKidId,
    time: e.time,
  }));
  const kidMedicationLogs = [
    ...medicationLogs.filter(e => e.kidId === activeKidId),
    ...legacyVitaminDLogs,
  ];

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

  const handleAddKid = async (kidData) => {
    await addKid(family.familyId, kidData);
  };

  const handleUpdateKid = async (kidId, kidData) => {
    await updateKid(family.familyId, kidId, kidData);
  };

  const handleDeleteKid = async (kidId) => {
    await deleteKid(family.familyId, kidId);
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

      {kids.length > 1 && (
        <div className="kid-switcher">
          {kids.map((kid) => (
            <button
              key={kid.id}
              className={`kid-switcher-btn ${kid.id === activeKidId ? 'active' : ''}`}
              onClick={() => setActiveKidId(kid.id)}
            >
              {kid.name}
            </button>
          ))}
        </div>
      )}

      <main
        className={`app-main${slideDir ? ` ${slideDir}` : ''}`}
        ref={mainRef}
        {...swipeHandlers}
      >
        <div style={{ display: activeTab === 'form' ? 'block' : 'none' }}>
          <EntryForm
            onAddFeeding={(e) => handleAddEntry('feedings', { ...e, kidId: activeKidId })}
            onAddDiaper={(e) => handleAddEntry('diapers', { ...e, kidId: activeKidId })}
            onAddPumping={(e) => handleAddEntry('pumpings', e)}
            feedingEntries={kidFeedingEntries}
            medications={activeKid?.medications || []}
            medicationLogs={kidMedicationLogs}
            onLogMedication={(medName) => handleAddEntry('medicationLogs', {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2),
              kidId: activeKidId,
              medicationName: medName,
              time: new Date().toISOString(),
            })}
          />
        </div>
        {activeTab === 'summary' && (
          <Summary
            feedingEntries={kidFeedingEntries}
            diaperEntries={kidDiaperEntries}
            pumpingEntries={pumpingEntries}
            medications={activeKid?.medications || []}
            medicationLogs={kidMedicationLogs}
            onLogMedication={(medName) => handleAddEntry('medicationLogs', {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2),
              kidId: activeKidId,
              medicationName: medName,
              time: new Date().toISOString(),
            })}
            settings={settings}
            loading={!dataReady}
          />
        )}
      </main>

      <SidePanel
        isOpen={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        feedingEntries={kidFeedingEntries}
        diaperEntries={kidDiaperEntries}
        pumpingEntries={pumpingEntries}
        medicationLogs={kidMedicationLogs}
        onDeleteFeeding={(id) => handleDeleteEntry('feedings', id)}
        onDeleteDiaper={(id) => handleDeleteEntry('diapers', id)}
        onDeletePumping={(id) => handleDeleteEntry('pumpings', id)}
        onDeleteMedicationLog={(id) => handleDeleteEntry('medicationLogs', id)}
        family={family}
        activeKid={activeKid}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        family={family}
        user={user}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        kids={kids}
        onAddKid={handleAddKid}
        onUpdateKid={handleUpdateKid}
        onDeleteKid={handleDeleteKid}
      />
    </div>
  );
}

export default App;

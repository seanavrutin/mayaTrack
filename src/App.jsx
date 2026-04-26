import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { getUserFamily, subscribeToFamily, addEntry, updateEntry, deleteEntry, updateSetting, addKid, updateKid, deleteKid } from './services/firebaseApi';
import { loadCache, saveCache, clearCache } from './services/cache';
import EntryForm from './components/EntryForm';
import Summary from './components/Summary';
import SidePanel from './components/SidePanel';
import SettingsModal from './components/SettingsModal';
import LoginScreen from './components/LoginScreen';
import FamilyScreen from './components/FamilyScreen';
import SyncBanner from './components/SyncBanner';
import useSwipe from './hooks/useSwipe';
import useNow from './hooks/useNow';

const SUBSCRIPTION_SOURCES = ['feedings', 'diapers', 'pumpings', 'vitaminD', 'medicationLogs', 'kids', 'settings'];

const DEFAULT_SETTINGS = { feedingIntervalMinutes: 180, pumpingIntervalMinutes: 180 };

function buildSyncingStatus() {
  return SUBSCRIPTION_SOURCES.reduce((acc, src) => {
    acc[src] = 'syncing';
    return acc;
  }, {});
}

function App() {
  const initialCache = useMemo(() => loadCache(), []);
  const hasCache = initialCache !== null;

  const [user, setUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);

  const [family, setFamily] = useState(initialCache?.family ?? null);
  const [familyLoading, setFamilyLoading] = useState(false);

  const [feedingEntries, setFeedingEntries] = useState(initialCache?.feedingEntries ?? []);
  const [diaperEntries, setDiaperEntries] = useState(initialCache?.diaperEntries ?? []);
  const [pumpingEntries, setPumpingEntries] = useState(initialCache?.pumpingEntries ?? []);
  const [vitaminDEntries, setVitaminDEntries] = useState(initialCache?.vitaminDEntries ?? []);
  const [medicationLogs, setMedicationLogs] = useState(initialCache?.medicationLogs ?? []);
  const [kids, setKids] = useState(initialCache?.kids ?? []);
  const [settings, setSettings] = useState(initialCache?.settings ?? DEFAULT_SETTINGS);

  const [sourceStatus, setSourceStatus] = useState(() => (hasCache ? buildSyncingStatus() : {}));
  const [firstSyncDone, setFirstSyncDone] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(initialCache?.lastUpdated ?? null);
  const [showUpdatedToast, setShowUpdatedToast] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const lastSubscribedFamilyRef = useRef(null);
  const sourceStatusRef = useRef(sourceStatus);
  const lastHiddenAtRef = useRef(null);

  const [activeKidId, setActiveKidId] = useState(initialCache?.activeKidId ?? null);
  const [activeTab, setActiveTab] = useState('form');
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [slideDir, setSlideDir] = useState(null);
  const mainRef = useRef(null);

  const { now, tick } = useNow(30_000);

  const resetAfterSignOut = useCallback(() => {
    setFamily(null);
    setFeedingEntries([]);
    setDiaperEntries([]);
    setPumpingEntries([]);
    setVitaminDEntries([]);
    setMedicationLogs([]);
    setKids([]);
    setSettings(DEFAULT_SETTINGS);
    setActiveKidId(null);
    setLastUpdated(null);
    setSourceStatus({});
    setFirstSyncDone(false);
    setShowUpdatedToast(false);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setAuthResolved(true);
      setUser(firebaseUser);

      if (!firebaseUser) {
        clearCache();
        resetAfterSignOut();
        return;
      }

      const cur = loadCache();
      if (cur && cur.userId !== firebaseUser.uid) {
        clearCache();
        resetAfterSignOut();
      }
    });
  }, [resetAfterSignOut]);

  useEffect(() => {
    if (!user) return;
    if (family && initialCache?.userId === user.uid) {
      return;
    }

    setFamilyLoading(true);
    getUserFamily(user.uid)
      .then((f) => {
        if (f) setFamily(f);
      })
      .catch(console.error)
      .finally(() => setFamilyLoading(false));
  }, [user, family, initialCache]);

  useEffect(() => {
    if (!family?.familyId) {
      return;
    }

    const isNewFamily = lastSubscribedFamilyRef.current !== family.familyId;
    lastSubscribedFamilyRef.current = family.familyId;

    let timeoutId = null;

    if (isNewFamily) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (offline) {
        setSourceStatus(SUBSCRIPTION_SOURCES.reduce((acc, s) => { acc[s] = 'error'; return acc; }, {}));
      } else {
        setSourceStatus(buildSyncingStatus());
      }
      setFirstSyncDone(false);

      timeoutId = setTimeout(() => {
        setSourceStatus((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const k of SUBSCRIPTION_SOURCES) {
            if (next[k] === 'syncing') {
              next[k] = 'error';
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }, 8000);
    }

    const unsub = subscribeToFamily(family.familyId, {
      feedings: setFeedingEntries,
      diapers: setDiaperEntries,
      pumpings: setPumpingEntries,
      vitaminD: setVitaminDEntries,
      medicationLogs: setMedicationLogs,
      kids: setKids,
      settings: (s) => setSettings({
        feedingIntervalMinutes: s.feedingIntervalMinutes ?? 180,
        pumpingIntervalMinutes: s.pumpingIntervalMinutes ?? 180,
      }),
      onStatus: (source, status) => {
        setSourceStatus((prev) => (prev[source] === status ? prev : { ...prev, [source]: status }));
      },
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsub();
    };
  }, [family?.familyId, retryKey]);

  useEffect(() => {
    sourceStatusRef.current = sourceStatus;
  }, [sourceStatus]);

  useEffect(() => {
    const handleOnline = () => {
      const hasError = Object.values(sourceStatusRef.current).some((s) => s === 'error');
      if (hasError) setRetryKey((k) => k + 1);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    const BACKGROUND_RETRY_THRESHOLD_MS = 10000;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState !== 'visible') return;
      const hiddenAt = lastHiddenAtRef.current;
      lastHiddenAtRef.current = null;
      const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
      if (hiddenFor < BACKGROUND_RETRY_THRESHOLD_MS) return;
      setRetryKey((k) => k + 1);
    };

    const handlePageShow = (e) => {
      if (e.persisted) setRetryKey((k) => k + 1);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  useEffect(() => {
    if (firstSyncDone) return;
    const states = SUBSCRIPTION_SOURCES.map((s) => sourceStatus[s]);
    if (states.some((s) => !s || s === 'syncing')) return;

    setFirstSyncDone(true);
    if (states.every((s) => s === 'ok')) {
      setShowUpdatedToast(true);
    }
  }, [sourceStatus, firstSyncDone]);

  useEffect(() => {
    if (!showUpdatedToast) return;
    const t = setTimeout(() => setShowUpdatedToast(false), 2500);
    return () => clearTimeout(t);
  }, [showUpdatedToast]);

  useEffect(() => {
    if (!user || !family?.familyId) return;
    const anyOk = Object.values(sourceStatus).some((s) => s === 'ok');
    if (!anyOk) return;

    const handle = setTimeout(() => {
      const now = Date.now();
      setLastUpdated(now);
      saveCache({
        userId: user.uid,
        family,
        kids,
        settings,
        feedingEntries,
        diaperEntries,
        pumpingEntries,
        vitaminDEntries,
        medicationLogs,
        activeKidId,
        lastUpdated: now,
      });
    }, 500);
    return () => clearTimeout(handle);
  }, [user, family, kids, settings, feedingEntries, diaperEntries, pumpingEntries, vitaminDEntries, medicationLogs, activeKidId, sourceStatus]);

  useEffect(() => {
    if (kids.length > 0 && (!activeKidId || !kids.find((k) => k.id === activeKidId))) {
      setActiveKidId(kids[0].id);
    }
  }, [kids, activeKidId]);

  const activeKid = kids.find((k) => k.id === activeKidId) || null;

  const kidFeedingEntries = feedingEntries.filter((e) => e.kidId === activeKidId || !e.kidId);
  const kidDiaperEntries = diaperEntries.filter((e) => e.kidId === activeKidId || !e.kidId);

  const legacyVitaminDLogs = vitaminDEntries.map((e) => ({
    medicationName: 'ויטמין D',
    kidId: activeKidId,
    time: e.time,
  }));
  const kidMedicationLogs = [
    ...medicationLogs.filter((e) => e.kidId === activeKidId),
    ...legacyVitaminDLogs,
  ];

  const handleAddEntry = async (collectionName, entry) => {
    await addEntry(family.familyId, collectionName, entry);
  };

  const handleUpdateEntry = async (collectionName, id, data) => {
    await updateEntry(family.familyId, collectionName, id, data);
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

  const handleRetrySync = useCallback(() => {
    setSourceStatus(buildSyncingStatus());
    setFirstSyncDone(false);
    setRetryKey((k) => k + 1);
  }, []);

  const switchTab = useCallback((tab, dir) => {
    if (tab === activeTab) return;
    tick();
    setSlideDir(dir);
    requestAnimationFrame(() => {
      setActiveTab(tab);
      const el = mainRef.current;
      if (el) {
        el.addEventListener('animationend', () => setSlideDir(null), { once: true });
      }
    });
  }, [activeTab, tick]);

  const swipeHandlers = useSwipe(
    () => switchTab('form', 'slide-right'),
    () => switchTab('summary', 'slide-left'),
  );

  if (!hasCache && !authResolved) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>טוען...</p>
      </div>
    );
  }

  if (authResolved && !user) {
    return <LoginScreen />;
  }

  if (!family) {
    if (familyLoading) {
      return (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>טוען...</p>
        </div>
      );
    }
    return <FamilyScreen user={user} onFamilyReady={setFamily} />;
  }

  const summaryLoading = !hasCache && !firstSyncDone;

  return (
    <div className="app">
      <SyncBanner
        sourceStatus={sourceStatus}
        lastUpdated={lastUpdated}
        showUpdatedToast={showUpdatedToast}
        onRetry={handleRetrySync}
      />
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
            now={now}
            onAddFeeding={(e) => handleAddEntry('feedings', { ...e, kidId: activeKidId })}
            onSupplementFeeding={(id, data) => handleUpdateEntry('feedings', id, data)}
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
            now={now}
            firstSyncDone={firstSyncDone}
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
            loading={summaryLoading}
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

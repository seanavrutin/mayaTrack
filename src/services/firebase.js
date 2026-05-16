import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDlJI90SX46io5Tj-FOEkd35tT0JzsBK-8",
  authDomain: "mayatrack-c740f.firebaseapp.com",
  projectId: "mayatrack-c740f",
  storageBucket: "mayatrack-c740f.firebasestorage.app",
  messagingSenderId: "884250869220",
  appId: "1:884250869220:web:7a4d94a9c28c3d6c175bf1",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// IndexedDB-backed cache: queues writes when offline / flaky and replays
// them automatically when the connection returns. This is the single most
// important safety net against records being silently dropped.
// We fall back to the default (memory) cache if persistence can't be
// initialized (e.g. Safari private mode, IndexedDB blocked), so the app
// still works — just without offline queueing.
function createDb() {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
          cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        }),
      },
      'maya-track-db',
    );
  } catch (err) {
    console.warn('firebase: persistent cache unavailable, falling back to memory cache', err);
    return getFirestore(app, 'maya-track-db');
  }
}

export const db = createDb();

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function logOut() {
  return signOut(auth);
}

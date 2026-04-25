import { db } from './firebase';
import {
  collection, doc, setDoc, deleteDoc, getDoc, getDocs,
  query, orderBy, where, onSnapshot, serverTimestamp,
  updateDoc, arrayUnion,
} from 'firebase/firestore';

function generateFamilyCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createFamily(userId, familyName) {
  const familyCode = generateFamilyCode();
  const familyRef = doc(collection(db, 'families'));
  const familyData = {
    name: familyName,
    code: familyCode,
    members: [userId],
    createdBy: userId,
    createdAt: serverTimestamp(),
  };

  await setDoc(familyRef, familyData);
  await setDoc(doc(db, 'users', userId), { familyId: familyRef.id }, { merge: true });
  await setDoc(doc(db, 'families', familyRef.id, 'settings', 'general'), {
    feedingIntervalMinutes: 180,
    pumpingIntervalMinutes: 180,
  });

  return { familyId: familyRef.id, name: familyName, code: familyCode, members: [userId] };
}

export async function joinFamily(userId, familyCode) {
  const q = query(collection(db, 'families'), where('code', '==', familyCode));
  const snapshot = await getDocs(q);

  if (snapshot.empty) throw new Error('Family not found');

  const familyDoc = snapshot.docs[0];
  const familyId = familyDoc.id;
  const data = familyDoc.data();

  if (!data.members.includes(userId)) {
    await updateDoc(doc(db, 'families', familyId), {
      members: arrayUnion(userId),
    });
  }

  await setDoc(doc(db, 'users', userId), { familyId }, { merge: true });

  return { familyId, name: data.name, code: data.code, members: [...new Set([...data.members, userId])] };
}

export async function getUserFamily(userId) {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;

  const { familyId } = userDoc.data();
  if (!familyId) return null;

  const familyDoc = await getDoc(doc(db, 'families', familyId));
  if (!familyDoc.exists()) return null;

  return { familyId, ...familyDoc.data() };
}

export function subscribeToFamily(familyId, callbacks) {
  const unsubs = [];
  const notifyStatus = (source, status, err) => callbacks.onStatus?.(source, status, err);

  const cols = ['feedings', 'diapers', 'pumpings', 'vitaminD', 'medicationLogs'];
  cols.forEach((col) => {
    const ref = collection(db, 'families', familyId, col);
    const q = query(ref, orderBy('time', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.metadata.fromCache) return;
        const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callbacks[col]?.(entries);
        notifyStatus(col, 'ok');
      },
      (err) => {
        console.error(`subscribeToFamily: ${col} listener error`, err);
        notifyStatus(col, 'error', err);
      },
    );
    unsubs.push(unsub);
  });

  const kidsUnsub = onSnapshot(
    collection(db, 'families', familyId, 'kids'),
    (snap) => {
      if (snap.metadata.fromCache) return;
      const kids = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callbacks.kids?.(kids);
      notifyStatus('kids', 'ok');
    },
    (err) => {
      console.error('subscribeToFamily: kids listener error', err);
      notifyStatus('kids', 'error', err);
    },
  );
  unsubs.push(kidsUnsub);

  const settingsUnsub = onSnapshot(
    doc(db, 'families', familyId, 'settings', 'general'),
    (snap) => {
      if (snap.metadata.fromCache) return;
      callbacks.settings?.(snap.exists() ? snap.data() : {});
      notifyStatus('settings', 'ok');
    },
    (err) => {
      console.error('subscribeToFamily: settings listener error', err);
      notifyStatus('settings', 'error', err);
    },
  );
  unsubs.push(settingsUnsub);

  return () => unsubs.forEach((fn) => fn());
}

export async function addEntry(familyId, collectionName, data) {
  const { id, ...fields } = data;
  const colRef = collection(db, 'families', familyId, collectionName);
  const docRef = id ? doc(db, 'families', familyId, collectionName, id) : doc(colRef);
  await setDoc(docRef, fields);
}

export async function updateEntry(familyId, collectionName, entryId, data) {
  await updateDoc(doc(db, 'families', familyId, collectionName, entryId), data);
}

export async function deleteEntry(familyId, collectionName, entryId) {
  await deleteDoc(doc(db, 'families', familyId, collectionName, entryId));
}

export async function updateSetting(familyId, key, value) {
  await updateDoc(doc(db, 'families', familyId, 'settings', 'general'), {
    [key]: value,
  });
}

export async function addKid(familyId, kidData) {
  const colRef = collection(db, 'families', familyId, 'kids');
  const docRef = doc(colRef);
  await setDoc(docRef, { ...kidData, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function updateKid(familyId, kidId, kidData) {
  await updateDoc(doc(db, 'families', familyId, 'kids', kidId), kidData);
}

export async function deleteKid(familyId, kidId) {
  await deleteDoc(doc(db, 'families', familyId, 'kids', kidId));
}


import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, deleteDoc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDlJI90SX46io5Tj-FOEkd35tT0JzsBK-8",
  authDomain: "mayatrack-c740f.firebaseapp.com",
  projectId: "mayatrack-c740f",
  storageBucket: "mayatrack-c740f.firebasestorage.app",
  messagingSenderId: "884250869220",
  appId: "1:884250869220:web:7a4d94a9c28c3d6c175bf1",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'maya-track-db');

async function cleanup() {
  const snapshot = await getDocs(query(
    collection(db, 'families'),
    where('code', '==', '1NXQKO'),
  ));

  if (snapshot.empty) {
    console.log('Orphan family already cleaned up.');
    process.exit(0);
  }

  const familyDoc = snapshot.docs[0];
  const familyId = familyDoc.id;

  const subcollections = ['feedings', 'diapers', 'pumpings', 'vitaminD', 'settings'];
  for (const sub of subcollections) {
    const docs = await getDocs(collection(db, 'families', familyId, sub));
    for (const d of docs.docs) {
      await deleteDoc(d.ref);
    }
  }

  await deleteDoc(doc(db, 'families', familyId));
  console.log('Orphan family "המשפחה שלי" (1NXQKO) deleted.');
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});

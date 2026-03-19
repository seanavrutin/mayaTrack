import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDocs, setDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';

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

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  const familyName = process.argv.find(a => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]) || 'אברוטין';
  const kidName = 'מאיה';

  console.log(DRY_RUN ? '\n=== DRY RUN (no writes) ===\n' : '');
  console.log(`Family: "${familyName}"`);
  console.log(`Kid name: "${kidName}"\n`);

  const snapshot = await getDocs(query(
    collection(db, 'families'),
    where('name', '==', familyName),
  ));

  if (snapshot.empty) {
    console.error(`Family "${familyName}" not found in Firestore.`);
    process.exit(1);
  }

  const familyDoc = snapshot.docs[0];
  const familyId = familyDoc.id;
  console.log(`Found family "${familyName}" (ID: ${familyId})\n`);

  // Step 1: Check if kids already exist
  const existingKids = await getDocs(collection(db, 'families', familyId, 'kids'));
  let kidId;

  if (existingKids.empty) {
    const kidRef = doc(collection(db, 'families', familyId, 'kids'));
    kidId = kidRef.id;
    console.log(`Creating kid "${kidName}" (ID: ${kidId})`);

    if (!DRY_RUN) {
      await setDoc(kidRef, {
        name: kidName,
        medications: [{ name: 'ויטמין D', timesPerDay: 1 }],
        createdAt: serverTimestamp(),
      });
    }
    console.log(`  -> Kid created${DRY_RUN ? ' (dry run)' : ''}\n`);
  } else {
    const firstKid = existingKids.docs[0];
    kidId = firstKid.id;
    console.log(`Kid already exists: "${firstKid.data().name}" (ID: ${kidId}). Skipping creation.\n`);
  }

  // Step 2: Backfill kidId on feedings
  const feedings = await getDocs(collection(db, 'families', familyId, 'feedings'));
  let feedingCount = 0;
  let feedingSkipped = 0;

  for (const feedingDoc of feedings.docs) {
    if (feedingDoc.data().kidId) {
      feedingSkipped++;
      continue;
    }
    feedingCount++;
    if (!DRY_RUN) {
      await updateDoc(doc(db, 'families', familyId, 'feedings', feedingDoc.id), { kidId });
    }
  }
  console.log(`Feedings: ${feedingCount} updated, ${feedingSkipped} already had kidId${DRY_RUN ? ' (dry run)' : ''}`);

  // Step 3: Backfill kidId on diapers
  const diapers = await getDocs(collection(db, 'families', familyId, 'diapers'));
  let diaperCount = 0;
  let diaperSkipped = 0;

  for (const diaperDoc of diapers.docs) {
    if (diaperDoc.data().kidId) {
      diaperSkipped++;
      continue;
    }
    diaperCount++;
    if (!DRY_RUN) {
      await updateDoc(doc(db, 'families', familyId, 'diapers', diaperDoc.id), { kidId });
    }
  }
  console.log(`Diapers:  ${diaperCount} updated, ${diaperSkipped} already had kidId${DRY_RUN ? ' (dry run)' : ''}`);

  const total = feedingCount + diaperCount;
  console.log(`\n--- Migration ${DRY_RUN ? 'preview' : 'complete'}! ---`);
  console.log(`Kid: "${kidName}" (${kidId})`);
  console.log(`Total documents updated: ${total}`);
  console.log(`(Pumpings not tagged — they are family-level, not per-kid)\n`);

  if (DRY_RUN) {
    console.log('Run without --dry-run to apply changes.\n');
  }

  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

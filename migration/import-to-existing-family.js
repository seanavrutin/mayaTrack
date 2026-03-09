import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDocs, writeBatch, query, where,
} from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function parseCSV(filename) {
  const filePath = resolve(__dirname, filename);
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').map((l) => l.replace(/\r$/, ''));
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => (obj[h] = values[i]?.trim() ?? ''));
    return obj;
  });
}

function toBool(v) {
  return v === 'TRUE' || v === 'true';
}

async function migrate() {
  const familyName = process.argv[2] || 'אברוטין';

  console.log(`\nLooking for family: "${familyName}"...\n`);

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

  const feedings = parseCSV('MayaTrack - feeding.csv');
  const diapers = parseCSV('MayaTrack - diaper.csv');
  const pumpings = parseCSV('MayaTrack - pumping.csv');
  const vitaminD = parseCSV('MayaTrack - vitaminD.csv');

  const total = feedings.length + diapers.length + pumpings.length + vitaminD.length;
  console.log(`  Feedings:  ${feedings.length}`);
  console.log(`  Diapers:   ${diapers.length}`);
  console.log(`  Pumpings:  ${pumpings.length}`);
  console.log(`  Vitamin D: ${vitaminD.length}`);
  console.log(`  Total:     ${total} entries\n`);

  const batch = writeBatch(db);

  feedings.forEach((entry) => {
    batch.set(doc(db, 'families', familyId, 'feedings', entry.id), {
      time: entry.time,
      formula: Number(entry.formula) || 0,
      pumpedMilk: Number(entry.pumpedMilk) || 0,
      breastfeedingMinutes: Number(entry.breastfeedingMinutes) || 0,
    });
  });

  diapers.forEach((entry) => {
    batch.set(doc(db, 'families', familyId, 'diapers', entry.id), {
      time: entry.time,
      pee: toBool(entry.pee),
      poop: toBool(entry.poop),
      empty: toBool(entry.empty),
    });
  });

  pumpings.forEach((entry) => {
    batch.set(doc(db, 'families', familyId, 'pumpings', entry.id), {
      time: entry.time,
      durationMinutes: Number(entry.durationMinutes) || 0,
    });
  });

  vitaminD.forEach((entry) => {
    batch.set(doc(db, 'families', familyId, 'vitaminD', entry.id), {
      time: entry.time,
    });
  });

  console.log('Writing to Firestore...');
  await batch.commit();

  console.log('\n--- Migration complete! ---');
  console.log(`All ${total} entries imported into family "${familyName}".\n`);

  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

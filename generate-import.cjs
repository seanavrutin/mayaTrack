const fs = require('fs');

const csv = fs.readFileSync(
  'מעקב מאיה (תגובות) - תגובות לטופס 1.csv',
  'utf8',
);
const lines = csv.trim().split('\n').slice(1);

const feeding = [];
const diaper = [];
const pumping = [];
let counter = 1;

const pad = (n) => String(n).padStart(2, '0');

lines.forEach((line) => {
  const p = line.split(',');
  const [datePart] = p[0].split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes] = p[1].split(':').map(Number);
  const type = p[2].trim();

  // Israel Standard Time = UTC+2 (February is winter)
  let uh = hours - 2;
  let ud = day, um = month, uy = year;
  if (uh < 0) {
    uh += 24;
    ud -= 1;
    if (ud < 1) {
      um -= 1;
      if (um < 1) { um = 12; uy -= 1; }
      ud = new Date(uy, um, 0).getDate();
    }
  }

  const iso = `${uy}-${pad(um)}-${pad(ud)}T${pad(uh)}:${pad(minutes)}:00.000Z`;
  const id = `imp${counter++}`;

  if (type === 'אוכל') {
    feeding.push({ id, time: iso, formula: Number(p[6]) || 0, pumpedMilk: Number(p[7]) || 0, bf: Number(p[8]) || 0 });
  } else if (type === 'טיטול') {
    const dt = (p[5] || '').trim();
    diaper.push({ id, time: iso, pee: dt.includes('פיפי'), poop: dt.includes('קקי'), empty: dt.includes('ריק') });
  } else if (type === 'שאיבה') {
    const dur = Math.max(Number(p[3]) || 0, Number(p[4]) || 0);
    pumping.push({ id, time: iso, dur });
  }
});

let s = `// הדביקו פונקציה זו ב-Apps Script, הריצו אותה פעם אחת, ואז מחקו אותה.\n\n`;
s += `function importData() {\n  setup();\n  var ss = SpreadsheetApp.getActiveSpreadsheet();\n\n`;

s += `  var f = ss.getSheetByName('feeding');\n`;
feeding.forEach((e) => {
  s += `  f.appendRow(['${e.id}', '${e.time}', ${e.formula}, ${e.pumpedMilk}, ${e.bf}]);\n`;
});

s += `\n  var d = ss.getSheetByName('diaper');\n`;
diaper.forEach((e) => {
  s += `  d.appendRow(['${e.id}', '${e.time}', ${e.pee}, ${e.poop}, ${e.empty}]);\n`;
});

s += `\n  var p = ss.getSheetByName('pumping');\n`;
pumping.forEach((e) => {
  s += `  p.appendRow(['${e.id}', '${e.time}', ${e.dur}]);\n`;
});

s += `}\n`;

fs.writeFileSync('import-data-to-sheets.js', s, 'utf8');
console.log(`Done! Feeding: ${feeding.length}, Diaper: ${diaper.length}, Pumping: ${pumping.length}`);

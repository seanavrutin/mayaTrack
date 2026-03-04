// ==============================================================
// קוד זה צריך להיות מועתק ל-Google Apps Script של הגיליון שלך.
// חשוב: הפעילו את Google Sheets API ב-Services (ראו הוראות למטה).
// ==============================================================

// ── הוראות הפעלת Sheets Advanced Service ──
// 1. בעורך Apps Script, לחצו על "+" ליד "Services" בסרגל השמאלי
// 2. חפשו "Google Sheets API" ולחצו Add
// 3. זהו! עכשיו אפשר לפרוס מחדש

var SHEET_NAMES = ['feeding', 'diaper', 'pumping', 'vitaminD', 'settings'];

var HEADERS = {
  feeding: ['id', 'time', 'formula', 'pumpedMilk', 'breastfeedingMinutes'],
  diaper: ['id', 'time', 'pee', 'poop', 'empty'],
  pumping: ['id', 'time', 'durationMinutes'],
  vitaminD: ['id', 'time'],
  settings: ['key', 'value']
};

var DEFAULT_SETTINGS = [
  ['feedingIntervalMinutes', 180],
  ['pumpingIntervalMinutes', 180]
];

// Run once manually to create sheets (or call from doPost on first use)
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < SHEET_NAMES.length; i++) {
    var name = SHEET_NAMES[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(HEADERS[name]);
      if (name === 'settings') {
        DEFAULT_SETTINGS.forEach(function (row) { sheet.appendRow(row); });
      }
    }
  }
}

function doGet() {
  var ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var ranges = SHEET_NAMES.map(function (n) { return n + '!A:Z'; });
  var response = Sheets.Spreadsheets.Values.batchGet(ssId, { ranges: ranges });

  var result = {};
  for (var i = 0; i < SHEET_NAMES.length; i++) {
    var name = SHEET_NAMES[i];
    var values = response.valueRanges[i].values;
    if (!values || values.length <= 1) { result[name] = []; continue; }
    var headers = values[0];
    result[name] = values.slice(1).map(function (row) {
      var obj = {};
      headers.forEach(function (h, j) { obj[h] = row[j] !== undefined ? row[j] : ''; });
      return obj;
    });
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var payload = JSON.parse(e.postData.contents);

  if (payload.action === 'add') {
    var sheet = ss.getSheetByName(payload.sheet);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row = headers.map(function (h) {
      return payload.data[h] !== undefined ? payload.data[h] : '';
    });
    sheet.appendRow(row);
  }

  if (payload.action === 'delete') {
    var sheet = ss.getSheetByName(payload.sheet);
    var data = sheet.getDataRange().getValues();
    var idCol = data[0].indexOf('id');
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][idCol]) === String(payload.id)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }

  if (payload.action === 'updateSetting') {
    var sheet = ss.getSheetByName('settings');
    var data = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === payload.key) {
        sheet.getRange(i + 1, 2).setValue(payload.value);
        found = true;
        break;
      }
    }
    if (!found) sheet.appendRow([payload.key, payload.value]);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================
// קוד זה צריך להיות מועתק ל-Google Apps Script של הגיליון שלך.
// ראה הוראות בקובץ SetupScreen.jsx או באפליקציה עצמה.
// ==============================================================

var SHEETS = {
  feeding: ['id', 'time', 'formula', 'pumpedMilk', 'breastfeedingMinutes'],
  diaper: ['id', 'time', 'pee', 'poop', 'empty'],
  pumping: ['id', 'time', 'durationMinutes'],
  settings: ['key', 'value']
};

var DEFAULT_SETTINGS = [
  ['feedingIntervalMinutes', 180],
  ['pumpingIntervalMinutes', 180]
];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var name in SHEETS) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(SHEETS[name]);
      if (name === 'settings') {
        DEFAULT_SETTINGS.forEach(function (row) { sheet.appendRow(row); });
      }
    }
  }
}

function doGet() {
  setup();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {};

  for (var name in SHEETS) {
    var sheet = ss.getSheetByName(name);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    result[name] = data.slice(1).map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  setup();
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

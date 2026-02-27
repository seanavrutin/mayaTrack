// הדביקו פונקציה זו ב-Apps Script, הריצו אותה פעם אחת, ואז מחקו אותה.

function importData() {
  setup();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var f = ss.getSheetByName('feeding');
  f.appendRow(['imp1', '2026-02-25T08:30:00.000Z', 60, 0, 0]);
  f.appendRow(['imp4', '2026-02-25T12:00:00.000Z', 20, 40, 7]);
  f.appendRow(['imp8', '2026-02-25T15:20:00.000Z', 25, 30, 0]);
  f.appendRow(['imp11', '2026-02-25T18:40:00.000Z', 20, 20, 20]);
  f.appendRow(['imp13', '2026-02-25T22:00:00.000Z', 30, 20, 15]);
  f.appendRow(['imp14', '2026-02-26T00:20:00.000Z', 30, 0, 0]);
  f.appendRow(['imp16', '2026-02-26T03:00:00.000Z', 50, 0, 10]);
  f.appendRow(['imp17', '2026-02-26T07:40:00.000Z', 60, 0, 10]);
  f.appendRow(['imp20', '2026-02-26T10:20:00.000Z', 20, 20, 0]);
  f.appendRow(['imp24', '2026-02-26T13:10:00.000Z', 60, 0, 20]);
  f.appendRow(['imp27', '2026-02-26T16:30:00.000Z', 40, 20, 15]);
  f.appendRow(['imp29', '2026-02-26T19:00:00.000Z', 30, 35, 15]);
  f.appendRow(['imp33', '2026-02-26T22:15:00.000Z', 40, 25, 10]);
  f.appendRow(['imp37', '2026-02-27T03:35:00.000Z', 50, 20, 20]);
  f.appendRow(['imp38', '2026-02-27T07:05:00.000Z', 50, 20, 15]);
  f.appendRow(['imp41', '2026-02-27T09:35:00.000Z', 30, 20, 0]);
  f.appendRow(['imp43', '2026-02-27T12:35:00.000Z', 60, 15, 0]);

  var d = ss.getSheetByName('diaper');
  d.appendRow(['imp2', '2026-02-25T08:20:00.000Z', true, false, false]);
  d.appendRow(['imp3', '2026-02-25T11:40:00.000Z', true, false, false]);
  d.appendRow(['imp5', '2026-02-25T11:35:00.000Z', true, false, false]);
  d.appendRow(['imp7', '2026-02-25T15:05:00.000Z', true, false, false]);
  d.appendRow(['imp9', '2026-02-25T17:50:00.000Z', true, false, false]);
  d.appendRow(['imp15', '2026-02-26T00:15:00.000Z', true, false, false]);
  d.appendRow(['imp18', '2026-02-26T07:30:00.000Z', true, false, false]);
  d.appendRow(['imp21', '2026-02-26T12:30:00.000Z', true, false, false]);
  d.appendRow(['imp22', '2026-02-26T12:35:00.000Z', true, false, false]);
  d.appendRow(['imp25', '2026-02-26T16:00:00.000Z', true, false, false]);
  d.appendRow(['imp28', '2026-02-26T18:15:00.000Z', true, false, false]);
  d.appendRow(['imp31', '2026-02-26T09:50:00.000Z', true, false, false]);
  d.appendRow(['imp32', '2026-02-26T22:00:00.000Z', true, false, false]);
  d.appendRow(['imp35', '2026-02-27T02:50:00.000Z', true, false, false]);
  d.appendRow(['imp39', '2026-02-27T06:55:00.000Z', true, false, false]);

  var p = ss.getSheetByName('pumping');
  p.appendRow(['imp6', '2026-02-25T13:30:00.000Z', 15]);
  p.appendRow(['imp10', '2026-02-25T16:30:00.000Z', 15]);
  p.appendRow(['imp12', '2026-02-25T20:50:00.000Z', 15]);
  p.appendRow(['imp19', '2026-02-26T08:00:00.000Z', 35]);
  p.appendRow(['imp23', '2026-02-26T13:00:00.000Z', 15]);
  p.appendRow(['imp26', '2026-02-26T16:15:00.000Z', 15]);
  p.appendRow(['imp30', '2026-02-26T19:15:00.000Z', 15]);
  p.appendRow(['imp34', '2026-02-26T22:10:00.000Z', 15]);
  p.appendRow(['imp36', '2026-02-27T03:20:00.000Z', 15]);
  p.appendRow(['imp40', '2026-02-27T08:05:00.000Z', 15]);
  p.appendRow(['imp42', '2026-02-27T11:15:00.000Z', 15]);
  p.appendRow(['imp44', '2026-02-27T14:15:00.000Z', 35]);
}

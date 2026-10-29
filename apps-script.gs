// Lim inn i Google Sheet: Utvidelser → Apps Script. Deploy som nettapp.
function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  var ark = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  ark.appendRow([new Date(), d.navn || '', d.epost || '', d.antall || '', d.kommentar || '']);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

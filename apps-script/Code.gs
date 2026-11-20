/**
 * Family Tree — Google Sheets backend (Google Apps Script web app).
 *
 * Setup (once):
 *  1. Create a Google Sheet. Extensions → Apps Script. Paste this file as Code.gs.
 *  2. Project Settings → Script properties → add  ADMIN_TOKEN = <a passcode for family admins>.
 *  3. Deploy → New deployment → type "Web app"
 *       Execute as: Me      Who has access: Anyone
 *     Copy the URL ending in /exec into js/config.js (sheetsUrl) and set mode: 'sheets'.
 *  4. Run `setup` once from the editor (or just call the web app) to create the header row.
 *
 * Reading is public (anyone with the site link can view the tree).
 * Writing requires the ADMIN_TOKEN, which is checked here on Google's side.
 */
// Leave empty when the script is opened from the Sheet (Extensions → Apps Script).
// For a standalone script (script.new), put the Sheet's id from its URL here.
const SPREADSHEET_ID = '';
const SHEET_NAME = 'People';
const HEADERS = ['id', 'name', 'gender', 'birthYear', 'deathYear', 'fatherId', 'motherId', 'spouseId', 'place', 'notes', 'photoUrl', 'updatedAt'];

function sheet_() {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}
function setup() { sheet_(); }

function readAll_() {
  const sh = sheet_();
  const values = sh.getDataRange().getDisplayValues();
  const head = values.shift();
  return values.filter(r => r[0]).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  try { return out_({ ok: true, people: readAll_() }); }
  catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
    if (!token || body.token !== token) return out_({ ok: false, error: 'Unauthorized' });
    if (body.action === 'ping') return out_({ ok: true });

    lock.waitLock(20000);
    const sh = sheet_();
    const now = new Date().toISOString();
    const row = p => HEADERS.map(h => (h === 'updatedAt' ? now : (p[h] == null ? '' : String(p[h]))));

    if (body.action === 'replaceAll') {
      sh.clearContents();
      sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      const rows = (body.people || []).map(row);
      if (rows.length) sh.getRange(2, 1, rows.length, HEADERS.length).setNumberFormat('@').setValues(rows);
      return out_({ ok: true, count: rows.length });
    }

    if (body.action === 'save') {
      const ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(r => String(r[0]));
      for (const p of body.upsert || []) {
        const r = row(p);
        const idx = ids.indexOf(String(p.id));
        if (idx > 0) sh.getRange(idx + 1, 1, 1, HEADERS.length).setNumberFormat('@').setValues([r]);
        else { sh.appendRow(r); ids.push(String(p.id)); }
      }
      // delete bottom-up so row numbers stay valid
      const del = (body.remove || []).map(id => ids.indexOf(String(id))).filter(i => i > 0).sort((a, b) => b - a);
      del.forEach(i => sh.deleteRow(i + 1));
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

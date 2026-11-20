// ---------------------------------------------------------------------------
// Site configuration — the only file you normally need to edit.
// ---------------------------------------------------------------------------
window.FT_CONFIG = {
  // 'local'  -> data lives in this browser (localStorage). Good for the POC / trying things out.
  // 'sheets' -> data lives in a Google Sheet, read/written through a Google Apps Script web app.
  mode: 'local',

  // When mode === 'sheets': paste your Apps Script "Web app" URL here (ends with /exec).
  sheetsUrl: '',

  // Only used in 'local' mode. In 'sheets' mode the passcode is checked by Google
  // (Apps Script property ADMIN_TOKEN), so it is never stored in this public file.
  localAdminPasscode: 'family123',

  siteTitle: 'Our Family Tree',
};

// ---------------------------------------------------------------------------
// Site configuration — the only file you normally need to edit.
// ---------------------------------------------------------------------------
window.FT_CONFIG = {
  // 'local'  -> data lives in this browser (localStorage). Good for the POC / trying things out.
  // 'sheets' -> data lives in a Google Sheet, read/written through a Google Apps Script web app.
  mode: 'sheets',

  // When mode === 'sheets': paste your Apps Script "Web app" URL here (ends with /exec).
  sheetsUrl: 'https://script.google.com/macros/s/AKfycbznpmCJIyzqMLWdFz_rqubeCOF3jnX73y95qasbdUG6YL7Argwy_f2fzgmwl0PgQ8oQCQ/exec',

  // Only used in 'local' mode. In 'sheets' mode the passcode is checked by Google
  // (Apps Script property ADMIN_TOKEN), so it is never stored in this public file.
  localAdminPasscode: 'family123',

  siteTitle: 'Our Family Tree',

  // Surnames hidden in the tree and info card (full names stay in the Sheet and admin table).
  hideSurnames: ['Jain'],
};

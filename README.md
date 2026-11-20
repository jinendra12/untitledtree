<img src="assets/tree.svg" width="64" height="64" alt="">

# Our Family Tree

A website where the whole extended family keeps one shared record of family members.
Pick any person as the base and draw their family tree:

- **🌳 Living tree**: a tree with a trunk, tapering branches (thicker where the family is bigger) and leaves. Deceased members get autumn leaves.
- **▦ Basic chart**: a clean top-down chart with cards.

Click anyone to see their parents, spouse and children. You can also make them the new base or go up a level. Pan and zoom with the mouse or trackpad (pinch on phones). Use **Save** to download the tree as an SVG image.

**⚙ Admin** opens the dashboard: search, add, edit, delete, "+ Child", and CSV/JSON import and export. It also checks your edits:
- a person can't be their own ancestor
- spouse links are kept two-way
- deleting someone clears every link to them

## Try it locally

Open `index.html` in a browser. There's nothing to install.

- The **Data** dropdown switches between the sample datasets: small, real-sized family (5 sons + 3 daughters), ~1000-person stress test, and messy edge cases.
- The default admin passcode in local mode is `family123` (set in `js/config.js`).
- Direct links work too: `index.html?data=large&view=basic`.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/style.css` | Page and styling |
| `js/config.js` | **Settings**: `local` or `sheets` mode, Apps Script URL, title |
| `js/store.js` | Data model, storage adapters (browser / Google Sheet), CSV, tree building |
| `js/tree-organic.js` | Living tree renderer (D3 + hand-drawn SVG branches and leaves) |
| `js/tree-basic.js` | Basic chart renderer |
| `js/app.js`, `js/admin.js` | App controls, info card, admin dashboard |
| `apps-script/Code.gs` | Google Sheets backend (paste into Apps Script) |

## Data format (one row per person)

`id, name, gender (M/F), birthYear, deathYear, fatherId, motherId, spouseId, place, notes, photoUrl`

Relationships are stored as ids. You never type an id by hand: the admin form gives you a searchable list of names.

---

## Go live for free: GitHub Pages + Google Sheet

```
 Family member's browser ──GET──▶ GitHub Pages (this code, free)
          │
          ├──GET  (read all people) ─────────▶ Google Apps Script web app ──▶ Google Sheet "People"
          └──POST (save, with admin passcode)─▶        (free, runs as you)
```

The site itself has no server. The Google Sheet is the database, and you and other admins can also edit it directly in Google Sheets.

### 1. Google Sheet + Apps Script (about 10 minutes)
1. Create a new Google Sheet (e.g. "Family Tree DB").
2. **Extensions → Apps Script**. Delete the sample code and paste in everything from `apps-script/Code.gs`. Save.
3. **Project Settings (⚙) → Script properties → Add**: `ADMIN_TOKEN` = a passcode you'll share with family admins.
4. **Deploy → New deployment →** type **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy, approve the permissions, and copy the **Web app URL** (it ends in `/exec`).
5. Edit `js/config.js`:
   ```js
   mode: 'sheets',
   sheetsUrl: 'https://script.google.com/macros/s/XXXX/exec',
   ```
6. Optional: to start with data, open the site, log into Admin with your `ADMIN_TOKEN`, and **Import CSV**. Use a CSV exported from local mode, or one you filled in by hand with the columns above.

> If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version**. That keeps the same URL.

### 2. GitHub Pages
1. Push this folder to a GitHub repository. On a free account it needs to be **public** for Pages. Your family data is *not* in the repo; it stays in your Sheet.
2. Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root**.
3. After about a minute the site is at `https://<your-username>.github.io/<repo-name>/`.

Other free static hosts work the same way: Netlify, Cloudflare Pages, Vercel (drag and drop the folder).

### Privacy and security notes
- **Edits** need the `ADMIN_TOKEN`, which Google checks on its side. It is never in the public code.
- **Viewing** is open to anyone who has the site link, like an unlisted video. To keep the tree private, add a "viewer key" check in `doGet`, or use Firebase/Supabase with Google sign-in.
- Every change is stamped with an `updatedAt` column in the Sheet, and Google Sheets keeps **version history**, so mistakes can be undone.
- Limits: Apps Script easily handles a family-sized site, from hundreds to a few thousand people and many visitors a day.

### Why Apps Script rather than the Google Sheets API directly?
With an API key, the Sheets API can only *read* a public sheet. *Writing* needs OAuth or a service-account secret, and a public GitHub Pages site can't hide a secret. Apps Script works as a tiny free backend that runs under your Google account and holds the passcode check.

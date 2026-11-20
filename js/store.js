// Data model, storage adapters (localStorage / Google Sheets) and tree building.
(function () {
  const FIELDS = ['id', 'name', 'gender', 'birthYear', 'deathYear', 'fatherId', 'motherId', 'spouseId', 'place', 'notes', 'photoUrl'];
  const cfg = window.FT_CONFIG;

  const normalize = (p) => { const o = {}; FIELDS.forEach((f) => { o[f] = p[f] == null ? '' : String(p[f]).trim(); }); return o; };
  const newId = () => 'P' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

  // ---------- adapters ----------
  const LocalAdapter = {
    key: (ds) => `familytree.v1.${ds}`,
    async load(ds) {
      try { const raw = localStorage.getItem(this.key(ds)); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
      return Samples.get(ds);
    },
    async save(ds, people) { try { localStorage.setItem(this.key(ds), JSON.stringify(people)); } catch (e) { alert('Could not save in this browser: ' + e.message); } },
    async verify(pass) { return pass === cfg.localAdminPasscode; },
    async reset(ds) { try { localStorage.removeItem(this.key(ds)); } catch (e) { /* ignore */ } },
  };

  // Google Apps Script web app. POST uses text/plain so the browser does not send a CORS preflight.
  const SheetsAdapter = {
    async call(body) {
      const res = await fetch(cfg.sheetsUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Request failed');
      return json;
    },
    async load() {
      const res = await fetch(cfg.sheetsUrl + (cfg.sheetsUrl.includes('?') ? '&' : '?') + 'action=list');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not load sheet');
      return json.people;
    },
    async verify(pass) { try { await this.call({ action: 'ping', token: pass }); return true; } catch (e) { return false; } },
    async apply(token, upsert, remove) { return this.call({ action: 'save', token, upsert, remove }); },
    async replaceAll(token, people) { return this.call({ action: 'replaceAll', token, people }); },
  };

  // ---------- CSV ----------
  function toCSV(people) {
    const esc = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
    return [FIELDS.join(','), ...people.map((p) => FIELDS.map((f) => esc(String(p[f] ?? ''))).join(','))].join('\n');
  }
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    const head = rows.shift().map((h) => h.trim());
    return rows.filter((r) => r.some((v) => v.trim())).map((r) => normalize(Object.fromEntries(head.map((h, i) => [h, r[i]]))));
  }

  // ---------- relationships ----------
  function index(people) {
    const byId = new Map(people.map((p) => [p.id, p]));
    const children = new Map();
    for (const p of people) for (const par of [p.fatherId, p.motherId]) {
      if (par && byId.has(par)) { if (!children.has(par)) children.set(par, []); children.get(par).push(p); }
    }
    return { byId, children };
  }

  // Descendant tree from a base person. Each node = a person + their spouse; children are the
  // children of either partner. A visited-set guarantees every person appears only once.
  function buildTree(people, rootId, maxDepth = Infinity) {
    const { byId, children } = index(people);
    const root = byId.get(rootId);
    if (!root) return null;
    const seen = new Set();
    const yr = (p) => parseInt(p.birthYear, 10) || 9999;
    function node(p, depth) {
      seen.add(p.id);
      const spouse = p.spouseId && byId.get(p.spouseId);
      if (spouse) seen.add(spouse.id);
      const kids = [...(children.get(p.id) || []), ...((spouse && children.get(spouse.id)) || [])]
        .filter((k, i, arr) => arr.indexOf(k) === i && !seen.has(k.id))
        .sort((a, b) => yr(a) - yr(b));
      kids.forEach((k) => seen.add(k.id));
      const n = { id: p.id, person: p, spouse: spouse || null, hidden: 0, children: [] };
      if (depth + 1 < maxDepth) n.children = kids.map((k) => node(k, depth + 1));
      else n.hidden = kids.length;
      return n;
    }
    return node(root, 0);
  }

  function countDescendants(people) {
    const { children } = index(people); const memo = new Map();
    const count = (id, stack = new Set()) => {
      if (memo.has(id)) return memo.get(id);
      if (stack.has(id)) return 0; stack.add(id);
      let c = 0; for (const k of children.get(id) || []) c += 1 + count(k.id, stack);
      stack.delete(id); memo.set(id, c); return c;
    };
    return (id) => count(id);
  }

  // The best default base person: someone with no recorded parents and the most descendants.
  function defaultRoot(people) {
    if (!people.length) return null;
    const byId = new Map(people.map((p) => [p.id, p]));
    const count = countDescendants(people);
    let best = null, bestScore = -1;
    for (const p of people) {
      if ((p.fatherId && byId.has(p.fatherId)) || (p.motherId && byId.has(p.motherId))) continue;
      const sp = byId.get(p.spouseId);
      const score = count(p.id) + (sp ? count(sp.id) : 0) + (p.gender === 'M' ? 0.5 : 0);
      if (score > bestScore) { best = p; bestScore = score; }
    }
    return (best || people[0]).id;
  }

  // Would making `parentId` a parent of `childId` create a loop?
  function isDescendant(people, ancestorId, candidateId) {
    const { children } = index(people); const stack = [ancestorId]; const seen = new Set();
    while (stack.length) {
      const id = stack.pop(); if (id === candidateId) return true;
      if (seen.has(id)) continue; seen.add(id);
      for (const k of children.get(id) || []) stack.push(k.id);
    }
    return false;
  }

  // deathYear '?' means: passed away, year not known.
  const lifespan = (p) => {
    if (!p) return '';
    if (p.deathYear === '?') return p.birthYear ? `${p.birthYear} – Late` : 'Late';
    if (p.birthYear && p.deathYear) return `${p.birthYear} – ${p.deathYear}`;
    if (p.birthYear) return `b. ${p.birthYear}`;
    if (p.deathYear) return `d. ${p.deathYear}`;
    return '';
  };

  window.FT = { FIELDS, normalize, newId, LocalAdapter, SheetsAdapter, toCSV, parseCSV, index, buildTree, defaultRoot, isDescendant, lifespan, countDescendants };
})();

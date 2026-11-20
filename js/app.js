// App shell: loads data, wires controls, renders the chosen view with zoom/pan.
(function () {
  const cfg = window.FT_CONFIG;
  const $ = (s) => document.querySelector(s);
  const S = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  const qs = new URLSearchParams(location.search);
  if (qs.get('data')) S('ft.dataset', qs.get('data'));
  if (qs.get('view')) S('ft.view', qs.get('view'));
  const App = window.App = {
    people: [], rootId: null, view: qs.get('view') || S('ft.view') || 'organic', depth: Infinity,
    dataset: qs.get('data') || S('ft.dataset') || 'family', selectedId: null,
    get sheets() { return cfg.mode === 'sheets' && !!cfg.sheetsUrl; },
  };

  const svgEl = $('#treeSvg');
  const zoom = d3.zoom().scaleExtent([0.02, 4]).on('zoom', (e) => { if (App.g) App.g.attr('transform', e.transform); });
  d3.select(svgEl).call(zoom).on('dblclick.zoom', null).on('click', () => closeInfo());

  App.fit = function (animate = true) {
    if (!App.g) return;
    const b = App.g.node().getBBox();
    const { width, height } = svgEl.getBoundingClientRect();
    if (!b.width || !width) return;
    const k = Math.min(2, 0.92 * Math.min(width / b.width, height / b.height));
    const t = d3.zoomIdentity.translate(width / 2 - k * (b.x + b.width / 2), height / 2 - k * (b.y + b.height / 2)).scale(k);
    (animate ? d3.select(svgEl).transition().duration(600) : d3.select(svgEl)).call(zoom.transform, t);
  };

  App.render = function (refit = true) {
    const label = (p) => `${p.name}${p.birthYear ? ' (' + p.birthYear + ')' : ''} · ${p.id}`;
    $('#peopleList').innerHTML = App.people.map((p) => `<option value="${esc(label(p))}"></option>`).join('');
    if (!App.people.find((p) => p.id === App.rootId)) App.rootId = FT.defaultRoot(App.people);
    const root = App.people.find((p) => p.id === App.rootId);
    $('#rootInput').value = root ? label(root) : '';
    $('#empty').hidden = !!root;
    d3.select(svgEl).selectAll('*').remove(); App.g = null;
    if (!root) { $('#stats').textContent = ''; return; }
    const t0 = performance.now();
    const tree = FT.buildTree(App.people, App.rootId, App.depth);
    const R = App.view === 'organic' ? OrganicTree : BasicTree;
    App.g = R.render(svgEl, tree, { onSelect: showInfo, selectedId: App.selectedId });
    const n = d3.hierarchy(tree);
    const ms = Math.round(performance.now() - t0);
    $('#stats').textContent = `${n.descendants().length} shown · ${n.height + 1} generations · ${App.people.length} people in records · drawn in ${ms} ms`;
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === App.view));
    if (refit) App.fit(false); else d3.select(svgEl).call(zoom.transform, d3.zoomTransform(svgEl));
  };

  App.reload = async function () {
    $('#status').textContent = 'Loading…';
    try {
      App.people = (App.sheets ? await FT.SheetsAdapter.load() : await FT.LocalAdapter.load(App.dataset)).map(FT.normalize);
      $('#status').textContent = App.sheets ? 'Google Sheet' : 'Saved in this browser';
    } catch (e) {
      $('#status').textContent = 'Load failed: ' + e.message; App.people = [];
    }
    App.render();
  };

  // Persist a set of changes (upserts + removals) through the active adapter.
  App.commit = async function (upsert, remove = []) {
    const map = new Map(App.people.map((p) => [p.id, p]));
    upsert.forEach((p) => map.set(p.id, FT.normalize(p)));
    remove.forEach((id) => map.delete(id));
    App.people = [...map.values()];
    if (App.sheets) {
      $('#status').textContent = 'Saving to Google Sheet…';
      try { await FT.SheetsAdapter.apply(Admin.token, upsert.map(FT.normalize), remove); $('#status').textContent = 'Saved to Google Sheet'; }
      catch (e) { alert('Save failed: ' + e.message); $('#status').textContent = 'Save failed'; }
    } else await FT.LocalAdapter.save(App.dataset, App.people);
    App.render(false);
  };

  // ---------- info card ----------
  const esc = App.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function showInfo(p) {
    App.selectedId = p.id;
    const byId = new Map(App.people.map((x) => [x.id, x]));
    const kids = App.people.filter((k) => k.fatherId === p.id || k.motherId === p.id);
    const link = (q) => (q ? `<a href="#" data-goto="${esc(q.id)}">${esc(FT.displayName(q))}</a>` : '—');
    const parents = [byId.get(p.fatherId), byId.get(p.motherId)].filter(Boolean);
    $('#infoCard').innerHTML = `
      <button class="x" data-close aria-label="Close">×</button>
      ${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="">` : ''}
      <h3>${esc(FT.displayName(p))}${p.deathYear ? ' <span class="muted">†</span>' : ''}</h3>
      <div class="muted">${esc(FT.lifespan(p))}${p.place ? ' · ' + esc(p.place) : ''}</div>
      <dl>
        <dt>Parents</dt><dd>${parents.length ? parents.map(link).join(' & ') : '—'}</dd>
        <dt>Spouse</dt><dd>${link(byId.get(p.spouseId))}</dd>
        <dt>Children</dt><dd>${kids.length ? kids.map(link).join(', ') : '—'}</dd>
        ${p.notes ? `<dt>Notes</dt><dd>${esc(p.notes)}</dd>` : ''}
      </dl>
      <div class="row">
        <button class="primary" data-root="${esc(p.id)}">Tree from here</button>
        ${parents.length ? `<button data-root="${esc(parents[0].id)}">Go up a level</button>` : ''}
        ${Admin.token ? `<button data-edit="${esc(p.id)}">Edit</button>` : ''}
      </div>`;
    $('#infoCard').hidden = false;
    document.querySelectorAll('.selected').forEach((n) => n.classList.remove('selected'));
  }
  App.showInfo = showInfo;
  function closeInfo() { $('#infoCard').hidden = true; App.selectedId = null; }
  $('#infoCard').addEventListener('click', (e) => {
    const t = e.target.closest('[data-goto],[data-root],[data-edit],[data-close]');
    if (!t) return; e.preventDefault();
    if (t.dataset.close !== undefined) return closeInfo();
    if (t.dataset.goto) return showInfo(App.people.find((p) => p.id === t.dataset.goto));
    if (t.dataset.root) { App.rootId = t.dataset.root; closeInfo(); return App.render(); }
    if (t.dataset.edit) Admin.edit(t.dataset.edit);
  });

  // ---------- controls ----------
  const ds = $('#datasetSel');
  ds.innerHTML = Samples.list.map((s) => `<option value="${s.key}">${s.label}</option>`).join('');
  ds.value = App.dataset;
  $('#datasetWrap').hidden = App.sheets;
  ds.addEventListener('change', () => { App.dataset = ds.value; S('ft.dataset', ds.value); App.rootId = null; closeInfo(); App.reload(); });

  $('#rootInput').addEventListener('change', (e) => {
    const id = e.target.value.split(' · ').pop().trim();
    if (App.people.some((p) => p.id === id)) { App.rootId = id; App.render(); }
  });
  $('#rootInput').addEventListener('focus', (e) => e.target.select());
  $('#depthSel').addEventListener('change', (e) => { App.depth = e.target.value === 'all' ? Infinity : +e.target.value; App.render(); });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { App.view = b.dataset.view; S('ft.view', App.view); App.render(); }));
  $('#fitBtn').addEventListener('click', () => App.fit());
  $('#rootBtn').addEventListener('click', () => {
    App.rootId = FT.defaultRoot(App.people);
    App.depth = Infinity; $('#depthSel').value = 'all';
    closeInfo(); App.render();
  });
  $('#pngBtn').addEventListener('click', downloadSVG);
  window.addEventListener('resize', () => App.fit(false));

  function downloadSVG() {
    if (!App.g) return;
    const b = App.g.node().getBBox(); const pad = 40;
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}`);
    clone.setAttribute('width', b.width + 2 * pad); clone.setAttribute('height', b.height + 2 * pad);
    clone.querySelector('g:not(defs g)')?.removeAttribute('transform');
    const bg = clone.querySelector('rect.bg'); if (bg) { bg.setAttribute('x', b.x - pad); bg.setAttribute('y', b.y - pad); bg.setAttribute('width', b.width + 2 * pad); bg.setAttribute('height', b.height + 2 * pad); }
    // inline the computed styles we rely on
    const style = document.createElement('style'); style.textContent = document.getElementById('treeCss').textContent; clone.prepend(style);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'family-tree.svg'; a.click();
  }

  document.title = cfg.siteTitle; $('#siteTitle').textContent = cfg.siteTitle;
  App.reload();
})();

// Admin dashboard: passcode login, searchable table, add / edit / delete, import / export.
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => App.esc(s);
  const Admin = window.Admin = { token: sessionStorage.getItem('ft.token') || null };

  const panel = $('#adminPanel'), login = $('#loginDialog'), dlg = $('#editDialog'), form = $('#editForm');

  $('#adminBtn').addEventListener('click', () => (Admin.token ? open() : (login.showModal(), $('#passInput').focus())));
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (e.submitter?.value === 'cancel') return login.close();
    const pass = $('#passInput').value;
    const ok = App.sheets ? await FT.SheetsAdapter.verify(pass) : await FT.LocalAdapter.verify(pass);
    if (!ok) { $('#loginErr').textContent = 'Wrong passcode'; return; }
    Admin.token = pass; sessionStorage.setItem('ft.token', pass);
    $('#passInput').value = ''; $('#loginErr').textContent = ''; login.close(); open();
  });
  $('#logoutBtn').addEventListener('click', () => { Admin.token = null; sessionStorage.removeItem('ft.token'); panel.hidden = true; });
  $('#closeAdmin').addEventListener('click', () => (panel.hidden = true));

  function open() { panel.hidden = false; $('#adminMode').textContent = App.sheets ? 'Editing the shared Google Sheet' : `Editing dataset “${App.dataset}” in this browser`; table(); }

  // ---------- table ----------
  $('#adminSearch').addEventListener('input', table);
  function table() {
    const q = $('#adminSearch').value.trim().toLowerCase();
    const byId = new Map(App.people.map((p) => [p.id, p]));
    const nm = (id) => (id ? esc(byId.get(id)?.name || `⚠ missing (${id})`) : '');
    const rows = App.people.filter((p) => !q || `${p.name} ${p.id} ${p.place}`.toLowerCase().includes(q));
    $('#adminCount').textContent = `${rows.length} of ${App.people.length} people`;
    $('#adminRows').innerHTML = rows.slice(0, 300).map((p) => `
      <tr>
        <td><b>${esc(p.name)}</b><div class="muted small">${esc(p.id)}</div></td>
        <td>${esc(p.gender)}</td><td>${esc(p.birthYear)}</td><td>${esc(p.deathYear)}</td>
        <td>${nm(p.fatherId)}</td><td>${nm(p.motherId)}</td><td>${nm(p.spouseId)}</td>
        <td class="actions"><button data-edit="${esc(p.id)}">Edit</button><button data-addchild="${esc(p.id)}" title="Add child">+ Child</button><button class="danger" data-del="${esc(p.id)}">Delete</button></td>
      </tr>`).join('') + (rows.length > 300 ? `<tr><td colspan="8" class="muted">Showing first 300 — refine the search.</td></tr>` : '');
  }
  $('#adminRows').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.edit) Admin.edit(b.dataset.edit);
    if (b.dataset.addchild) addChild(b.dataset.addchild);
    if (b.dataset.del) remove(b.dataset.del);
  });
  $('#addBtn').addEventListener('click', () => Admin.edit(null));

  // ---------- edit form ----------
  const label = (p) => `${p.name}${p.birthYear ? ' (' + p.birthYear + ')' : ''} · ${p.id}`;
  const idFrom = (v) => { v = v.trim(); if (!v) return ''; const id = v.split(' · ').pop().trim(); return App.people.some((p) => p.id === id) ? id : null; };

  Admin.edit = function (id, preset = {}) {
    const p = id ? App.people.find((x) => x.id === id) : { ...Samples.BLANK, ...preset };
    $('#editTitle').textContent = id ? `Edit ${p.name}` : 'Add a person';
    $('#relList').innerHTML = App.people.map((x) => `<option value="${esc(label(x))}"></option>`).join('');
    const byId = new Map(App.people.map((x) => [x.id, x]));
    for (const f of FT.FIELDS) {
      const el = form.elements[f]; if (!el) continue;
      el.value = ['fatherId', 'motherId', 'spouseId'].includes(f) ? (byId.get(p[f]) ? label(byId.get(p[f])) : '') : p[f];
    }
    form.dataset.id = id || '';
    $('#formErr').textContent = '';
    dlg.showModal();
  };
  function addChild(parentId) {
    const par = App.people.find((p) => p.id === parentId);
    const sp = App.people.find((p) => p.id === par.spouseId);
    const preset = {};
    const dad = par.gender === 'F' ? sp : par, mom = par.gender === 'F' ? par : sp;
    if (dad) preset.fatherId = dad.id; if (mom) preset.motherId = mom.id;
    Admin.edit(null, preset);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (e.submitter?.value === 'cancel') return dlg.close();
    const f = form.elements;
    const id = form.dataset.id || FT.newId();
    const old = App.people.find((p) => p.id === id);
    const rel = {};
    for (const k of ['fatherId', 'motherId', 'spouseId']) {
      rel[k] = idFrom(f[k].value);
      if (rel[k] === null) return ($('#formErr').textContent = `Pick ${k.replace('Id', '')} from the suggestions list (or leave empty).`);
      if (rel[k] === id) return ($('#formErr').textContent = 'A person cannot be related to themselves.');
    }
    for (const k of ['fatherId', 'motherId']) if (rel[k] && old && FT.isDescendant(App.people, id, rel[k])) return ($('#formErr').textContent = `That ${k.replace('Id', '')} is a descendant of this person — it would create a loop.`);
    if (!f.name.value.trim()) return ($('#formErr').textContent = 'Name is required.');

    const person = FT.normalize({ id, name: f.name.value, gender: f.gender.value, birthYear: f.birthYear.value, deathYear: f.deathYear.value, place: f.place.value, notes: f.notes.value, photoUrl: f.photoUrl.value, ...rel });
    const changes = [person];
    // keep spouse links two-way
    const byId = new Map(App.people.map((p) => [p.id, p]));
    if (old && old.spouseId && old.spouseId !== person.spouseId && byId.get(old.spouseId)?.spouseId === id) changes.push({ ...byId.get(old.spouseId), spouseId: '' });
    if (person.spouseId) {
      const sp = byId.get(person.spouseId);
      if (sp.spouseId && sp.spouseId !== id && byId.get(sp.spouseId)?.spouseId === sp.id) changes.push({ ...byId.get(sp.spouseId), spouseId: '' });
      if (sp.spouseId !== id) changes.push({ ...sp, spouseId: id });
    }
    dlg.close();
    await App.commit(changes);
    table();
  });

  async function remove(id) {
    const p = App.people.find((x) => x.id === id);
    if (!confirm(`Delete ${p.name}? Links to this person (as parent/spouse) will be cleared.`)) return;
    const changes = App.people.filter((x) => x.id !== id && (x.fatherId === id || x.motherId === id || x.spouseId === id))
      .map((x) => ({ ...x, fatherId: x.fatherId === id ? '' : x.fatherId, motherId: x.motherId === id ? '' : x.motherId, spouseId: x.spouseId === id ? '' : x.spouseId }));
    await App.commit(changes, [id]);
    table();
  }

  // ---------- import / export ----------
  const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };
  $('#exportCsv').addEventListener('click', () => download('family.csv', FT.toCSV(App.people), 'text/csv'));
  $('#exportJson').addEventListener('click', () => download('family.json', JSON.stringify(App.people, null, 2), 'application/json'));
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text(); e.target.value = '';
    let people;
    try { people = file.name.endsWith('.json') ? JSON.parse(text).map(FT.normalize) : FT.parseCSV(text); }
    catch (err) { return alert('Could not read file: ' + err.message); }
    if (!confirm(`Replace all ${App.people.length} records with ${people.length} from ${file.name}?`)) return;
    if (App.sheets) { try { await FT.SheetsAdapter.replaceAll(Admin.token, people); } catch (err) { return alert('Upload failed: ' + err.message); } }
    else await FT.LocalAdapter.save(App.dataset, people);
    App.people = people; App.rootId = null; App.render(); table();
  });
  $('#resetBtn').addEventListener('click', async () => {
    if (App.sheets) return alert('Reset only applies to local sample data.');
    if (!confirm('Discard your edits and restore the original sample data?')) return;
    await FT.LocalAdapter.reset(App.dataset); App.rootId = null; await App.reload(); table();
  });
})();

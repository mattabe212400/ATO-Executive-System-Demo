// ══════════════════════════════════════════════════
// GLOBAL SEARCH
// ══════════════════════════════════════════════════
let _gsTimer = null;
let _gsFocusIdx = -1;
let _gsResults = [];

// Category config: icon bg, icon color, icon, badge style, badge label
const GS_CATS = {
  members:     {icon:'ti-user-circle',   bg:'var(--sky-bg)',       ic:'var(--sky-tx)',  bs:'background:var(--sky-bg);color:var(--sky-tx)',          bl:'Member'},
  tasks:       {icon:'ti-checkbox',      bg:'var(--gn-bg)',  ic:'var(--gn-tx)', bs:'background:var(--gn-bg);color:var(--gn-tx)', bl:'Task'},
  notes:       {icon:'ti-notes',         bg:'var(--am-bg)',  ic:'var(--am-tx)', bs:'background:var(--am-bg);color:var(--am-tx)', bl:'Meeting Note'},
  events:      {icon:'ti-calendar-event',bg:'var(--bl-bg)',  ic:'var(--bl-tx)', bs:'background:var(--bl-bg);color:var(--bl-tx)', bl:'Event'},
  files:       {icon:'ti-file',          bg:'var(--surf2)',  ic:'var(--mt)', bs:'background:var(--surf2);color:var(--mt)',    bl:'File'},
  recruitment: {icon:'ti-user-plus',     bg:'var(--gn-bg)',  ic:'var(--gn-tx)', bs:'background:var(--gn-bg);color:var(--gn-tx)', bl:'Rushee'},
  cases:       {icon:'ti-scale',         bg:'var(--rd-bg)',  ic:'var(--rd-tx)', bs:'background:var(--rd-bg);color:var(--rd-tx)', bl:'J-Board Case'},
  finance:     {icon:'ti-cash',          bg:'var(--gn-bg)',  ic:'var(--gn-tx)', bs:'background:var(--gn-bg);color:var(--gn-tx)', bl:'Finance'},
  alumni:      {icon:'ti-users-group',   bg:'var(--am-bg)',  ic:'var(--am-tx)', bs:'background:var(--am-bg);color:var(--am-tx)', bl:'Alumni'},
};

const GS_CAT_LABELS = {
  members:'Members', tasks:'Tasks', notes:'Meeting Notes', events:'Calendar Events',
  files:'Files', recruitment:'Recruitment', cases:'Judicial Board',
  finance:'Finance', alumni:'Alumni',
};

function gsHighlight(text, q) {
  if (!q || !text) return text || '';
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).replace(new RegExp('(' + escaped + ')', 'gi'), '<mark>$1</mark>');
}

function gsSearch(q) {
  if (!q || q.length < 2) return [];
  const lq = q.toLowerCase();
  const results = [];

  // ── Members ──
  (D.members || []).forEach(m => {
    if (m.name.toLowerCase().includes(lq) || (m.role||'').toLowerCase().includes(lq)) {
      results.push({
        cat: 'members', id: m.id,
        title: m.name,
        sub: m.role + ' · ' + m.classYear + ' · ' + (m.liveIn ? 'Live-in' : 'Live-out'),
        action: () => { rbacNav('members', null); setTimeout(() => { const s = document.getElementById('m-search'); if(s){s.value=m.name;filterM();} }, 100); }
      });
    }
  });

  // ── Tasks ──
  (D.tasks || []).forEach(t => {
    if (t.title.toLowerCase().includes(lq) || (t.desc||'').toLowerCase().includes(lq)) {
      results.push({
        cat: 'tasks', id: t.id,
        title: t.title,
        sub: (t.priority||'').charAt(0).toUpperCase()+(t.priority||'').slice(1)+' priority · '+(t.positionTitle||'Unassigned')+(t.dueDate?' · Due '+fds(t.dueDate):''),
        status: t.status,
        action: () => { rbacNav('tasks', null); setTimeout(() => openEditTask(t.id), 150); }
      });
    }
  });

  // ── Meeting Notes ──
  (D.notes || []).forEach(n => {
    const bodyText = (n.body||'') + (n.announcements||'') + (n.oldBusiness||'') + (n.newBusiness||'');
    if (n.title.toLowerCase().includes(lq) || bodyText.toLowerCase().includes(lq)) {
      results.push({
        cat: 'notes', id: n.id,
        title: n.title,
        sub: fds(n.date) + ' · ' + (n.type||'Chapter') + ' meeting',
        action: () => { rbacNav('notes', null); setTimeout(() => openNoteDetail(n.id), 150); }
      });
    }
  });

  // ── Calendar Events ──
  (D.events || []).forEach(e => {
    if (e.title.toLowerCase().includes(lq) || (e.location||'').toLowerCase().includes(lq) || (e.type||'').toLowerCase().includes(lq)) {
      results.push({
        cat: 'events', id: e.id,
        title: e.title,
        sub: fds(e.date) + (e.start?' · '+to12h(e.start)+(e.endTime?'–'+to12h(e.endTime):''):'') + (e.location?' · '+e.location:'') + (e.mandatory?' · Required':''),
        action: () => {
          const d = new Date(e.date + 'T12:00:00');
          CAL_YEAR = d.getFullYear(); CAL_MONTH = d.getMonth();
          rbacNav('calendar', null);
        }
      });
    }
  });

  // ── Files ──
  (D.files || []).forEach(f => {
    if (f.name.toLowerCase().includes(lq) || (f.folder||'').toLowerCase().includes(lq)) {
      results.push({
        cat: 'files', id: f.id,
        title: f.name,
        sub: (f.folder||'General') + ' · ' + f.size + ' · ' + fds(f.date),
        action: () => { rbacNav('files', null); }
      });
    }
  });

  // ── Recruitment Rushees ──
  ((D.recruitment||{}).rushees || []).forEach(r => {
    if (r.name.toLowerCase().includes(lq) || (r.major||'').toLowerCase().includes(lq) || (r.stage||'').toLowerCase().includes(lq)) {
      results.push({
        cat: 'recruitment', id: r.id,
        title: r.name,
        sub: r.stage + ' · ' + (r.major||'Unknown major') + ' · Score: ' + (r.bidScore||0),
        action: () => { rbacNav('recruitment', null); setTimeout(() => rcOpenProfile(r.id), 200); }
      });
    }
  });

  // ── Judicial Cases ──
  (D.cases || []).forEach(c => {
    const memberName = mB(c.member).name;
    if (c.caseNum.toLowerCase().includes(lq) || memberName.toLowerCase().includes(lq) || (c.desc||'').toLowerCase().includes(lq) || (c.type||'').toLowerCase().includes(lq)) {
      results.push({
        cat: 'cases', id: c.id,
        title: c.caseNum + ', ' + memberName,
        sub: c.type + ' · ' + c.status + (c.hearingDate?' · '+fds(c.hearingDate):''),
        action: () => { rbacNav('judicial', null); }
      });
    }
  });

  // ── Finance: Fines ──
  ((D.finance||{}).fines || []).forEach(f => {
    const m = mB(f.memberId);
    if ((m.name||'').toLowerCase().includes(lq) || (f.reason||'').toLowerCase().includes(lq)) {
      results.push({
        cat: 'finance', id: f.id,
        title: '$' + f.amount + ' fine, ' + m.name,
        sub: f.reason + ' · ' + f.status + (f.date ? ' · ' + fds(f.date) : ''),
        action: () => { rbacNav('finance', null); setTimeout(() => finTab(document.querySelector('[data-tab=fin-fines]'), 'fin-fines'), 150); }
      });
    }
  });

  // ── Finance: Expenses ──
  ((D.finance||{}).expenses || []).forEach(e => {
    if ((e.description||'').toLowerCase().includes(lq) || (e.category||'').toLowerCase().includes(lq)) {
      results.push({
        cat: 'finance', id: e.id,
        title: '$' + e.amount + ', ' + (e.description||'Expense'),
        sub: (e.category||'') + (e.date ? ' · ' + fds(e.date) : ''),
        action: () => { rbacNav('finance', null); setTimeout(() => finTab(document.querySelector('[data-tab=fin-budget]'), 'fin-budget'), 150); }
      });
    }
  });

  // ── Alumni ──
  ((D.alumni||{}).contacts || []).forEach(a => {
    if ((a.name||'').toLowerCase().includes(lq) || (a.employer||'').toLowerCase().includes(lq) || (a.location||'').toLowerCase().includes(lq)) {
      results.push({
        cat: 'alumni', id: a.id,
        title: a.name,
        sub: (a.employer||'N/A') + ' · ' + (a.location||'N/A'),
        action: () => { rbacNav('alumni', null); }
      });
    }
  });

  return results;
}

function gsRender(q, results) {
  const dd = document.getElementById('gs-dropdown');
  if (!results.length) {
    dd.innerHTML = `<div class="gs-empty"><i class="ti ti-search-off"></i>No results for "<strong>${q}</strong>"</div>`;
    dd.classList.add('open');
    return;
  }

  // Group by category, maintain order defined in GS_CATS
  const catOrder = Object.keys(GS_CATS);
  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.cat]) grouped[r.cat] = [];
    if (grouped[r.cat].length < 4) grouped[r.cat].push(r); // cap 4 per category
  });

  let html = '';
  let globalIdx = 0;
  _gsResults = [];

  catOrder.forEach(cat => {
    const items = grouped[cat];
    if (!items || !items.length) return;
    const cfg = GS_CATS[cat];
    html += `<div class="gs-group-hd">${GS_CAT_LABELS[cat]} <span style="font-weight:400;font-size:9px">(${items.length})</span></div>`;
    items.forEach(item => {
      const idx = globalIdx++;
      _gsResults.push(item);
      html += `<div class="gs-item" data-idx="${idx}" onmousedown="gsPickIdx(${idx})">
        <div class="gs-item-ic" style="background:${cfg.bg};color:${cfg.ic}"><i class="ti ${cfg.icon}"></i></div>
        <div class="gs-item-body">
          <div class="gs-item-title">${gsHighlight(item.title, q)}</div>
          <div class="gs-item-sub">${item.sub}</div>
        </div>
        <span class="gs-item-badge" style="${cfg.bs}">${cfg.bl}</span>
      </div>`;
    });
  });

  const total = results.length;
  if (total > _gsResults.length) {
    html += `<div class="gs-footer">Showing top results · ${total} total matches</div>`;
  } else {
    html += `<div class="gs-footer">${total} result${total !== 1 ? 's' : ''}</div>`;
  }

  dd.innerHTML = html;
  dd.classList.add('open');
  _gsFocusIdx = -1;
}

function gsOnInput() {
  const q = document.getElementById('gs-input').value.trim();
  const clearBtn = document.getElementById('gs-clear');
  clearBtn.classList.toggle('vis', q.length > 0);

  clearTimeout(_gsTimer);
  if (q.length < 2) { gsClose(); return; }
  _gsTimer = setTimeout(() => {
    const results = gsSearch(q);
    gsRender(q, results);
  }, 120);
}

function gsOnFocus() {
  const q = document.getElementById('gs-input').value.trim();
  if (q.length >= 2) {
    const results = gsSearch(q);
    gsRender(q, results);
  }
}

function gsOnKey(e) {
  const dd = document.getElementById('gs-dropdown');
  const items = dd.querySelectorAll('.gs-item');
  if (!items.length) {
    if (e.key === 'Escape') gsClear();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _gsFocusIdx = Math.min(_gsFocusIdx + 1, items.length - 1);
    gsFocusItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _gsFocusIdx = Math.max(_gsFocusIdx - 1, 0);
    gsFocusItem(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_gsFocusIdx >= 0 && _gsResults[_gsFocusIdx]) {
      gsPickIdx(_gsFocusIdx);
    }
  } else if (e.key === 'Escape') {
    gsClear();
  }
}

function gsFocusItem(items) {
  items.forEach((el, i) => el.classList.toggle('focused', i === _gsFocusIdx));
  if (items[_gsFocusIdx]) items[_gsFocusIdx].scrollIntoView({ block: 'nearest' });
}

function gsPickIdx(idx) {
  const item = _gsResults[idx];
  if (!item) return;
  gsClear();
  if (item.action) item.action();
}

function gsClose() {
  document.getElementById('gs-dropdown').classList.remove('open');
  _gsFocusIdx = -1;
}

function gsClear() {
  const inp = document.getElementById('gs-input');
  inp.value = '';
  document.getElementById('gs-clear').classList.remove('vis');
  gsClose();
  inp.blur();
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (!document.getElementById('gs-wrap')?.contains(e.target)) gsClose();
});

// Keyboard shortcut: / or Cmd+K to focus search
document.addEventListener('keydown', e => {
  if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    const inp = document.getElementById('gs-input');
    if (inp) { inp.focus(); inp.select(); }
  }
});



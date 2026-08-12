// ══════════════════════════════════════════════
// AUTH & RBAC — ported from ATO Executive System's real js/auth.js.
// Only the pure RBAC logic (no Firebase calls) is kept here — login/registration/approval flows
// don't apply to this demo, which auto-signs in as a fixed persona (see js/demo.js). Everything
// below is otherwise identical to production, so role-based access behaves exactly the same way.
// ══════════════════════════════════════════════

const TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
let CURRENT_USER = null;
let CURRENT_CHAPTER = null; // fake chapters/{chapterId} doc — enabledModules + positions config
let _inactTimer;

function isGeneralMemberUser(u){
  return !!u && (u.role==='viewer' || u.title==='General Member');
}

// ── ROLE ACCESS MAP ──
// Every module/page that can exist in the app. A chapter's `enabledModules` is a subset of this.
const ALL_PAGES = ['dashboard','attendance','calendar','tasks','notes','finance','judicial','sober','members','recruitment','academics','committees','analytics','files','transition','settings','philanthropy','communityService','alumni','ritual','newMemberEducation','healthscore','reports','kcrew','social','houseLife'];

// Pages every exec-tier position gets 'view' on by default in the seed template below — not a
// runtime rule, just what a brand-new template position starts pre-checked with. Members/kcrew/
// recruitment are included so every exec position can at least view the roster, house
// management, and recruitment CRM — positions that already have 'edit' on one of these via
// _seedPages(editPages) below are unaffected, since editPages is applied after this base view set.
const BASE_VIEW_PAGES = ['dashboard','calendar','tasks','files','settings','analytics','reports','healthscore','transition','committees','notes','attendance','finance','philanthropy','communityService','alumni','sober','ritual','newMemberEducation','members','kcrew','recruitment','social','houseLife'];

// General members (role: 'viewer') — read-only on a limited page set. No tasks, files, judicial,
// academics, finance, recruitment CRM, or newMemberEducation.
const VIEWER_PAGES = ['calendar','members','committees','philanthropy','communityService','alumni','ritual','attendance','notes','sober','kcrew','social','houseLife'];

// A position's `pages` map is {pageKey: 'view'|'edit'} — 'edit' implies 'view'. Pages absent
// from the map are inaccessible. permLevel 'lead' bypasses this map entirely (full ALL_PAGES access).
function _seedPages(editPages){
  const p = {};
  BASE_VIEW_PAGES.forEach(pg => p[pg] = 'view');
  editPages.forEach(pg => p[pg] = 'edit');
  p.calendar = 'edit';
  p.transition = 'edit';
  return p;
}

// Like _seedPages(), but for "assistant"-style positions that should see no more than a general
// member does everywhere except their one owned section.
function _restrictedSeedPages(editPages){
  const p = {};
  VIEWER_PAGES.forEach(pg => p[pg] = 'view');
  editPages.forEach(pg => p[pg] = 'edit');
  return p;
}

// Same officer-position template ATO System's Super Admin seeds a brand-new chapter with —
// used here directly as this demo chapter's one and only position config.
const DEFAULT_POSITIONS = {
  'President':           { permLevel:'lead', pages:{} },
  'Vice President':      { permLevel:'lead', pages:{} },
  'Treasurer':           { permLevel:'exec', pages:_seedPages(['finance']) },
  'Secretary':           { permLevel:'exec', pages:_seedPages(['attendance','notes','members','houseLife']) },
  'Risk Manager':        { permLevel:'exec', pages:{ ..._seedPages(['sober','attendance']), academics:'view' } },
  'Recruitment':         { permLevel:'exec', pages:_seedPages(['recruitment','members']) },
  'Scholarship':         { permLevel:'exec', pages:_seedPages(['academics','members']) },
  'Philanthropy':        { permLevel:'exec', pages:_seedPages(['philanthropy']) },
  'Community Service':   { permLevel:'exec', pages:_seedPages(['communityService']) },
  'Alumni':              { permLevel:'exec', pages:_seedPages(['alumni','members']) },
  'House Manager':       { permLevel:'exec', pages:_seedPages(['kcrew','members']) },
  'House Manager Assistant': { permLevel:'exec', pages:_restrictedSeedPages(['kcrew']) },
  'Membership Educator': { permLevel:'exec', pages:_seedPages(['newMemberEducation','members','academics']) },
  'Membership Educator Assistant': { permLevel:'exec', pages:_restrictedSeedPages(['newMemberEducation']) },
  'Chaplain':            { permLevel:'exec', pages:_seedPages(['ritual','members']) },
  'Social':              { permLevel:'exec', pages:_seedPages(['sober','social']) },
  'Public Relations':    { permLevel:'exec', pages:_seedPages([]) },
};

function _positionForTitle(positions, t){
  if(!t) return null;
  if(positions[t]) return positions[t];
  const key = Object.keys(positions).find(k=>k.toLowerCase()===t.toLowerCase());
  return key ? positions[key] : null;
}

function getRoleAccess(role, title, secondaryTitle){
  const enabled = CURRENT_CHAPTER?.enabledModules || ALL_PAGES;
  const positions = CURRENT_CHAPTER?.positions || {};
  function intersect(pages){ return pages.filter(p=>enabled.includes(p)); }
  if(role==='admin') return ALL_PAGES;
  if(role==='viewer'){
    const viewerPos = positions['General Member'];
    const viewerPages = viewerPos ? Object.keys(viewerPos.pages||{}) : VIEWER_PAGES;
    return intersect(viewerPages.filter(p=>p!=='dashboard'));
  }
  const primary = _positionForTitle(positions, title);
  const secondary = _positionForTitle(positions, secondaryTitle);
  if(primary?.permLevel==='lead' || secondary?.permLevel==='lead') return intersect(ALL_PAGES);
  const granted = new Set([...Object.keys(primary?.pages||{}), ...Object.keys(secondary?.pages||{})]);
  return intersect([...granted]);
}

function canEditPage(page){
  if(!CURRENT_USER) return false;
  if(CURRENT_USER.role==='admin') return true;
  if(CURRENT_USER.role==='viewer') return false;
  const positions = CURRENT_CHAPTER?.positions || {};
  const primary = _positionForTitle(positions, CURRENT_USER.title);
  const secondary = _positionForTitle(positions, CURRENT_USER.secondaryTitle);
  if(primary?.permLevel==='lead' || secondary?.permLevel==='lead') return true;
  return primary?.pages?.[page]==='edit' || secondary?.pages?.[page]==='edit';
}

function isLeadUser(){
  if(!CURRENT_USER) return false;
  if(CURRENT_USER.role==='admin') return true;
  const positions = CURRENT_CHAPTER?.positions || {};
  function permLevel(t){
    if(!t) return null;
    if(positions[t]) return positions[t].permLevel;
    const key = Object.keys(positions).find(k=>k.toLowerCase()===t.toLowerCase());
    return key ? positions[key].permLevel : null;
  }
  return permLevel(CURRENT_USER.title)==='lead' || permLevel(CURRENT_USER.secondaryTitle)==='lead';
}

function myPositionTitles(){
  if(!CURRENT_USER) return [];
  return [CURRENT_USER.title, CURRENT_USER.secondaryTitle].filter(Boolean);
}
function _positionStillExists(positionTitle){
  if(!positionTitle) return false;
  return !!_positionForTitle(CURRENT_CHAPTER?.positions||{}, positionTitle);
}
function canSeePositionGroup(positionTitle){
  if(isLeadUser()) return true;
  if(!positionTitle || !_positionStillExists(positionTitle)) return false;
  return myPositionTitles().includes(positionTitle);
}
function ownsPositionRecord(positionTitle){ return canSeePositionGroup(positionTitle); }
function canAccess(page){
  if(!CURRENT_USER) return false;
  return getRoleAccess(CURRENT_USER.role, CURRENT_USER.title, CURRENT_USER.secondaryTitle).includes(page);
}

function rbacApplySidebar(){
  if(!CURRENT_USER) return;
  const allowed = getRoleAccess(CURRENT_USER.role, CURRENT_USER.title, CURRENT_USER.secondaryTitle);
  document.querySelectorAll('.ni[data-page]').forEach(el=>{
    const pg = el.getAttribute('data-page');
    if(pg === 'superadmin') return;
    el.classList.toggle('nav-hidden', !allowed.includes(pg));
  });
  document.querySelectorAll('.ns[data-section]').forEach(section=>{
    const items = section.querySelectorAll('.ni[data-page]');
    const anyVisible = [...items].some(i=>!i.classList.contains('nav-hidden'));
    section.style.display = anyVisible ? '' : 'none';
  });
  // Platform/Super Admin is out of scope for this single-chapter demo — never shown.
  const saSection = document.getElementById('nav-sa-section');
  if(saSection) saSection.style.display = 'none';
}

function rbacNav(page, el){
  if(!canAccess(page)){
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
    const denied = document.getElementById('page-access-denied');
    if(denied){
      denied.classList.add('active');
      document.getElementById('pg-title').textContent = 'Access Restricted';
      document.getElementById('ad-role').textContent = (typeof PT!=='undefined'&&PT[page])||page;
    }
    return;
  }
  nav(page, el);
}

// ── DEMO LOGOUT — no real session to end, so "logging out" just resets the demo back to a
// fresh load (a new visitor lands on the same auto-signed-in state a moment later). ──
function lgLogout(){
  location.reload();
}

// ── INACTIVITY RESET — mirrors production's session-timeout UX; harmless here since it just
// reloads the demo rather than ending a real session. ──
function resetInactivityTimer(){
  if(!CURRENT_USER) return;
  clearTimeout(_inactTimer);
  _inactTimer = setTimeout(lgLogout, TIMEOUT_MS);
}
['mousemove','keydown','click','scroll'].forEach(ev=>document.addEventListener(ev,resetInactivityTimer,{passive:true}));

function lgTimeOfDay(){
  const h = new Date().getHours();
  if(h < 12) return 'morning';
  if(h < 17) return 'afternoon';
  return 'evening';
}

/** Return the current semester label: "Fall YYYY" (Jun–Dec) or "Spring YYYY" (all other months). */
function getSemester(){
  const m=new Date().getMonth();
  return m>=5?'Fall '+new Date().getFullYear():'Spring '+new Date().getFullYear();
}

// ── SEMESTER PARTITIONING (shared across Attendance/Finance/Tasks/Recruitment/Community Service) ──
function semesterSortKey(s){
  const m=/^(Spring|Fall)\s+(\d+)/.exec(s||'');
  if(!m)return 0;
  return parseInt(m[2],10)*10+(m[1]==='Fall'?1:0);
}
function unionKnownSemesters(existingLabels){
  const set=new Set([getSemester(), ...(existingLabels||[])]);
  return [...set].sort((a,b)=>semesterSortKey(b)-semesterSortKey(a));
}
function isCurrentSemester(label){ return label===getSemester(); }
function semesterDateRange(label){
  const m=/^(Spring|Fall)\s+(\d+)$/.exec(label||'');
  if(!m)return null;
  const year=m[2];
  return m[1]==='Fall' ? {start:year+'-06-01', end:year+'-12-31'} : {start:year+'-01-01', end:year+'-05-31'};
}
function semesterLabelForDate(dateStr){
  if(!dateStr)return null;
  const year=dateStr.slice(0,4), month=parseInt(dateStr.slice(5,7),10);
  return month>=6?'Fall '+year:'Spring '+year;
}
function initSemesterSelect(selectId, knownSemesters, onChangeFn, preferred){
  const sel=document.getElementById(selectId);if(!sel)return;
  sel.innerHTML=knownSemesters.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  sel.value=(preferred&&knownSemesters.includes(preferred))?preferred:getSemester();
  sel.onchange=onChangeFn;
}

// ── SETTINGS: POSITIONS & PERMISSIONS + ENABLED MODULES — read-only display, same as production
// (chapter-lead editing of this config moved to Super Admin, which this demo doesn't include). ──
const SE_ALWAYS_ENABLED_MODULES=['dashboard','settings'];

function seRenderModules(){
  const card = document.getElementById('se-modules-card');
  if(!card)return;
  if(!isLeadUser()){ card.style.display='none'; return; }
  card.style.display='';
  const el = document.getElementById('se-modules-grid');
  if(!el)return;
  const enabled = CURRENT_CHAPTER?.enabledModules || ALL_PAGES;
  el.innerHTML = ALL_PAGES.filter(p=>!SE_ALWAYS_ENABLED_MODULES.includes(p)).map(p=>{
    const on = enabled.includes(p);
    return `<div style="display:flex;align-items:center;gap:7px;font-size:11.5px">
      <i class="ti ${on?'ti-circle-check':'ti-circle-x'}" style="color:${on?'var(--gn)':'var(--ht)'};font-size:13px"></i>
      <span style="color:${on?'var(--tx)':'var(--ht)'}">${esc((typeof PT!=='undefined'&&PT[p])||p)}</span>
    </div>`;
  }).join('');
}

function seRenderPositions(){
  const card = document.getElementById('se-positions-card');
  if(!card)return;
  if(!isLeadUser()){ card.style.display='none'; return; }
  card.style.display='';
  const el = document.getElementById('se-pos-builder');
  if(!el)return;
  const positions = CURRENT_CHAPTER?.positions || DEFAULT_POSITIONS;
  const titles = Object.keys(positions);
  if(!titles.length){ el.innerHTML = `<div style="font-size:11px;color:var(--ht)">No positions configured.</div>`; return; }
  el.innerHTML = `<table class="tbl"><thead><tr><th>Position</th><th>Access Level</th><th>Can Edit</th><th>Can View</th></tr></thead><tbody>${titles.map(t=>{
    const p = positions[t]||{};
    const isGM = t==='General Member';
    const grants = Object.entries(p.pages||{});
    const editPages = grants.filter(([,lvl])=>lvl==='edit').map(([page])=>esc((typeof PT!=='undefined'&&PT[page])||page));
    const viewPages = grants.filter(([,lvl])=>lvl!=='edit').map(([page])=>esc((typeof PT!=='undefined'&&PT[page])||page));
    const levelBadge = p.permLevel==='lead'?'<span class="badge bb2">Lead: full access</span>':isGM?'<span class="badge bm2">Every approved member</span>':'<span class="badge bm2">Exec</span>';
    return `<tr>
      <td style="font-weight:500">${esc(t)}</td>
      <td>${levelBadge}</td>
      <td style="color:var(--gn-tx);font-size:11px;max-width:260px">${p.permLevel==='lead'?'All enabled modules':(editPages.join(', ')||'N/A')}</td>
      <td style="color:var(--mt);font-size:11px;max-width:260px">${p.permLevel==='lead'?'N/A':(viewPages.join(', ')||'N/A')}</td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

// ── OFFLINE DETECTION — cosmetic only; the demo has nothing to actually sync. ──
window.addEventListener('online', ()=>{
  document.getElementById('offline-banner')?.classList.remove('show');
});
window.addEventListener('offline', ()=>{
  document.getElementById('offline-banner')?.classList.add('show');
});
if(!navigator.onLine){
  document.getElementById('offline-banner')?.classList.add('show');
}

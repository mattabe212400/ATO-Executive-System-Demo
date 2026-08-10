// ── TOAST ──
function toast(msg,type='info',duration=3000){
  const c=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className='toast '+type;t.textContent=msg;c.appendChild(t);
  requestAnimationFrame(()=>{requestAnimationFrame(()=>{t.classList.add('show');});});
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),250);},duration);
}

// ── CONFIRM DIALOG ──
let _confirmResolve = null;
function confirmDialog(title, msg, okLabel = 'Delete', danger = true) {
  return new Promise(res => {
    _confirmResolve = res;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    const ok = document.getElementById('confirm-ok');
    ok.textContent = okLabel;
    ok.className = 'btn ' + (danger ? 'btn-d' : 'btn-p');
    ok.onclick = () => {
      document.getElementById('confirm-overlay').classList.remove('open');
      _confirmResolve = null;
      res(true);
    };
    document.getElementById('confirm-overlay').classList.add('open');
  });
}
function confirmCancel() {
  document.getElementById('confirm-overlay').classList.remove('open');
  if (_confirmResolve) {
    _confirmResolve(false);
    _confirmResolve = null;
  }
}


// ── RBAC: can current user write/delete data? ──
function canWrite() {
  if (!CURRENT_USER) return false;
  if (CURRENT_USER.role === 'viewer') return false;
  return true;
}

// Hide write-action toolbar buttons on viewer-accessible pages
function _viewerApplyWriteLock(){
  if(!CURRENT_USER||CURRENT_USER.role!=='viewer')return;
  ['cal-new-event-btn',
   'ph-log-hours-btn','ph-add-service-event-btn','ph-log-funds-btn','ph-add-ph-event-btn','ph-funds-log-btn',
   'ri-add-item-btn','ri-add-session-btn',
   'al-add-btn','al-add-event-btn','al-log-contact-btn']
  .forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
}

// Close confirm dialog with Escape; also close topmost open modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('confirm-overlay');
    if (overlay && overlay.classList.contains('open')) { confirmCancel(); return; }
    const openModals = document.querySelectorAll('.mo.open');
    if (openModals.length) {
      openModals[openModals.length - 1].classList.remove('open');
    }
  }
});

// ── ACCESSIBILITY: activate any role="button" element (nav items, cards) with Enter/Space ──
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[role="button"]');
  if (!el || el.matches('button,a,input,select,textarea')) return;
  e.preventDefault();
  el.click();
});

// ── ACCESSIBILITY: focus trap + focus restore for every .mo modal, regardless of how it's opened ──
(function () {
  let lastFocus = null;
  function focusables(modal) {
    return [...modal.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null);
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const open = document.querySelectorAll('.mo.open');
    if (!open.length) return;
    const modal = open[open.length - 1];
    const f = focusables(modal);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.attributeName !== 'class' || !m.target.classList || !m.target.classList.contains('mo')) return;
      const el = m.target;
      const isOpen = el.classList.contains('open');
      const wasOpen = m.oldValue ? m.oldValue.split(' ').includes('open') : false;
      if (isOpen && !wasOpen) {
        lastFocus = document.activeElement;
        const f = focusables(el);
        if (f.length) requestAnimationFrame(() => f[0].focus());
      } else if (!isOpen && wasOpen) {
        if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
        lastFocus = null;
      }
    });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
})();


const PT={dashboard:'Executive Dashboard',attendance:'Attendance',finance:'Finance',calendar:'Calendar',tasks:'Tasks & Goals',notes:'Meeting Notes',judicial:'Judicial Board',sober:'Social Monitor Management',members:'Members',recruitment:'Recruitment CRM',academics:'Academics',committees:'Committees',analytics:'Analytics & Reporting',files:'Files & Documents',transition:'Officer Transition Hub',settings:'Settings',philanthropy:'Philanthropy',communityService:'Community Service',alumni:'Alumni Relations',ritual:'Chaplain Hub',newMemberEducation:'New Member Education',healthscore:'Chapter Health Scorecard',reports:'Reports',kcrew:'House Management',social:'Social Events',houseLife:'House Life'};

function esc(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
// Local-timezone date-only string (YYYY-MM-DD). Not toISOString().split('T')[0], which is
// UTC — an evening/late-night entry in US timezones can land on the wrong calendar day.
function localDateStr(d){const dt=d instanceof Date?d:new Date();return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');}
function mB(id){if(!id)return{name:'Unassigned',initials:'—'};return D.members.find(m=>m.id===id)||{name:'Unknown',initials:'??'};}
// Names are stored "First Last" — surname is the last whitespace-separated token, which holds
// even for a middle name ("Mary Jane Smith" -> "Smith") and degrades gracefully for a single-
// word name ("Cher" -> "Cher").
function mLastName(name){const parts=(name||'').trim().split(/\s+/).filter(Boolean);return parts.length?parts[parts.length-1]:'';}
// Alphabetical by LAST name (falls back to full name to break ties between same-surname
// members) — the one comparator every member list/dropdown/table in the app should share, so
// "sorted alphabetically" means the same thing everywhere.
function mNameCompare(a,b){return mLastName(a.name).localeCompare(mLastName(b.name))||(a.name||'').localeCompare(b.name||'');}
// Canonical last-name-alphabetical member list — every roster dropdown/table should read from
// this (not D.members directly), so ordering never leaks import/insertion order (which can
// look "grouped by class year" after a bulk CSV import) instead of a real A-Z-by-surname roster.
function sortedMembers(){return [...D.members].sort(mNameCompare);}
function fd(d){if(!d)return'—';try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch{return'—';}}
function fds(d){if(!d)return'—';try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});}catch{return'—';}}
function dom(d){if(!d)return'';try{return new Date(d+'T12:00:00').getDate();}catch{return'';}}
function mos(d){if(!d)return'';try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short'});}catch{return'';}}
function isOv(d){if(!d)return false;try{return new Date(d+'T12:00:00')<new Date();}catch{return false;}}
function isUp(d){if(!d)return false;try{return new Date(d+'T12:00:00')>=new Date();}catch{return false;}}
// "HH:MM" 24-hour (as from <input type="time">) -> 12-hour with AM/PM for display.
function to12h(t){if(!t)return'';const[h,m]=t.split(':').map(Number);if(isNaN(h)||isNaN(m))return t;const p=h>=12?'PM':'AM';return(h%12||12)+':'+String(m).padStart(2,'0')+' '+p;}
function pc(c,t){return t?Math.round(c/t*100):0;}
function uid(){return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function pgc(p){return p>=80?'var(--gn)':p>=50?'var(--navy)':p>=25?'var(--am)':'var(--rd)';}

function aR(memberId){
  const mandEvents=D.events.filter(e=>e.mandatory&&!isUp(e.date));
  if(!mandEvents.length){return 100;}
  // Only count events on/after the member's join date, so a member who joined partway through
  // the semester isn't penalized for mandatory events held before they were a brother. Members
  // with no recorded join date (added before this field existed) count every event, same as
  // before — no retroactive penalty or benefit from adding this field.
  const m=D.members.find(x=>x.id===memberId);
  const joinDate=m&&m.joinDate;
  const eligibleEvents=joinDate?mandEvents.filter(e=>e.date>=joinDate):mandEvents;
  if(!eligibleEvents.length){return 100;}
  let present=0;
  eligibleEvents.forEach(ev=>{
    const rec=(D.attendance[ev.id]||{})[memberId];
    if(rec==='present'||rec==='excused')present++;
  });
  return Math.round(present/eligibleEvents.length*100);
}

// Same math as aR() above, scoped to one semester's date range instead of all-time — aR() itself
// stays untouched since too many all-time callers depend on it (Dashboard's own-balance widgets,
// calcOfficerEngagement, Health Score). Used by the Attendance page's semester selector only.
function aRForSemester(memberId,semesterLabel){
  const range=semesterDateRange(semesterLabel);
  if(!range)return aR(memberId);
  const mandEvents=D.events.filter(e=>e.mandatory&&!isUp(e.date)&&e.date>=range.start&&e.date<=range.end);
  if(!mandEvents.length){return 100;}
  const m=D.members.find(x=>x.id===memberId);
  const joinDate=m&&m.joinDate;
  const eligibleEvents=joinDate?mandEvents.filter(e=>e.date>=joinDate):mandEvents;
  if(!eligibleEvents.length){return 100;}
  let present=0;
  eligibleEvents.forEach(ev=>{
    const rec=(D.attendance[ev.id]||{})[memberId];
    if(rec==='present'||rec==='excused')present++;
  });
  return Math.round(present/eligibleEvents.length*100);
}

// Tasks "owned" by a member = tasks whose Position matches their roster role — NOT
// task.assignedTo, which is now the delegating position ("Assigned By"), not a member id. Member
// records (D.members) only ever carry a free-text `.role` field (set on the Members page) — they
// have no `.title`/`.secondaryTitle` (those only exist on the account/users doc behind CURRENT_USER
// and other logged-in accounts), so this must match against `.role`, not `.title`. This is what
// the Officer Accountability table's "Tasks Done" column reflects.
function tM(id){
  const m=D.members.find(x=>x.id===id);
  const titles=m?.role?[m.role]:[];
  const all=D.tasks.filter(t=>t.positionTitle&&titles.includes(t.positionTitle));
  const dn=all.filter(t=>t.status==='done');
  return{total:all.length,done:dn.length,rate:all.length?Math.round(dn.length/all.length*100):0};
}
// task.assignedTo now holds a position title (the delegating position), not a member id — guard
// display sites against legacy pre-refactor tasks that still carry a raw member id in this field.
function taskAssignedByLabel(t){
  return t&&t.assignedTo&&chapterPositionTitles().includes(t.assignedTo)?t.assignedTo:'';
}
function mOpts(){return sortedMembers().map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('');}
function evCS(t){const m={chapter:'background:#5B8FE8;color:#fff',philanthropy:'background:#3DBDB7;color:#fff',social:'background:#E04848;color:#fff',alumni:'background:#F47C20;color:#fff',pledge:'background:#E8C220;color:#1a1a1a',service:'background:#4B5568;color:#fff',dues:'background:#3BAA5A;color:#fff',isu:'background:#8B35C8;color:#fff',homecoming:'background:#E0259A;color:#fff',committee:'background:var(--gold);color:#3a2c05',exec:'background:#7A2E3A;color:#fff',brotherhood:'background:#A0522D;color:#fff',faith:'background:#6B4E9E;color:#fff',recruitment:'background:#4F46E5;color:#fff'};return m[t]||'background:#F1F3F6;color:#555';}

// ── SIDEBAR ──
function sbOpen(){
  document.getElementById('app-nav').classList.add('open');
  document.getElementById('sb-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}
function sbClose(){
  document.getElementById('app-nav').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
  document.body.style.overflow='';
}
function sbToggle(){
  const nav=document.getElementById('app-nav');
  nav.classList.contains('open')?sbClose():sbOpen();
}

function nav(page,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById('page-'+page);if(pg)pg.classList.add('active');
  if(el)el.classList.add('active');
  else{const lbl=page.replace('-',' ');document.querySelectorAll('.ni').forEach(n=>{if(n.textContent.toLowerCase().trim().startsWith(lbl.substring(0,6)))n.classList.add('active');});}
  document.getElementById('pg-title').textContent=(page==='dashboard'&&CURRENT_USER)?('Good '+lgTimeOfDay()+', '+CURRENT_USER.name.split(' ')[0]):PT[page]||page;
  const skMap={
    dashboard:[{id:'d-kpi',html:skKpi(4)},{id:'d-events',html:skRows2(3)},{id:'d-overdue',html:skRows2(3)}],
    attendance:[{id:'a-kpi',html:skKpi(4)},{id:'a-table',html:skRows(6,5)}],
    calendar:[{id:'cal-grid',html:skCalendar()}],
    notes:[{id:'notes-g',html:skCards(4)}],
    analytics:[{id:'an-kpi',html:skKpi(4)},{id:'an-eng',html:skRows(4,2)},{id:'an-officers',html:skRows(5,4)}],
    files:[{id:'fi-folders',html:Array(8).fill(0).map(()=>`<div class="sk-card" style="height:90px"></div>`).join('')}],
    committees:[{id:'co-grid',html:Array(3).fill(0).map(()=>`<div class="sk-card" style="height:110px"></div>`).join('')}],
    transition:[{id:'tr-folders',html:Array(6).fill(0).map(()=>`<div class="sk-card" style="height:100px"></div>`).join('')}],
    members:[{id:'m-kpi',html:skKpi(4)},{id:'m-table',html:skRows(8,5)}],
    finance:[{id:'fin-kpi',html:skKpi(4)}],
    recruitment:[{id:'rc-kpi',html:skKpi(4)}],
  };
  if(skMap[page]){
    skMap[page].forEach(({id,html})=>{const e=document.getElementById(id);if(e)e.innerHTML=html;});
  }
  setTimeout(()=>{if(R[page])R[page]();},60);
  setTimeout(()=>{_viewerApplyWriteLock();},200);
  if(window.innerWidth<=1100)sbClose();
  // Sync mobile bottom nav active state
  const _mbnMap={dashboard:'mbn-dashboard',members:'mbn-members',calendar:'mbn-calendar',attendance:'mbn-attendance'};
  document.querySelectorAll('.mbn-item').forEach(b=>b.classList.remove('active'));
  const _mbnEl=document.getElementById(_mbnMap[page]);
  if(_mbnEl)_mbnEl.classList.add('active');
}
// This chapter's real officer titles — Object.keys(CURRENT_CHAPTER.positions) is the runtime
// source of truth (DEFAULT_POSITIONS in js/auth.js is only a new-chapter seed template, never
// re-read for an existing chapter). Used to populate the Position pickers on Tasks & Goals.
function chapterPositionTitles(){
  return Object.keys(CURRENT_CHAPTER?.positions||DEFAULT_POSITIONS).sort();
}
function openM(id){
  const el=document.getElementById(id);
  el.querySelectorAll('select[id="nc-m"],select[id="nco-c"],select[id="ntr-o"],select[id="nc-filedby"]').forEach(s=>{
    const pre=(s.id==='nc-filedby'||s.id==='nco-c')?'<option value="">— Unassigned —</option>':'';
    s.innerHTML=pre+mOpts();
  });
  // "Assigned To" (nt-position) — any exec can now delegate a task to any position, not just
  // their own, so this always gets the full chapter position list regardless of lead status.
  // Goals stay position-scoped for non-leads (goals have no "Assigned By" concept).
  el.querySelectorAll('select[id="nt-position"]').forEach(s=>{
    s.innerHTML=chapterPositionTitles().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  });
  el.querySelectorAll('select[id="ng-position"]').forEach(s=>{
    const opts=isLeadUser()?chapterPositionTitles():myPositionTitles();
    s.innerHTML=opts.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  });
  // "Assigned By" (nt-a) is no longer a choice for anyone, including leads — it's always
  // whichever position the logged-in account actually holds (their own identity), a plain
  // read-only display, not a picker. addTask() reads CURRENT_USER.title directly, not this field.
  el.querySelectorAll('input[id="nt-a"]').forEach(s=>{ s.value=CURRENT_USER?.title||'—'; });
  // Member Role — a constrained dropdown of this chapter's real positions (plus "Member" for
  // non-officers), same canonical list every other position picker in the app uses, so a role can
  // never drift into a typo'd near-match that silently breaks position-based matching elsewhere
  // (Officer Accountability, Committees' per-member task count).
  el.querySelectorAll('select[id="nm-r"]').forEach(s=>{
    s.innerHTML='<option value="Member">Member</option>'+chapterPositionTitles().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  });
  if(id==='m-addevent'){
    const eid=document.getElementById('ne-edit-id');if(eid)eid.value='';
    // Reset committee scoping too — otherwise opening "New Event" from a committee's workspace
    // and then later opening it plain from the Calendar page would silently keep tagging new
    // events with that stale committeeId.
    const cid=document.getElementById('ne-committee-id');if(cid)cid.value='';
    const tp=document.getElementById('ne-tp');if(tp)tp.value='chapter';
    const mt=el.querySelector('.md-t');if(mt&&mt.childNodes[0])mt.childNodes[0].textContent='New Event';
  }
  if(id==='m-addtask'){
    const cid=document.getElementById('nt-committee-id');if(cid)cid.value='';
  }
  if(id==='m-addcomm'){
    const iconSel=document.getElementById('nco-icon');
    if(iconSel&&typeof coIconOptions==='function')iconSel.innerHTML=coIconOptions('ti-sitemap');
  }
  if(id==='m-addcase'){
    // Suggest the current user's own linked member as the filer — still fully editable.
    const fb=document.getElementById('nc-filedby');
    if(fb&&CURRENT_USER?.mid&&D.members.some(m=>m.id===CURRENT_USER.mid))fb.value=CURRENT_USER.mid;
  }
  el.classList.add('open');
}
function closeM(e,el){if(e&&e.target!==el)return;el.classList.remove('open');}

// Committee CRUD (addComm/openEditComm/saveComm/deleteComm) moved to js/committees.js — it
// grew into a full module (roster/positions/health score/tabs) and no longer belonged here.
function addTrans(){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const role=document.getElementById('ntr-r').value.trim();
  if(!role){toast('Role is required','error');return;}
  D.transitions.push({id:uid(),role,outgoing:document.getElementById('ntr-o').value||null,incoming:null,content:document.getElementById('ntr-c').value,status:document.getElementById('ntr-s').value});
  saveD('transitions');closeM(null,document.getElementById('m-addtrans'));document.getElementById('ntr-r').value='';renderTransition();toast('Transition doc added','success');
}


// ── EDIT TRANSITION ──
function openEditTrans(id){
  const t=D.transitions.find(t=>t.id===id);if(!t)return;
  const el=document.getElementById('m-edittrans');
  document.getElementById('etr-id').value=id;
  document.getElementById('etr-r').value=t.role;
  document.getElementById('etr-c').value=t.content||'';
  document.getElementById('etr-s').value=t.status;
  const o=document.getElementById('etr-o');o.innerHTML='<option value="">— Unassigned —</option>'+mOpts();o.value=t.outgoing||'';
  const i=document.getElementById('etr-i');i.innerHTML='<option value="">— TBD —</option>'+mOpts();i.value=t.incoming||'';
  el.classList.add('open');
}
function saveTrans(){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const id=document.getElementById('etr-id').value;
  const t=D.transitions.find(t=>t.id===id);if(!t)return;
  const role=document.getElementById('etr-r').value.trim();
  if(!role){toast('Role is required','error');return;}
  t.role=role;t.outgoing=document.getElementById('etr-o').value||null;
  t.incoming=document.getElementById('etr-i').value||null;
  t.content=document.getElementById('etr-c').value;t.status=document.getElementById('etr-s').value;
  saveD('transitions');closeM(null,document.getElementById('m-edittrans'));renderTransition();toast('Transition doc saved','success');
}

// ── UPDATE NOTIFICATION BADGES ──
function updateBadges(){
  const attendBadge=document.getElementById('attend-sb-badge');
  const jbBadge=document.getElementById('judicial-sb-badge');
  if(attendBadge){const lowAtt=D.members.filter(m=>aR(m.id)<75).length;attendBadge.textContent=lowAtt;attendBadge.style.display=lowAtt?'':'none';}
  if(jbBadge){const oc=D.cases.filter(c=>!['resolved','dismissed'].includes(c.status)).length;jbBadge.textContent=oc;jbBadge.style.display=oc?'':'none';}
  autoGenerateNotifs();
}

function autoGenerateNotifs(){
  if(!D.notifs)D.notifs=[];
  const today=localDateStr();
  const existing=new Set(D.notifs.map(n=>n.autoKey||''));
  const startLen=D.notifs.length;
  let dirty=false;

  function pushAuto(autoKey,title,body,type='info',link=''){
    if(existing.has(autoKey))return;
    D.notifs.unshift({id:uid(),autoKey,title,body,type,link,read:false,date:today});
    existing.add(autoKey);
    dirty=true;
  }

  const lowAtt=D.members.filter(m=>aR(m.id)<75);
  if(lowAtt.length){
    pushAuto('att_low_'+today,'Attendance Warning',`${lowAtt.length} member${lowAtt.length>1?'s':''} below 75%: ${lowAtt.slice(0,3).map(m=>esc(m.name.split(' ')[0])).join(', ')}${lowAtt.length>3?'...':''}. Review required.`,'warning','attendance');
  }

  const ovT=D.tasks.filter(t=>isOv(t.dueDate)&&t.status!=='done');
  if(ovT.length){
    const top=ovT.sort((a,b)=>({urgent:0,high:1,medium:2,low:3}[a.priority]||2)-({urgent:0,high:1,medium:2,low:3}[b.priority]||2))[0];
    pushAuto('tasks_ov_'+today,'Overdue Tasks',`${ovT.length} task${ovT.length>1?'s':''} are past their due date. Highest priority: "${esc(top.title)}" (${top.priority}).`,'warning','tasks');
  }

  const unassigned=sbFlatSlots().filter(s=>isUp(s.date)&&!s.memberId);
  if(unassigned.length){
    pushAuto('sober_unassigned_'+today,'Unassigned Social Monitor Shifts',`${unassigned.length} upcoming shift${unassigned.length>1?'s':''} have no social monitor assigned. Next: ${fds(unassigned[0].date)}.`,'warning','sober');
  }

  const openCases=D.cases.filter(c=>!['resolved','dismissed'].includes(c.status));
  if(openCases.length){
    pushAuto('jb_open_'+today,'Open Judicial Cases',`${openCases.length} case${openCases.length>1?'s':''} require attention. Access the Judicial Board to review.`,'info','judicial');
  }

  const dues=typeof finDuesMapForSemester==='function'?finDuesMapForSemester(getSemester()):(D.finance.dues||{});
  const unpaidCount=D.members.filter(m=>(dues[m.id]?.status||'Partial')!=='Paid').length;
  if(unpaidCount>D.members.length*0.3){
    pushAuto('dues_unpaid_'+today,'Dues Collection Alert',`${unpaidCount} members (${Math.round(unpaidCount/D.members.length*100)}%) have not paid semester dues. Follow up required.`,'warning','finance');
  }

  const soon=D.events.filter(e=>e.mandatory&&isUp(e.date)).filter(e=>{const d=Math.round((new Date(e.date+'T12:00:00')-new Date())/86400000);return d<=3&&d>=0;});
  soon.forEach(e=>{
    const days=Math.round((new Date(e.date+'T12:00:00')-new Date())/86400000);
    pushAuto('ev_soon_'+e.id,'Mandatory Event Soon',`"${esc(e.title)}" is ${days===0?'today':days===1?'tomorrow':'in '+days+' days'}${e.location?' at '+esc(e.location):''}.`,'info','calendar');
  });

  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-14);
  D.notifs=D.notifs.filter(n=>!n.autoKey||new Date(n.date+'T12:00:00')>cutoff);
  if(D.notifs.length>50)D.notifs=D.notifs.slice(0,50);
  if(D.notifs.length!==startLen)dirty=true;
  // firestore.rules gates writes to the 'notifs' key behind isExec() (admin/exec role) — a
  // General Member (role:'viewer') can never pass that check, so skip the write entirely
  // instead of firing a doomed request that surfaces as a "Save failed: permission-denied"
  // toast on every dashboard visit. Also skips the write when nothing actually changed, which
  // this ran unconditionally on every render regardless of role.
  const canWriteNotifs=CURRENT_USER&&(CURRENT_USER.role==='admin'||CURRENT_USER.role==='exec');
  if(dirty&&canWriteNotifs)saveD('notifs');
}

// The 'notifs' key's read flag is shared chapter-wide, and firestore.rules gates its writes
// behind isExec() — a General Member marking something read locally still updates their own
// view, but persisting it would hit the same permission-denied case as autoGenerateNotifs above.
function nRead(id){
  const n=D.notifs&&D.notifs.find(n=>n.id===id);
  if(!n)return;
  n.read=true;
  if(CURRENT_USER&&(CURRENT_USER.role==='admin'||CURRENT_USER.role==='exec'))saveD('notifs');
  renderNotifications();
}
function saveProf(){
  const name      = document.getElementById('se-name').value.trim();
  const year      = +document.getElementById('se-year').value;
  const classYear = document.getElementById('se-class').value;
  if(!name){toast('Name cannot be empty.','error');return;}

  // Save to the user's member record in D.members
  const myM = _myMemberRecord();
  if(myM){
    myM.name = name;
    myM.year = year;
    myM.classYear = classYear;
    saveD('members');
  } else {
    // No linked member record — fall back to settings
    D.settings.name = name;
    D.settings.year = year;
    D.settings.classYear = classYear;
    saveD('settings');
  }

  // Update sidebar display
  const ini = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('u-name').textContent = name;
  document.getElementById('u-av').textContent   = ini;
  document.getElementById('tb-av').textContent  = ini;
  if(CURRENT_USER) CURRENT_USER.name = name;
  toast('Profile saved','success');
}
function filterA(){const q=document.getElementById('a-search').value.toLowerCase();document.querySelectorAll('#a-table tbody tr').forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none');}
function filterN(){const q=document.getElementById('n-search').value.toLowerCase();document.querySelectorAll('#notes-g>div').forEach(el=>el.style.display=el.textContent.toLowerCase().includes(q)?'':'none');}
function filterM(){
  renderMembers();
}
// Writes a fire-and-forget record of every export to the auditLog data key on every export —
// note there is currently no UI anywhere that reads/displays this data back; it's a write-only
// trail today. Left in place (and the corresponding firestore.rules write permission untouched)
// since removing it would silently stop this existing behavior rather than fix anything.
async function _xportAudit(type){
  try{
    if(!_db||!_fbFns||!FS_ID||!CURRENT_USER) return;
    const {doc,getDoc,setDoc} = _fbFns;
    const ref = doc(_db, FS_PATH, FS_ID, FS_DATA, 'auditLog');
    // Previously merge:true-only, which can only ever ADD a dynamic 'e'+timestamp key, never
    // remove one — unbounded growth with no read path anywhere to ever prune it (nothing
    // displays this data back), a real risk of eventually hitting Firestore's 1MB doc cap.
    // Read-prune-replace instead, capped at 50 like notifs (js/helpers.js above, D.notifs).
    const snap = await getDoc(ref);
    const current = (snap.exists()&&snap.data())||{};
    const trimmed = Object.fromEntries(Object.entries(current).sort((a,b)=>a[0].localeCompare(b[0])).slice(-49));
    trimmed['e'+Date.now()] = { type, by: CURRENT_USER.name||CURRENT_USER.email||'', at: new Date().toISOString() };
    await setDoc(ref, trimmed);
  }catch(e){}
}

// Shared CSV-download trigger — every export function across the app builds its own CSV
// string, then hands it here instead of repeating the Blob/anchor-click boilerplate.
function downloadCSV(filename,csvText){
  const blob=new Blob([csvText],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}

// A field starting with =, +, -, or @ is executed as a formula by Excel/Sheets when the CSV is
// opened — "CSV/formula injection." Member names, hometowns, etc. are user-controlled text, so
// prefix a stray leading quote to neutralize it without changing how the value looks otherwise.
function csvSafe(v){
  const s=String(v==null?'':v);
  return /^[=+\-@]/.test(s)?"'"+s:s;
}

function xport(type){
  // isLeadUser() (title/secondaryTitle resolves to permLevel:'lead' in this chapter's positions
  // config), not role==='admin' — role:'admin' is only ever set when Superadmin pre-approves an
  // officer into a lead-tier position (js/superadmin.js saPreApproveOfficer/saChangeUserTitle); a
  // President/VP who self-registered and was approved normally by another officer has
  // role:'exec' despite genuinely being a lead, and was wrongly blocked here.
  if(type==='all' && !isLeadUser()){
    alert('Full data export is restricted to chapter leads.');
    return;
  }
  _xportAudit(type);
  let data='',fn='export.csv';
  if(type==='members'){data='Name,Class Year,Grad Year,Role,Live-In,Member Status\n';sortedMembers().forEach(m=>{data+=csvSafe(m.name)+','+m.classYear+','+m.year+','+m.role+','+(m.liveIn?'Yes':'No')+','+(m.memberStatus||'Active')+'\n';});fn='members.csv';}
  else if(type==='attendance'){data='Member,Attendance Rate\n';sortedMembers().forEach(m=>{data+=csvSafe(m.name)+','+aR(m.id)+'%\n';});fn='attendance.csv';}
  else if(type==='finance'){
    const dues=typeof finDuesMapForSemester==='function'?finDuesMapForSemester(getSemester()):(D.finance.dues||{});
    data='Member,Class,Amount Owed,Paid,Balance,Status\n';
    sortedMembers().forEach(m=>{const d=dues[m.id]||{};const owed=d.semesterDues||getSemDues(m.id,getSemester());const paid=d.paid||0;data+=`"${csvSafe(m.name)}",${m.classYear},${owed},${paid},${owed-paid},${d.status||'Partial'}\n`;});
    fn='dues.csv';
  }
  else if(type==='academics'){
    data='Member,Class,Cumulative GPA,Last Semester GPA\n';
    sortedMembers().forEach(m=>{const g=D.academics.gpas[m.id]||{};data+=`"${csvSafe(m.name)}",${m.classYear},${g.cumulativeGpa||''},${g.priorGpa||''}\n`;});
    fn='academics.csv';
  }
  else if(type==='recruitment'){
    data='Name,Stage,Major,Hometown,Bid Score,Last Contact,Recruiter\n';
    (D.recruitment.rushees||[]).forEach(r=>{const rec=mB(r.recruiter);data+=`"${csvSafe(r.name)}","${r.stage}","${csvSafe(r.major||'')}","${csvSafe(r.hometown||'')}",${r.bidScore||0},${r.lastContact||''},"${csvSafe(rec.name||'')}"\n`;});
    fn='recruitment.csv';
  }
  else if(type==='all'){const blob=new Blob([JSON.stringify(D,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ato_ops_data.json';a.click();return;}
  downloadCSV(fn,data);
}

function kpi(label,val,sub,trend){
  const up=trend==='up',dn=trend==='down';
  const c=up?'var(--gn)':dn?'var(--rd)':'var(--mt)';
  const ico=up?'<i class="ti ti-trending-up" style="font-size:10px"></i>':dn?'<i class="ti ti-trending-down" style="font-size:10px"></i>':'';
  const border=up?'border-top:2px solid var(--gn)':dn?'border-top:2px solid var(--rd)':'border-top:2px solid transparent';
  return`<div class="card" style="${border}"><div class="kl">${label}</div><div class="kv">${val}</div><div class="ks" style="color:${c}">${ico}${ico?' ':''}<span>${sub}</span></div></div>`;
}

// One segment of a KPI Stat Strip (DESIGN.md: Components > KPI Stat Strip) — a single bordered
// `.d2-stats` container holding several closely-related top-line numbers as flush, divider-
// separated segments, instead of the N-identical-cards pattern `kpi()` above renders. Originally
// introduced for the Dashboard, promoted here so any data-table page (Members, and future ones)
// can reuse the exact same component rather than re-deriving it.
function statStrip(label,val,sub,trend){
  const cls=trend==='up'?'up':trend==='down'?'down':'neutral';
  const ico=trend==='up'?'<i class="ti ti-trending-up"></i>':trend==='down'?'<i class="ti ti-trending-down"></i>':'';
  return`<div class="d2-stat"><div class="d2-stat-lbl">${esc(label)}</div><div class="d2-stat-val">${val}</div><div class="d2-stat-sub ${cls}">${ico}<span>${esc(String(sub))}</span></div></div>`;
}

// ── SKELETON & EMPTY STATE HELPERS ──
function skKpi(n=4){return Array(n).fill(0).map(()=>`<div class="sk-kpi"><div class="sk sk-line w50"></div><div class="sk sk-kpi-val"></div><div class="sk sk-line w30"></div></div>`).join('');}
function skRows(n=5,cols=4){const cw=cols===4?'2fr 1fr 1fr 1fr':cols===3?'2fr 1fr 1fr':'2fr 1fr';return`<div style="padding:6px 0">${Array(n).fill(0).map(()=>`<div class="sk-table-row" style="grid-template-columns:${cw}">${Array(cols).fill(0).map((c,i)=>`<div class="sk sk-line ${i===0?'w90':i===1?'w70':i===2?'w50':'w30'}"></div>`).join('')}</div>`).join('')}</div>`;}
function skCards(n=3){return Array(n).fill(0).map(()=>`<div class="sk-card"><div class="sk sk-line w60" style="height:13px;margin-bottom:9px"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div></div>`).join('');}
function skCalendar(){const cells=Array(35).fill(0).map(()=>`<div class="sk-cal-cell"><div class="sk sk-line w30" style="height:9px;margin-bottom:5px"></div>${Math.random()>.6?`<div class="sk sk-cal-pip sk w80"></div>`:''}${Math.random()>.75?`<div class="sk sk-cal-pip sk w60"></div>`:''}</div>`).join('');return`<div style="display:grid;grid-template-columns:repeat(7,1fr)">${cells}</div>`;}
function skRows2(n=4){return Array(n).fill(0).map(()=>`<div class="sk-row"><div class="sk sk-av"></div><div style="flex:1"><div class="sk sk-line w70"></div><div class="sk sk-line w40" style="margin-top:5px"></div></div></div>`).join('');}
function es(icon,iconClass,title,sub,btnHtml=''){
  return`<div class="es"><div class="es-icon ${iconClass}"><i class="ti ${icon}"></i></div><div class="es-title">${title}</div><div class="es-sub">${sub}</div>${btnHtml}</div>`;
}

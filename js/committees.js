// ══════════════════════════════════════════════════════════
// COMMITTEES — directory overview + per-committee workspace
// ══════════════════════════════════════════════════════════
// Committee CRUD (addComm/openEditComm/saveComm/deleteComm) used to live in js/helpers.js, and
// renderCommittees() in js/judicial.js — both moved here once the page grew into a full
// workspace (roster/positions, tasks/events/files tabs, per-committee health score).

// Only 'Chair' is structural (drives canEditCommittee()/isCommitteeLeader() permissions) — every
// other position, including "Vice Chair" if a committee wants one, is just a free-text label a
// committee assigns itself via Manage Positions (coOpenPositions()/coSavePositions() below).
const CO_DEFAULT_POSITIONS=['Chair','Member'];
const CO_ICONS=['ti-sitemap','ti-device-laptop','ti-school','ti-users','ti-briefcase','ti-heart','ti-confetti','ti-scale','ti-cash','ti-trophy','ti-speakerphone','ti-shield-check'];

let CO_CURRENT_ID=null;
let CO_ACTIVE_TAB='co-pane-overview';
let CO_FILES_FOLDER=null;
// Per-committee-workspace semester selector — independent of Tasks & Goals' own TASKS_SELECTED_SEM
// (that page reads D.tasks directly with its own state; this one scopes only the detail-view
// Events pane and attendance %, reset every time a committee's workspace is opened).
let CO_SELECTED_SEM=null;

// ── Migration / defaults — called from dDefaults() (js/data.js) whenever D loads ──
function coEnsureDefaults(){
  if(!D.committees)return;
  D.committees.forEach(c=>{
    if(!c.icon)c.icon='ti-sitemap';
    // Positions are {name, description} objects — description is shown read-only in the Members
    // tab's "Position Responsibilities" card. Migrate any plain-string legacy positions in place.
    if(!c.positions||!c.positions.length){
      c.positions=CO_DEFAULT_POSITIONS.map(p=>({name:p,description:''}));
    } else {
      c.positions=c.positions.map(p=>typeof p==='string'?{name:p,description:''}:p);
    }
    if(!c.roster){
      c.roster=(c.members||[]).map(mid=>({memberId:mid,position:mid===c.chair?'Chair':'Member',joinedAt:null}));
    }
    // One-time migration: Vice Chair used to be a second structural role alongside Chair. It's
    // now just an ordinary custom position — preserve whoever held it as a real roster position
    // (added to this committee's positions list if not already there) instead of silently
    // dropping who they were, then drop the old structural field.
    if(c.viceChair){
      if(!c.positions.some(p=>p.name==='Vice Chair'))c.positions.push({name:'Vice Chair',description:''});
      const vcRow=c.roster.find(r=>r.memberId===c.viceChair);
      if(vcRow)vcRow.position='Vice Chair';
    }
    delete c.viceChair;
    // members[] stays a derived mirror of roster — js/members.js's deleteMember cascade and
    // js/reports.js both already read c.members directly.
    c.members=c.roster.map(r=>r.memberId);
    if(!c.fileFolders)c.fileFolders=[];
    // One-time cleanup: every committee used to be auto-seeded with an empty "General" folder on
    // creation. Strip it if it's still empty and top-level (never touches one a committee is
    // actually using, or the lost-and-found coDeleteFolder() creates on demand when it holds real
    // files) so existing committees end up in the same "create your own folders" state as new ones.
    c.fileFolders=c.fileFolders.filter(fo=>!(fo.name==='General'&&!fo.parent&&!D.files.some(f=>f.committeeId===c.id&&f.folder==='General')));
    if(!c.createdAt)c.createdAt=localDateStr();
    // Week-by-week program/curriculum, imported via CSV (js/import.js, type 'committeeProgram')
    // — same Week/Topic/Notes shape as New Member Education's Peer Mentor Program agenda, just
    // scoped to this one committee instead of chapter-wide.
    if(!c.program)c.program=[];
    // Some committees (e.g. ones that don't run a structured curriculum) don't want the Program
    // card cluttering their Overview tab — defaults to shown (true) so existing committees don't
    // silently lose a section they were already using.
    if(c.programEnabled===undefined)c.programEnabled=true;
  });
  coRecomputeLeaders();
}
// Deduped chair member-id index — firestore.rules checks this array directly since it can't
// iterate D.committees' list-of-maps to find "is this uid a chair of anything."
function coRecomputeLeaders(){
  const ids=new Set();
  (D.committees||[]).forEach(c=>{ if(c.chair)ids.add(c.chair); });
  D.committeeLeaders=[...ids];
}
function canEditCommittee(c){
  if(canEditPage('committees'))return true;
  if(!c||!CURRENT_USER?.mid)return false;
  return c.chair===CURRENT_USER.mid;
}
function coIconOptions(selected){
  return CO_ICONS.map(i=>`<option value="${i}" ${i===selected?'selected':''}>${i.replace('ti-','').replace(/-/g,' ')}</option>`).join('');
}

// ── Committee CRUD ──
function addComm(){
  if(!canEditPage('committees')){toast('Only officers with Committees access can add committees.','error');return;}
  const name=document.getElementById('nco-n').value.trim();
  if(!name){toast('Name is required','error');return;}
  const chair=document.getElementById('nco-c').value||null;
  const c={
    id:uid(),name,desc:document.getElementById('nco-d').value,
    icon:document.getElementById('nco-icon')?.value||'ti-sitemap',
    chair,
    positions:CO_DEFAULT_POSITIONS.map(p=>({name:p,description:''})),
    roster:chair?[{memberId:chair,position:'Chair',joinedAt:localDateStr()}]:[],
    members:chair?[chair]:[],
    fileFolders:[],createdAt:localDateStr(),
    programEnabled:document.getElementById('nco-program-enabled')?.checked!==false
  };
  D.committees.push(c);
  coRecomputeLeaders();
  saveD('committees','committeeLeaders');closeM(null,document.getElementById('m-addcomm'));
  ['nco-n','nco-d'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderCommittees();toast('Committee created','success');
}
function openEditComm(id){
  if(!canEditPage('committees')){toast('Only officers with Committees access can edit committees.','error');return;}
  const c=D.committees.find(c=>c.id===id);if(!c)return;
  const el=document.getElementById('m-editcomm');
  document.getElementById('eco-id').value=id;
  document.getElementById('eco-n').value=c.name;
  document.getElementById('eco-d').value=c.desc||'';
  const iconSel=document.getElementById('eco-icon');if(iconSel)iconSel.innerHTML=coIconOptions(c.icon);
  const csel=document.getElementById('eco-c');csel.innerHTML='<option value="">Unassigned</option>'+mOpts();csel.value=c.chair||'';
  const progCb=document.getElementById('eco-program-enabled');if(progCb)progCb.checked=c.programEnabled!==false;
  el.classList.add('open');
}
function saveComm(){
  if(!canEditPage('committees')){toast('Only officers with Committees access can edit committees.','error');return;}
  const id=document.getElementById('eco-id').value;
  const c=D.committees.find(c=>c.id===id);if(!c)return;
  const name=document.getElementById('eco-n').value.trim();
  if(!name){toast('Name is required','error');return;}
  c.name=name;c.desc=document.getElementById('eco-d').value;
  c.icon=document.getElementById('eco-icon')?.value||'ti-sitemap';
  c.chair=document.getElementById('eco-c').value||null;
  c.programEnabled=document.getElementById('eco-program-enabled')?.checked!==false;
  coRecomputeLeaders();
  saveD('committees','committeeLeaders');closeM(null,document.getElementById('m-editcomm'));
  renderCommittees();toast('Committee saved','success');
}
async function deleteComm(id){
  if(!canEditPage('committees')){toast('Only officers with Committees access can delete committees.','error');return;}
  const ok=await confirmDialog('Delete Committee','Are you sure you want to delete this committee? Its tasks, events, and files stay in the system but become unassigned.');
  if(!ok)return;
  D.committees=D.committees.filter(c=>c.id!==id);
  D.tasks.forEach(t=>{if(t.committeeId===id)t.committeeId=null;});
  D.events.forEach(e=>{if(e.committeeId===id)e.committeeId=null;});
  D.files.forEach(f=>{if(f.committeeId===id)f.committeeId=null;});
  coRecomputeLeaders();
  // 'tasks'/'files' are the universal-exec tier (always writable once canEditPage('committees')
  // has confirmed this caller isn't a viewer). 'events' is different: canWriteEvents() in
  // firestore.rules has no 'committees' page check at all, only isCommitteeLeader() (chair of
  // some committee) or a handful of other pages' edit grants — so a dedicated Committees
  // position-holder who isn't personally a chair would have this whole atomic batch denied,
  // including the 'committees' delete itself, without this guard.
  const keys=['committees','committeeLeaders','tasks','files'];
  if(canEditPage('calendar')||(CURRENT_USER?.mid&&D.committeeLeaders.includes(CURRENT_USER.mid)))keys.push('events');
  saveD(...keys);
  closeM(null,document.getElementById('m-editcomm'));
  if(CO_CURRENT_ID===id)coCloseDetail();
  renderCommittees();toast('Committee deleted','info');
}

// ── Roster / positions ──
function coOpenAddMember(){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to manage this committee\'s roster.','error');return;}
  const existing=new Set(c.roster.map(r=>r.memberId));
  const sel=document.getElementById('co-add-mem-sel');
  sel.innerHTML=sortedMembers().filter(m=>!existing.has(m.id)).map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')||'<option value="">No available members</option>';
  openM('m-comm-addmember');
}
function coConfirmAddMember(){
  const id=document.getElementById('co-add-mem-sel').value;
  if(!id)return;
  coAddRosterMember(id);
  closeM(null,document.getElementById('m-comm-addmember'));
}
function coAddRosterMember(memberId){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to manage this committee\'s roster.','error');return;}
  if(c.roster.some(r=>r.memberId===memberId)){toast('Already on this committee','error');return;}
  c.roster.push({memberId,position:'Member',joinedAt:localDateStr()});
  c.members=c.roster.map(r=>r.memberId);
  saveD('committees');coRenderMembersPane(c);renderCommittees();toast('Member added','success');
}
async function coRemoveRosterMember(memberId){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to manage this committee\'s roster.','error');return;}
  const ok=await confirmDialog('Remove Member','Remove this member from the committee?');
  if(!ok)return;
  c.roster=c.roster.filter(r=>r.memberId!==memberId);
  c.members=c.roster.map(r=>r.memberId);
  if(c.chair===memberId)c.chair=null;
  coRecomputeLeaders();
  saveD('committees','committeeLeaders');coRenderMembersPane(c);renderCommittees();toast('Member removed','info');
}
function coSetMemberPosition(memberId,position){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to manage this committee\'s roster.','error');return;}
  const r=c.roster.find(r=>r.memberId===memberId);if(!r)return;
  r.position=position;
  if(position==='Chair')c.chair=memberId;else if(c.chair===memberId)c.chair=null;
  coRecomputeLeaders();
  saveD('committees','committeeLeaders');coRenderMembersPane(c);renderCommittees();toast('Position updated','success');
}
// Each row pairs a position name with an optional description of what that position is
// responsible for — shown read-only to everyone in the Members tab's "Position Responsibilities"
// card (coRenderPositionDescriptions()) so the roster table isn't the only place to learn what a
// position actually does.
function coPositionRowHtml(name,description){
  return`<div class="cop-row" style="display:flex;gap:6px;margin-bottom:8px;align-items:flex-start">
    <div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">
      <input value="${esc(name)}" class="cop-input" placeholder="Position name">
      <input value="${esc(description||'')}" class="cop-desc-input" placeholder="What is this position responsible for? (optional)" style="font-size:11px">
    </div>
    <button class="ib" style="width:26px;height:26px;color:var(--rd);flex-shrink:0;margin-top:2px" onclick="this.closest('.cop-row').remove()" aria-label="Remove position"><i class="ti ti-x"></i></button>
  </div>`;
}
function coOpenPositions(){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to manage positions.','error');return;}
  document.getElementById('cop-list').innerHTML=c.positions.map(p=>coPositionRowHtml(p.name,p.description)).join('');
  openM('m-comm-positions');
}
function coAddPositionRow(){
  // Stage the row locally in the open modal rather than saving yet — coSavePositions() commits.
  document.getElementById('cop-list').insertAdjacentHTML('beforeend',coPositionRowHtml('',''));
}
function coSavePositions(){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to manage positions.','error');return;}
  const vals=[...document.querySelectorAll('#cop-list .cop-row')].map(row=>({
    name:row.querySelector('.cop-input').value.trim(),
    description:row.querySelector('.cop-desc-input').value.trim()
  })).filter(p=>p.name);
  if(!vals.length){toast('At least one position is required','error');return;}
  c.positions=vals;
  saveD('committees');closeM(null,document.getElementById('m-comm-positions'));
  coRenderMembersPane(c);toast('Positions saved','success');
}

// ── Derived data helpers ──
function coEventsFor(committeeId){return D.events.filter(e=>e.committeeId===committeeId);}
function coFilesFor(committeeId){return D.files.filter(f=>f.committeeId===committeeId);}

// ── Semester scoping for the detail-view Events pane only — the directory grid (renderCommittees())
// stays all-time/unfiltered.
function coSem(){ return CO_SELECTED_SEM||getSemester(); }
function coKnownSemestersFor(c){
  return unionKnownSemesters(coEventsFor(c.id).map(e=>semesterLabelForDate(e.date)).filter(Boolean));
}
function coSemesterChanged(){
  CO_SELECTED_SEM=document.getElementById('co-d-semester-select').value;
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);
  if(c)coRenderDetail(c);
}
function coEventsForSem(committeeId,sem){
  const r=semesterDateRange(sem);
  return coEventsFor(committeeId).filter(e=>!r||(e.date>=r.start&&e.date<=r.end));
}

// ── Committee event RSVPs — own Firestore collection (see firestore.rules' committeeRsvps
// block): a member can self-scope their own status; a chair/exec/lead can manage any member's
// on their committee's events. ──
function coRsvpDocId(eventId){ return eventId+'_'+(CURRENT_USER?.uid||'anon'); }
async function coRsvpSet(eventId,committeeId,status){
  if(!_db||!_fbFns||!CURRENT_USER){toast('Not connected. Please try again.','error');return false;}
  try{
    const {doc,setDoc}=_fbFns;
    await setDoc(doc(_db,FS_PATH,FS_ID,'committeeRsvps',coRsvpDocId(eventId)),{
      eventId,committeeId,memberUid:CURRENT_USER.uid,memberId:CURRENT_USER.mid||null,
      status,respondedAt:new Date().toISOString(),
    },{merge:true});
    return true;
  }catch(e){toast('Failed to save your RSVP. Please try again.','error');return false;}
}
async function coRsvpsForEvent(eventId){
  if(!_db||!_fbFns)return[];
  try{
    const {collection,query,where,getDocs}=_fbFns;
    const snap=await getDocs(query(collection(_db,FS_PATH,FS_ID,'committeeRsvps'),where('eventId','==',eventId)));
    const out=[];snap.forEach(d=>out.push({id:d.id,...d.data()}));
    return out;
  }catch(e){return[];}
}
async function coDeleteRsvpsForEvent(eventId){
  if(!_db||!_fbFns)return;
  try{
    const {collection,query,where,getDocs,writeBatch,doc}=_fbFns;
    const snap=await getDocs(query(collection(_db,FS_PATH,FS_ID,'committeeRsvps'),where('eventId','==',eventId)));
    if(snap.empty)return;
    const batch=writeBatch(_db);
    snap.forEach(d=>batch.delete(doc(_db,FS_PATH,FS_ID,'committeeRsvps',d.id)));
    await batch.commit();
  }catch(e){console.warn('Committee RSVP cleanup for deleted event failed (non-critical):',e.message);}
}
async function coDeleteRsvpsForMember(memberId){
  if(!_db||!_fbFns)return;
  try{
    const {collection,query,where,getDocs,writeBatch,doc}=_fbFns;
    const snap=await getDocs(query(collection(_db,FS_PATH,FS_ID,'committeeRsvps'),where('memberId','==',memberId)));
    if(snap.empty)return;
    const batch=writeBatch(_db);
    snap.forEach(d=>batch.delete(doc(_db,FS_PATH,FS_ID,'committeeRsvps',d.id)));
    await batch.commit();
  }catch(e){console.warn('Committee RSVP cleanup for deleted member failed (non-critical):',e.message);}
}

// Cross-module change hooks — js/events.js and js/files.js call these (guarded by typeof) after
// a committee-linked event/file CRUD so both the directory grid and an open detail view stay in
// sync without those modules needing to know anything about committees.js internals.
// coOnTasksChanged still exists purely because js/events.js's task CRUD calls it (guarded by
// typeof) for any pre-existing task with a committeeId — committees.js itself no longer surfaces
// task data anywhere, but a stale link shouldn't throw.
function coOnTasksChanged(){renderCommittees();}
function coOnEventsChanged(){renderCommittees();}
function coOnFilesChanged(){renderCommittees();}

// ══════════════════════════════════════════════
// OVERVIEW (directory) PAGE
// ══════════════════════════════════════════════
function renderCommittees(){
  coEnsureDefaults();
  const canEdit=canEditPage('committees');
  const addBtn=document.getElementById('comm-add-btn');
  if(addBtn) addBtn.style.display=canEdit?'':'none';

  const today=localDateStr();
  const allEvents=D.events.filter(e=>e.committeeId);
  const upcomingEvents=allEvents.filter(e=>e.date>=today);
  const uniqueMembers=new Set(D.committees.flatMap(c=>(c.roster||[]).map(r=>r.memberId)));

  const kpiEl=document.getElementById('co-kpi');
  if(kpiEl)kpiEl.innerHTML=
    statStrip('Active Committees',D.committees.length,(typeof getSemester==='function'?getSemester():'This semester'),'neutral')+
    statStrip('Committee Members',uniqueMembers.size,'Across all committees','neutral')+
    statStrip('Upcoming Events',upcomingEvents.length,upcomingEvents.length?'Scheduled':'None scheduled','neutral');

  const cntEl=document.getElementById('co-cnt');
  if(cntEl)cntEl.textContent=D.committees.length+' committees this semester';

  const editBtn=(id)=>canEdit?`<button class="btn" style="height:22px;font-size:10px;padding:0 7px" onclick="event.stopPropagation();openEditComm('${id}')" aria-label="Edit committee"><i class="ti ti-pencil"></i></button>`:'';
  document.getElementById('co-grid').innerHTML=D.committees.map(c=>{
    const cUpcoming=coEventsFor(c.id).filter(e=>e.date>=today).length;
    return`<div class="card co-card" tabindex="0" role="button" aria-label="Open ${esc(c.name)}" onclick="coOpenDetail('${c.id}')" onkeydown="if(event.key==='Enter')coOpenDetail('${c.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px">
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          <div style="width:34px;height:34px;border-radius:9px;background:var(--gold-bg);color:var(--gold-tx);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ${c.icon||'ti-sitemap'}" style="font-size:16px"></i></div>
          <span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">${editBtn(c.id)}</div>
      </div>
      <p style="font-size:11.5px;color:var(--mt);line-height:1.5;margin-bottom:10px;min-height:17px">${esc(c.desc)||'No description'}</p>
      <div style="display:flex;gap:12px;font-size:11px;color:var(--ht);margin-bottom:9px;flex-wrap:wrap">
        <span><i class="ti ti-users" style="font-size:11px;margin-right:3px"></i>${c.roster.length} Members</span>
        <span><i class="ti ti-calendar-event" style="font-size:11px;margin-right:3px"></i>${cUpcoming} Events</span>
      </div>
      <div style="font-size:11px;color:var(--ht);border-top:1px solid var(--bdr);padding-top:8px">
        <span>Chair: <span style="font-weight:500;color:var(--tx)">${c.chair?esc(mB(c.chair).name):'Unassigned'}</span></span>
      </div>
      <div style="text-align:right;margin-top:8px"><span style="font-size:11px;font-weight:500;color:var(--gold-tx)">View Committee →</span></div>
    </div>`;
  }).join('')||`<div style="grid-column:1/-1">${es('ti-sitemap','blue','No committees','Create committees to organize chapter working groups.',canEdit?`<button class="btn btn-p" onclick="openM('m-addcomm')"><i class="ti ti-plus"></i>New Committee</button>`:'')}</div>`;

  // Keep an already-open detail view in sync with any change made elsewhere (e.g. an event
  // added from the global Calendar page for a committee-linked event).
  if(CO_CURRENT_ID){
    const c=D.committees.find(c=>c.id===CO_CURRENT_ID);
    if(c)coRenderDetail(c);else coCloseDetail();
  }
}

// ══════════════════════════════════════════════
// DETAIL VIEW (Committee Workspace) — drill-down inside #page-committees,
// same pattern as js/files.js's fiOpenFolder() root/folder-view swap.
// ══════════════════════════════════════════════
function coOpenDetail(id){
  const c=D.committees.find(c=>c.id===id);if(!c)return;
  CO_CURRENT_ID=id;
  CO_FILES_FOLDER=null;
  CO_SELECTED_SEM=null;
  document.getElementById('co-grid-view').style.display='none';
  document.getElementById('co-detail-view').style.display='block';
  coRenderDetail(c);
  document.getElementById('co-detail-view').scrollIntoView({behavior:'smooth',block:'start'});
}
function coCloseDetail(){
  CO_CURRENT_ID=null;
  document.getElementById('co-detail-view').style.display='none';
  document.getElementById('co-grid-view').style.display='block';
}
function coTab(btn,paneId){
  document.querySelectorAll('.co-tab').forEach(t=>t.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('#co-detail-view div[id^="co-pane-"]').forEach(d=>{d.style.display='none';});
  const el=document.getElementById(paneId);if(el)el.style.display='block';
  CO_ACTIVE_TAB=paneId;
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(paneId==='co-pane-overview')coRenderOverviewPane(c);
  else if(paneId==='co-pane-members')coRenderMembersPane(c);
  else if(paneId==='co-pane-events')coRenderEventsPane(c);
  else if(paneId==='co-pane-files')coRenderFilesPane(c);
}
function coRenderDetail(c){
  const canEdit=canEditCommittee(c);
  const iconEl=document.getElementById('co-d-icon');if(iconEl)iconEl.innerHTML=`<i class="ti ${c.icon||'ti-sitemap'}"></i>`;
  const nameEl=document.getElementById('co-d-name');if(nameEl)nameEl.textContent=c.name;
  const descEl=document.getElementById('co-d-desc');if(descEl)descEl.textContent=c.desc||'No description';
  const chairEl=document.getElementById('co-d-chair');if(chairEl)chairEl.textContent=c.chair?mB(c.chair).name:'Unassigned';
  const editBtn=document.getElementById('co-d-edit-btn');if(editBtn)editBtn.style.display=canEdit?'':'none';
  const delBtn=document.getElementById('co-d-delete-btn');if(delBtn)delBtn.style.display=canEditPage('committees')?'':'none';

  initSemesterSelect('co-d-semester-select',coKnownSemestersFor(c),coSemesterChanged,coSem());
  const sem=coSem();
  const events=coEventsForSem(c.id,sem);
  const dKpi=document.getElementById('co-d-kpi');
  if(dKpi)dKpi.innerHTML=
    statStrip('Members',c.roster.length,'On roster','neutral')+
    statStrip('Events',events.length,events.filter(e=>e.date>=localDateStr()).length+' upcoming','neutral');

  coTab(document.querySelector(`.co-tab[data-tab="${CO_ACTIVE_TAB}"]`),CO_ACTIVE_TAB);
}

// ── Overview pane ──
function coRenderOverviewPane(c){
  const today=localDateStr();
  const events=coEventsForSem(c.id,coSem()).sort((a,b)=>a.date.localeCompare(b.date));
  const upcoming=events.filter(e=>e.date>=today).slice(0,5);

  const evEl=document.getElementById('co-ov-events');
  if(evEl){
    evEl.innerHTML=`<div style="font-size:11.5px;color:var(--ht);padding:10px 0">Loading…</div>`;
    Promise.all(upcoming.map(e=>coRsvpsForEvent(e.id))).then(lists=>{
      if(!document.getElementById('co-ov-events'))return;
      evEl.innerHTML=upcoming.map((e,i)=>{
        const rsvps=lists[i]||[];const yes=rsvps.filter(r=>r.status==='yes').length;
        return`<div class="ev-row"><div class="ev-dt"><div class="ev-day">${dom(e.date)}</div><div class="ev-mo">${mos(e.date)}</div></div><div style="flex:1"><div style="font-size:12.5px;font-weight:500">${esc(e.title)}</div><div style="font-size:10.5px;color:var(--mt)">${esc(e.location)||'TBD'} · ${yes} going</div></div></div>`;
      }).join('')||`<div style="font-size:11.5px;color:var(--ht);padding:10px 0">No upcoming events.</div>`;
    });
  }

  // Recent activity — derived from existing timestamped data, no separate activity log needed.
  const activity=[];
  c.roster.forEach(r=>{if(r.joinedAt)activity.push({date:r.joinedAt,icon:'ti-user-plus',txt:`${mB(r.memberId).name} joined as ${r.position}`});});
  events.forEach(e=>activity.push({date:e.date,icon:'ti-calendar-event',txt:`Event scheduled: ${e.title}`}));
  activity.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const actEl=document.getElementById('co-ov-activity');
  if(actEl)actEl.innerHTML=activity.slice(0,8).map(a=>`<div class="al-row"><div class="al-ic" style="background:var(--bl-bg);color:var(--bl-tx)"><i class="ti ${a.icon}"></i></div><div style="font-size:11.5px;line-height:1.5">${esc(a.txt)}<div style="font-size:10px;color:var(--ht)">${fds(a.date)}</div></div></div>`).join('')||`<div style="font-size:11.5px;color:var(--ht);padding:10px 0">No activity yet.</div>`;

  const statsEl=document.getElementById('co-ov-stats');
  if(statsEl)statsEl.innerHTML=
    statStrip('Events Hosted',events.filter(e=>e.date<today).length,'This semester','neutral')+
    statStrip('Member Participation',c.roster.length,'On roster','neutral');

  coRenderProgramTable(c);
}

// ── Committee Program — imported via CSV (js/import.js, type 'committeeProgram'), a
// Week/Topic/Notes table scoped to this one committee (impBuildWeeklyProgramRows in
// js/import.js does the actual CSV parsing, shared by this and nothing else now). ──
function coRenderProgramTable(c){
  const card=document.getElementById('co-ov-program-card');
  if(!c.programEnabled){
    if(card)card.style.display='none';
    return;
  }
  if(card)card.style.display='';
  const canEdit=canEditCommittee(c);
  const actions=document.getElementById('co-ov-program-actions');
  if(actions)actions.style.display=canEdit?'flex':'none';
  const el=document.getElementById('co-ov-program-table');
  if(!el)return;
  const program=[...(c.program||[])].sort((a,b)=>(a.week||0)-(b.week||0));
  if(!program.length){
    el.innerHTML=`<tbody><tr><td>${es('ti-calendar-event','amber','No program uploaded yet','Import a week-by-week program so every member knows what\'s planned this semester.',canEdit?`<button class="btn btn-p" onclick="coOpenImportProgram()">Import Program</button>`:'')}</td></tr></tbody>`;
    return;
  }
  el.innerHTML=`<thead><tr><th style="width:60px">Week</th><th>Topic</th><th>Notes</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    program.map(p=>`<tr><td style="font-weight:600">${p.week}</td><td style="font-weight:500">${esc(p.topic)}</td><td style="color:var(--mt)">${esc(p.notes||'N/A')}</td>${canEdit?`<td><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="coDeleteProgramWeek('${p.id}')" aria-label="Delete Week ${p.week}"><i class="ti ti-trash"></i></button></td>`:''}</tr>`).join('')
  }</tbody>`;
}
function coOpenImportProgram(){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to import a program for this committee.','error');return;}
  _importCommitteeId=c.id;
  openImportModal('committeeProgram');
}
async function coDeleteProgramWeek(id){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to edit this committee\'s program.','error');return;}
  const ok=await confirmDialog('Delete Week','Remove this week from the program?');
  if(!ok)return;
  const removed=(c.program||[]).find(p=>p.id===id);
  c.program=(c.program||[]).filter(p=>p.id!==id);
  try{await saveD('committees');coRenderProgramTable(c);toast('Week removed','info');}
  catch(e){if(removed)c.program.push(removed);coRenderProgramTable(c);toast('Failed to remove. Please try again.','error');}
}

// ── Members pane ──
function coRenderMembersPane(c){
  const canEdit=canEditCommittee(c);
  const addBtn=document.getElementById('co-mem-add-btn');if(addBtn)addBtn.style.display=canEdit?'':'none';
  const posBtn=document.getElementById('co-mem-positions-btn');if(posBtn)posBtn.style.display=canEdit?'':'none';

  const roster=[...c.roster].sort((a,b)=>mNameCompare(mB(a.memberId),mB(b.memberId)));
  const posOpts=(current)=>c.positions.map(p=>`<option value="${esc(p.name)}" ${p.name===current?'selected':''}>${esc(p.name)}</option>`).join('');
  const editCol=canEdit?'<th></th>':'';
  const rows=roster.map(r=>{
    const m=mB(r.memberId);
    const status=m.memberStatus||'Active';
    const posCell=canEdit?`<select onchange="coSetMemberPosition('${r.memberId}',this.value)" style="height:26px;font-size:11px">${posOpts(r.position)}</select>`:esc(r.position);
    const removeCell=canEdit?`<td><button class="ib" style="width:24px;height:24px;color:var(--rd)" onclick="coRemoveRosterMember('${r.memberId}')" aria-label="Remove ${esc(m.name)}"><i class="ti ti-x"></i></button></td>`:'';
    return`<tr><td><div style="display:flex;align-items:center;gap:7px"><div class="sh-av" style="width:25px;height:25px;font-size:8.5px">${esc(m.initials||'??')}</div><span style="font-weight:500">${esc(m.name)}</span></div></td><td>${posCell}</td><td style="color:var(--mt)">${esc(m.classYear||'N/A')}</td><td><span class="badge ${status==='New Member'?'bb2':'bm2'}">${esc(status)}</span></td>${removeCell}</tr>`;
  }).join('')||`<tr><td colspan="5" style="text-align:center;color:var(--mt);padding:18px;font-size:12px">No members on this committee yet.</td></tr>`;
  const tbl=document.getElementById('co-mem-table');
  if(tbl)tbl.innerHTML=`<thead><tr><th>Member</th><th>Position</th><th>Class Year</th><th>Status</th>${editCol}</tr></thead><tbody>${rows}</tbody>`;

  const mob=document.getElementById('co-mem-mobile-cards');
  if(mob)mob.innerHTML=roster.map(r=>{
    const m=mB(r.memberId);
    return`<div class="m-mob-card card">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="sh-av" style="width:34px;height:34px;font-size:12px">${esc(m.initials||'??')}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div><div style="font-size:10.5px;color:var(--mt)">${esc(r.position)}</div></div>
        ${canEdit?`<button class="ib" style="width:24px;height:24px;color:var(--rd)" onclick="coRemoveRosterMember('${r.memberId}')" aria-label="Remove ${esc(m.name)}"><i class="ti ti-x"></i></button>`:''}
      </div>
    </div>`;
  }).join('')||`<div style="grid-column:1/-1;text-align:center;color:var(--mt);padding:18px;font-size:12px">No members yet.</div>`;

  coRenderPositionDescriptions(c);
}

// What each of this committee's custom positions is responsible for — read-only for everyone
// (not just editors), so a member can look up what a position actually does without needing to
// open the Manage Positions modal, which is edit-only. Positions with no description yet still
// show up, with a muted placeholder, so an editor is nudged to fill them in.
function coRenderPositionDescriptions(c){
  const el=document.getElementById('co-mem-positions-info');
  if(!el)return;
  const canEdit=canEditCommittee(c);
  el.innerHTML=`<div class="card" style="margin-top:13px">
    <div class="card-hd"><span class="card-t">Position Responsibilities</span>${canEdit?`<button class="card-a" onclick="coOpenPositions()">Edit</button>`:''}</div>
    <div style="display:flex;flex-direction:column;gap:11px">
      ${c.positions.map(p=>`<div>
        <div style="font-size:12px;font-weight:600;margin-bottom:2px">${esc(p.name)}</div>
        <div style="font-size:11.5px;line-height:1.5;color:${p.description?'var(--mt)':'var(--ht)'}">${p.description?esc(p.description):'No description added yet.'}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ── Events pane ──
function coRenderEventsPane(c){
  const canEdit=canEditCommittee(c)&&isCurrentSemester(coSem());
  const addBtn=document.getElementById('co-event-add-btn');if(addBtn)addBtn.style.display=canEdit?'':'none';
  const today=localDateStr();
  const events=coEventsForSem(c.id,coSem()).sort((a,b)=>a.date.localeCompare(b.date));
  const upcoming=events.filter(e=>e.date>=today);
  const past=events.filter(e=>e.date<today).reverse();
  const rowHtml=(e,isPast)=>{
    const attCount=isPast?Object.values(D.attendance[e.id]||{}).filter(v=>v==='present').length:null;
    return`<div class="ev-row"><div class="ev-dt"><div class="ev-day">${dom(e.date)}</div><div class="ev-mo">${mos(e.date)}</div></div><div style="flex:1"><div style="font-size:12.5px;font-weight:500">${esc(e.title)}</div><div style="font-size:10.5px;color:var(--mt)">${to12h(e.start)||'TBD'} · ${esc(e.location)||'N/A'}${isPast&&attCount!==null?' · '+attCount+' attended':''}</div></div>${e.mandatory?'<span class="badge br2">Req</span>':''}${canEdit?`<div style="display:flex;gap:3px;margin-left:6px"><button class="btn" style="height:22px;font-size:10px;padding:0 6px" onclick="openEditEvent('${e.id}')" aria-label="Edit ${esc(e.title)}"><i class="ti ti-pencil"></i></button><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="deleteEvent('${e.id}')" aria-label="Delete ${esc(e.title)}"><i class="ti ti-trash"></i></button></div>`:''}</div>`;
  };
  const upEl=document.getElementById('co-events-upcoming');
  if(upEl)upEl.innerHTML=upcoming.map(e=>rowHtml(e,false)).join('')||`<div style="font-size:11.5px;color:var(--ht);padding:10px 0">No upcoming events.</div>`;
  const pastEl=document.getElementById('co-events-past');
  if(pastEl)pastEl.innerHTML=past.map(e=>rowHtml(e,true)).join('')||`<div style="font-size:11.5px;color:var(--ht);padding:10px 0">No past events yet.</div>`;
}
function coOpenAddEvent(){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to add events for this committee.','error');return;}
  if(!isCurrentSemester(coSem())){toast('This semester is read-only.','error');return;}
  openM('m-addevent');
  const cf=document.getElementById('ne-committee-id');if(cf)cf.value=c.id;
  const tp=document.getElementById('ne-tp');if(tp)tp.value='committee';
}

// ── Files pane — reuses js/files.js's fiProcessFiles()/fiOpenDoc()/fiDelete(), scoped by
// committeeId, with the committee's own fileFolders standing in for DEFAULT_FILE_FOLDERS.
// Subfolders use the same parent-pointer/namespaced-name trick as js/files.js's chapter-wide
// Files page: a subfolder's `name` is "Parent/Child" (unique, used for matching f.folder) while
// `label` holds the short display text. ──
function coFolderDisplayName(c,name){
  const f=(c.fileFolders||[]).find(x=>x.name===name);
  return f?(f.label||f.name):name;
}
function coRenderFilesPane(c){
  const canEdit=canEditCommittee(c);
  const newFolderBtn=document.getElementById('co-new-folder-btn');if(newFolderBtn)newFolderBtn.style.display=canEdit?'':'none';
  const newSubBtn=document.getElementById('co-files-new-subfolder-btn');if(newSubBtn)newSubBtn.style.display=canEdit?'':'none';
  const uploadLabel=document.getElementById('co-files-upload-label');if(uploadLabel)uploadLabel.style.display=canEdit?'':'none';
  const files=coFilesFor(c.id);
  const root=document.getElementById('co-files-root');
  const folderView=document.getElementById('co-files-folder-view');
  if(!root||!folderView)return;
  // No per-card delete control — deleting a folder requires opening it and clicking the
  // dedicated red "Delete This Folder" button (coDeleteCurrentFolder()) so it can't happen from
  // a stray click on the grid.
  const folderCard=fo=>{
    const count=files.filter(f=>f.folder===fo.name).length;
    const label=fo.label||fo.name;
    return`<div class="card" style="cursor:pointer" tabindex="0" role="button" aria-label="Open ${esc(label)} folder" onclick="coOpenFilesFolder('${esc(fo.name).replace(/'/g,"\\'")}')"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><i class="ti ti-folder" style="font-size:16px;color:var(--gold-tx)"></i><span style="font-size:12.5px;font-weight:500">${esc(label)}</span></div><div style="font-size:10.5px;color:var(--mt)">${count} file${count!==1?'s':''}</div></div>`;
  };
  if(CO_FILES_FOLDER){
    root.style.display='none';folderView.style.display='block';
    const nameEl=document.getElementById('co-files-folder-name');if(nameEl)nameEl.textContent=coFolderDisplayName(c,CO_FILES_FOLDER);
    const children=(c.fileFolders||[]).filter(fo=>fo.parent===CO_FILES_FOLDER);
    const subEl=document.getElementById('co-files-subfolders');
    if(subEl)subEl.innerHTML=children.map(folderCard).join('');
    const delBtn=document.getElementById('co-files-delete-folder-btn');
    if(delBtn)delBtn.style.display=canEdit?'':'none';
    const inFolder=files.filter(f=>f.folder===CO_FILES_FOLDER);
    const listEl=document.getElementById('co-files-folder-list');
    if(listEl)listEl.innerHTML=inFolder.map(f=>coFileCard(f,canEdit)).join('')||`<div style="padding:16px;text-align:center;color:var(--mt);font-size:12px">No files in this folder yet.</div>`;
  }else{
    root.style.display='block';folderView.style.display='none';
    // No fallback "General" folder here — a committee genuinely starts with zero folders until
    // an officer creates one.
    const folders=(c.fileFolders||[]).filter(fo=>!fo.parent);
    const foldersEl=document.getElementById('co-files-folders');
    if(foldersEl)foldersEl.innerHTML=folders.map(folderCard).join('');
    const emptyEl=document.getElementById('co-files-empty');
    if(emptyEl){
      emptyEl.style.display=folders.length?'none':'block';
      emptyEl.innerHTML=folders.length?'':es('ti-folder-plus','slate','No folders yet',canEdit?'Create a folder to start organizing this committee\'s files.':'No folders have been created for this committee yet.',canEdit?`<button class="btn btn-p" onclick="coOpenAddFolder()"><i class="ti ti-plus"></i>New Folder</button>`:'');
    }
  }
}
function coFileCard(f,canEdit){
  return`<div class="card" style="display:flex;align-items:center;gap:9px;margin-bottom:7px;cursor:pointer" onclick="fiOpenDoc('${f.id}')"><i class="ti ti-file-text" style="font-size:16px;color:var(--mt)"></i><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div><div style="font-size:10.5px;color:var(--mt)">${esc(f.size)} · ${fds(f.date)}</div></div>${canEdit?`<button class="ib" style="width:24px;height:24px;color:var(--rd)" onclick="event.stopPropagation();fiDelete('${f.id}')" aria-label="Delete ${esc(f.name)}"><i class="ti ti-trash"></i></button>`:''}</div>`;
}
function coOpenFilesFolder(name){
  CO_FILES_FOLDER=name;
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(c)coRenderFilesPane(c);
}
function coCloseFilesFolder(){
  CO_FILES_FOLDER=null;
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(c)coRenderFilesPane(c);
}
// Steps up one level (to the parent folder) instead of always jumping to the root folder grid.
function coFilesBack(){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  const cur=(c.fileFolders||[]).find(fo=>fo.name===CO_FILES_FOLDER);
  if(cur&&cur.parent)coOpenFilesFolder(cur.parent);else coCloseFilesFolder();
}
function coHandleFileUpload(inp){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c||!inp.files.length)return;
  // Upload only exists inside an opened folder (there's no root-level dropzone), so there's never
  // an ambiguous "which folder?" default to fall back to.
  if(!CO_FILES_FOLDER){toast('Open a folder first to upload into it.','error');inp.value='';return;}
  fiProcessFiles(inp.files,CO_FILES_FOLDER,c.id);
  inp.value='';
}
function coOpenAddFolder(){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  document.getElementById('co-folder-name').value='';
  const parent=CO_FILES_FOLDER;
  const titleEl=document.getElementById('co-addfolder-title');
  if(titleEl)titleEl.textContent=parent?('New Subfolder in '+coFolderDisplayName(c,parent)):'New Folder';
  openM('m-co-addfolder');
}
function coAddFolder(){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to create folders for this committee.','error');return;}
  const label=document.getElementById('co-folder-name').value.trim();
  if(!label){toast('Folder name is required','error');return;}
  const parent=CO_FILES_FOLDER||null;
  const key=parent?parent+'/'+label:label;
  if(!c.fileFolders)c.fileFolders=[];
  if(c.fileFolders.find(fo=>fo.name.toLowerCase()===key.toLowerCase())){toast('A folder with that name already exists here','error');return;}
  c.fileFolders.push(parent?{name:key,label,parent}:{name:key});
  saveD('committees');closeM(null,document.getElementById('m-co-addfolder'));coRenderFilesPane(c);toast('Folder created','success');
}
// Cascades to every subfolder beneath the one being deleted (same reasoning as fiDeleteFolder in
// js/files.js — an orphaned subtree with no way to reach it isn't meaningfully "deleted").
function coCollectDescendantFolders(c,folderName){
  const folders=c.fileFolders||[];
  let names=[folderName],frontier=[folderName];
  while(frontier.length){
    const kids=folders.filter(fo=>frontier.includes(fo.parent)).map(fo=>fo.name).filter(n=>!names.includes(n));
    names=names.concat(kids);
    frontier=kids;
  }
  return names;
}
// Only reachable from inside the open folder itself (the "Delete This Folder" button) — there's
// no delete control on the folder cards anymore, so this can't fire from a stray click.
function coDeleteCurrentFolder(){
  if(!CO_FILES_FOLDER)return;
  coDeleteFolder(CO_FILES_FOLDER);
}
// Unlike the main Files page, "General" isn't a permanent fixture for committees anymore — it can
// be created, renamed-away-from (by being deleted), whatever. But deleted files still need
// *somewhere* to land, so if this delete would otherwise orphan files with no folder left to hold
// them, a "General" lost-and-found is (re)created on the spot to receive them — never created
// speculatively, only the moment it's actually needed.
async function coDeleteFolder(folderName){
  const c=D.committees.find(c=>c.id===CO_CURRENT_ID);if(!c)return;
  if(!canEditCommittee(c)){toast('You do not have permission to delete folders for this committee.','error');return;}
  const allNames=coCollectDescendantFolders(c,folderName);
  const subCount=allNames.length-1;
  const count=D.files.filter(f=>f.committeeId===c.id&&allNames.includes(f.folder)).length;
  let msg='Delete "'+coFolderDisplayName(c,folderName)+'"?';
  if(subCount)msg+=' This will also delete '+subCount+' subfolder'+(subCount!==1?'s':'')+'.';
  if(count)msg+=' '+count+' file'+(count!==1?'s':'')+' will be moved to a General folder.';
  const ok=await confirmDialog('Delete Folder',msg,'Delete',true);
  if(!ok)return;
  D.files.forEach(f=>{if(f.committeeId===c.id&&allNames.includes(f.folder))f.folder='General';});
  c.fileFolders=(c.fileFolders||[]).filter(fo=>!allNames.includes(fo.name));
  if(count&&!c.fileFolders.some(fo=>fo.name==='General'))c.fileFolders.push({name:'General'});
  saveD('files','committees');
  if(CO_FILES_FOLDER&&allNames.includes(CO_FILES_FOLDER))coCloseFilesFolder();else coRenderFilesPane(c);
  toast('Folder deleted','info');
}


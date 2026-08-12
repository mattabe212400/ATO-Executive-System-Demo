// ══════════════════════════════════════════════
// CHAPLAIN HUB (page key stays 'ritual' — Chaplain already has edit access to it)
// ══════════════════════════════════════════════
// Bible study planning, brotherhood/morale events, and engagement follow-ups live in
// D.chaplainHub (one saveD() key, same whole-doc pattern as every other module).

function canEditRitual(){
  return canEditPage('ritual');
}
function chFull(){ return canEditRitual() || isLeadUser(); }

const CH_EVENT_TYPES=[
  {v:'movie',l:'Movie Night'},{v:'golf',l:'Golf'},{v:'bags',l:'Bags Tournament'},
  {v:'meal',l:'Brotherhood Meal'},{v:'sports',l:'Sports/Rec'},{v:'retreat',l:'Retreat'},{v:'custom',l:'Other'}
];
function chEventTypeLabel(v){ return (CH_EVENT_TYPES.find(t=>t.v===v)||{}).l||v||'Other'; }

const CH_PLANNING_STATUSES=[
  {v:'idea',l:'Idea',c:'bm2'},{v:'planning',l:'Planning',c:'ba2'},
  {v:'scheduled',l:'Scheduled',c:'bb2'},{v:'completed',l:'Completed',c:'bg2'}
];
function chStatusLabel(v){ return (CH_PLANNING_STATUSES.find(s=>s.v===v)||{}).l||v; }
function chStatusClass(v){ return (CH_PLANNING_STATUSES.find(s=>s.v===v)||{}).c||'bm2'; }

const CH_BS_STATUSES=[
  {v:'planned',l:'Planned',c:'bb2'},{v:'completed',l:'Completed',c:'bg2'},{v:'canceled',l:'Canceled',c:'br2'}
];
function chBsStatusLabel(v){ return (CH_BS_STATUSES.find(s=>s.v===v)||{}).l||v; }
function chBsStatusClass(v){ return (CH_BS_STATUSES.find(s=>s.v===v)||{}).c||'bm2'; }

// Devotionals — structured identically to Bible Study (same statuses, same fields), just a
// separate, shorter-form reflection log — lives in the shared D.events calendar (type:'faith',
// faithCategory:'devotional'), see chDevotionals() below.
const CH_DV_STATUSES=[
  {v:'planned',l:'Planned',c:'bb2'},{v:'completed',l:'Completed',c:'bg2'},{v:'canceled',l:'Canceled',c:'br2'}
];
function chDvStatusLabel(v){ return (CH_DV_STATUSES.find(s=>s.v===v)||{}).l||v; }
function chDvStatusClass(v){ return (CH_DV_STATUSES.find(s=>s.v===v)||{}).c||'bm2'; }

// General members only see Bible studies/events that have actually been finalized — not
// early-stage ideas that may still change, mirroring the Social Events member-visibility rule.
const CH_MEMBER_VISIBLE_EVENT_STATUSES=['scheduled','completed'];

// ══════════════════════════════════════════════
// MAIN RENDER — branches by role
// ══════════════════════════════════════════════
function renderRitual(){
  chEnsureDevotionalsMigrated();
  const full=chFull();
  const fullEl=document.getElementById('ch-full-view');
  const memberEl=document.getElementById('ch-member-view');
  const actionsEl=document.getElementById('ch-full-actions');
  if(fullEl)fullEl.style.display=full?'':'none';
  if(memberEl)memberEl.style.display=full?'none':'';
  if(actionsEl)actionsEl.style.display=full?'':'none';
  if(full){
    initSemesterSelect('ritual-semester-select',chKnownSemesters(),chSemesterChanged,chSem());
    chRenderKpis();
    if(typeof bscRenderProgram==='function')bscRenderProgram();
    chRenderDevotionals();
    chRenderEvents();
    chRenderKanban();
  }else{
    chRenderMemberView();
  }
}

// ── DATA HELPERS ──
function chBibleStudies(){ return D.chaplainHub.bibleStudies||[]; }
// Devotionals live in the shared D.events calendar (type:'faith', faithCategory:'devotional'),
// same pattern as Brotherhood events below — so scheduling one always shows up on the Calendar
// too, not a separate copy. One-time migration folds any pre-existing D.chaplainHub.devotionals
// entries in (idempotent — re-running it after they're already migrated is a no-op, since it
// checks for the id already existing in D.events first).
function chEnsureDevotionalsMigrated(){
  const legacy=D.chaplainHub.devotionals||[];
  if(!legacy.length)return;
  legacy.forEach(d=>{
    if(D.events.some(e=>e.id===d.id))return;
    D.events.push({
      id:d.id, title:d.topic||'Devotional', type:'faith', faithCategory:'devotional', mandatory:false,
      date:d.date, start:d.time||'',
      topic:d.topic||'', scripture:d.scripture||'', discussionQuestions:d.discussionQuestions||'',
      notes:d.notes||'', status:d.status||'planned',
    });
  });
  D.chaplainHub.devotionals=[];
}
function chDevotionals(){ return (D.events||[]).filter(e=>e.type==='faith'&&e.faithCategory==='devotional'); }
// Brotherhood events live in the shared D.events calendar (type:'brotherhood'), same pattern
// as Social/Philanthropy/New Member Education — so scheduling one here always shows up on the
// Calendar too, not a separate copy. Planning-board fields (chEventType/estCost/planningStatus/
// owner/notes/reflection) ride along inline on the same event record.
function chEvents(){ return (D.events||[]).filter(e=>e.type==='brotherhood'); }

// ── Semester scoping — devotionals and brotherhood events both carry real dates, so this is
// pure date-range filtering (no stamp/migration needed). D.ritual.items (static ceremony
// checklist) and D.bibleStudyCurriculum (a linear syllabus that can span a semester boundary
// mid-chapter) are deliberately left unpartitioned — same category as Community Service's
// locations[]. chRenderMemberView() also stays unfiltered — a forward-looking "what's next" view.
let CH_SELECTED_SEM=null;
function chSem(){ return CH_SELECTED_SEM||getSemester(); }
function chKnownSemesters(){
  return unionKnownSemesters([
    ...chDevotionals().map(d=>semesterLabelForDate(d.date)),
    ...chEvents().map(e=>semesterLabelForDate(e.date)),
  ].filter(Boolean));
}
function chVisibleDevotionals(){
  return chDevotionals().filter(d=>semesterLabelForDate(d.date)===chSem());
}
function chVisibleEvents(){
  return chEvents().filter(e=>semesterLabelForDate(e.date)===chSem());
}
function chSemesterChanged(){
  CH_SELECTED_SEM=document.getElementById('ritual-semester-select').value;
  renderRitual();
}

// ══════════════════════════════════════════════
// KPI ROW
// ══════════════════════════════════════════════
function chRenderKpis(){
  const today=localDateStr();
  const events=chVisibleEvents();
  const upcomingEvents=events.filter(e=>e.date>=today && e.planningStatus!=='completed');
  const activeEventPlans=events.filter(e=>['idea','planning','scheduled'].includes(e.planningStatus));
  const completedEvents=events.filter(e=>e.planningStatus==='completed');

  document.getElementById('ch-kpi').innerHTML=
    statStrip('Upcoming Brotherhood Events',upcomingEvents.length,'On the calendar','neutral')+
    statStrip('Active Event Plans',activeEventPlans.length,'Idea + Planning + Scheduled','neutral')+
    statStrip('Past Events Completed',completedEvents.length,'All-time','neutral');
}

// Bible Study Planner (D.chaplainHub.bibleStudies, an informal per-session log) removed — the
// full PDF-per-chapter Program below (js/biblestudy.js) now covers scheduling, attendance, and
// notes per session. chBibleStudies() stays since chRenderMemberView() below still reads it
// for the "Next Bible Study" card; the data itself is left untouched in Firestore.

// Bible Study Program (structured week-by-week curriculum) moved to js/biblestudy.js —
// D.bibleStudyCurriculum, a PDF-per-chapter Chaplain workspace with its own Program
// Overview/Chapter Workspace views inside #ch-curriculum-card. D.chaplainHub.bibleStudyProgram
// (the old Week/Topic/Notes list) is left in place, untouched, for historical reference only.

// ══════════════════════════════════════════════
// DEVOTIONALS — same shape/flow as Bible Study Planner above, kept as its own Faith Event
// sub-category (faithCategory:'devotional') rather than folded into bibleStudies, since a
// chapter may run both a weekly Bible study and separate shorter devotionals.
// ══════════════════════════════════════════════
function chRenderDevotionals(){
  const el=document.getElementById('ch-dv-table');
  if(!el)return;
  const canEdit=chFull()&&isCurrentSemester(chSem());
  const list=[...chVisibleDevotionals()].sort((a,b)=>b.date.localeCompare(a.date));
  if(!list.length){ el.innerHTML=`<tbody><tr><td>${es('ti-book-2','slate','No devotionals yet','Plan your first devotional.',canEdit?'<button class="btn btn-p" onclick="chOpenAddDevotional()">Add Devotional</button>':'')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Date</th><th>Topic</th><th>Scripture</th><th>Status</th><th></th></tr></thead><tbody>${
    list.map(s=>`<tr>
      <td>${fds(s.date)}${s.start?' '+to12h(s.start):''}</td>
      <td style="font-weight:500">${esc(s.topic||'N/A')}</td>
      <td>${esc(s.scripture||'N/A')}</td>
      <td><span class="badge ${chDvStatusClass(s.status)}">${chDvStatusLabel(s.status)}</span></td>
      <td style="white-space:nowrap">${canEdit?`<button class="btn" style="height:22px;font-size:10px;padding:0 6px" onclick="chOpenEditDevotional('${s.id}')" aria-label="Edit"><i class="ti ti-edit"></i></button> <button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="chDeleteDevotional('${s.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`:''}</td>
    </tr>`).join('')
  }</tbody>`;
}
function chOpenAddDevotional(){
  if(!chFull())return;
  if(!isCurrentSemester(chSem())){toast('This semester is read-only.','error');return;}
  document.getElementById('ch-dv-id').value='';
  document.getElementById('ch-dv-date').value=localDateStr();
  document.getElementById('ch-dv-time').value='';
  document.getElementById('ch-dv-topic').value='';
  document.getElementById('ch-dv-scripture').value='';
  document.getElementById('ch-dv-questions').value='';
  document.getElementById('ch-dv-notes').value='';
  document.getElementById('ch-dv-status').value='planned';
  openM('m-ch-devotional');
}
function chOpenEditDevotional(id){
  if(!chFull())return;
  const s=chDevotionals().find(x=>x.id===id);
  if(!s)return;
  if(!isCurrentSemester(semesterLabelForDate(s.date))){toast('This devotional is in a past semester and is read-only.','error');return;}
  document.getElementById('ch-dv-id').value=s.id;
  document.getElementById('ch-dv-date').value=s.date||'';
  document.getElementById('ch-dv-time').value=s.start||'';
  document.getElementById('ch-dv-topic').value=s.topic||'';
  document.getElementById('ch-dv-scripture').value=s.scripture||'';
  document.getElementById('ch-dv-questions').value=s.discussionQuestions||'';
  document.getElementById('ch-dv-notes').value=s.notes||'';
  document.getElementById('ch-dv-status').value=s.status||'planned';
  openM('m-ch-devotional');
}
async function chSaveDevotional(){
  const id=document.getElementById('ch-dv-id').value;
  const date=document.getElementById('ch-dv-date').value;
  const topic=document.getElementById('ch-dv-topic').value.trim();
  if(!date||!topic){ toast('Date and topic are required','error'); return; }
  const fields={
    title:topic, date, start:document.getElementById('ch-dv-time').value,
    topic, scripture:document.getElementById('ch-dv-scripture').value.trim(),
    discussionQuestions:document.getElementById('ch-dv-questions').value.trim(),
    notes:document.getElementById('ch-dv-notes').value.trim(),
    status:document.getElementById('ch-dv-status').value,
  };
  let prev=null,isNew=false,newEvent=null;
  if(id){
    const s=chDevotionals().find(x=>x.id===id);
    if(!s)return;
    if(!isCurrentSemester(semesterLabelForDate(s.date))){toast('This devotional is in a past semester and is read-only.','error');return;}
    prev={...s}; Object.assign(s,fields);
  }else{
    if(!isCurrentSemester(chSem())){toast('This semester is read-only.','error');return;}
    isNew=true;
    newEvent={id:uid(),type:'faith',faithCategory:'devotional',mandatory:false,...fields};
    D.events.push(newEvent);
  }
  try{
    await saveD('events');
    closeM(null,document.getElementById('m-ch-devotional'));
    renderRitual();
    toast(id?'Devotional updated':'Devotional added','success');
  }catch(e){
    if(id&&prev){ const s=chDevotionals().find(x=>x.id===id); if(s)Object.assign(s,prev); }
    else if(isNew){ D.events=D.events.filter(x=>x.id!==newEvent.id); }
    toast('Failed to save. Please try again.','error');
  }
}
async function chDeleteDevotional(id){
  if(!chFull())return;
  const d=chDevotionals().find(x=>x.id===id);
  if(d&&!isCurrentSemester(semesterLabelForDate(d.date))){toast('This devotional is in a past semester and is read-only.','error');return;}
  const ok=await confirmDialog('Delete Devotional','Delete this devotional?');
  if(!ok)return;
  const removed=D.events.find(x=>x.id===id);
  D.events=D.events.filter(x=>x.id!==id);
  try{ await saveD('events'); renderRitual(); toast('Devotional deleted','info'); }
  catch(e){ if(removed)D.events.push(removed); toast('Failed to delete. Please try again.','error'); }
}

// ══════════════════════════════════════════════
// BROTHERHOOD EVENTS TRACKER
// ══════════════════════════════════════════════
function chRenderEvents(){
  const el=document.getElementById('ch-events-table');
  if(!el)return;
  const canEdit=chFull()&&isCurrentSemester(chSem());
  const list=[...chVisibleEvents()].sort((a,b)=>b.date.localeCompare(a.date));
  if(!list.length){ el.innerHTML=`<tbody><tr><td>${es('ti-users-group','slate','No brotherhood events yet','Plan a movie night, golf outing, or other morale event.',canEdit?'<button class="btn btn-p" onclick="chOpenAddEvent()">Add Event</button>':'')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Name</th><th>Type</th><th>Date</th><th>Location</th><th>Est. Cost</th><th>Status</th><th></th></tr></thead><tbody>${
    list.map(e=>`<tr>
      <td style="font-weight:500">${esc(e.title)}</td>
      <td>${esc(chEventTypeLabel(e.chEventType))}</td>
      <td>${fds(e.date)}</td>
      <td>${esc(e.location||'N/A')}</td>
      <td>${e.estCost!=null?'$'+Number(e.estCost).toLocaleString():'N/A'}</td>
      <td><span class="badge ${chStatusClass(e.planningStatus)}">${chStatusLabel(e.planningStatus)}</span></td>
      <td style="white-space:nowrap">${canEdit?`<button class="btn" style="height:22px;font-size:10px;padding:0 6px" onclick="chOpenEditEvent('${e.id}')" aria-label="Edit"><i class="ti ti-edit"></i></button> <button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="chDeleteEvent('${e.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`:''}</td>
    </tr>`).join('')
  }</tbody>`;
}
function chEventTypeOptions(sel){ return CH_EVENT_TYPES.map(t=>`<option value="${t.v}" ${sel===t.v?'selected':''}>${t.l}</option>`).join(''); }
function chStatusOptions(sel){ return CH_PLANNING_STATUSES.map(s=>`<option value="${s.v}" ${sel===s.v?'selected':''}>${s.l}</option>`).join(''); }
function chToggleEventCompletedFields(){
  const status=document.getElementById('ch-ev-status').value;
  const wrap=document.getElementById('ch-ev-completed-fields');
  if(wrap)wrap.style.display=status==='completed'?'':'none';
}
function chOpenAddEvent(){
  if(!chFull())return;
  if(!isCurrentSemester(chSem())){toast('This semester is read-only.','error');return;}
  document.getElementById('ch-ev-id').value='';
  document.getElementById('ch-ev-name').value='';
  document.getElementById('ch-ev-type').innerHTML=chEventTypeOptions('movie');
  document.getElementById('ch-ev-date').value=localDateStr();
  document.getElementById('ch-ev-time').value='';
  document.getElementById('ch-ev-location').value='';
  document.getElementById('ch-ev-cost').value='';
  document.getElementById('ch-ev-status').innerHTML=chStatusOptions('idea');
  document.getElementById('ch-ev-owner').innerHTML='<option value="">Unassigned</option>'+sortedMembers().map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('');
  document.getElementById('ch-ev-notes').value='';
  document.getElementById('ch-ev-reflection').value='';
  chToggleEventCompletedFields();
  openM('m-ch-event');
}
function chOpenEditEvent(id){
  if(!chFull())return;
  const e=chEvents().find(x=>x.id===id);
  if(!e)return;
  if(!isCurrentSemester(semesterLabelForDate(e.date))){toast('This event is in a past semester and is read-only.','error');return;}
  document.getElementById('ch-ev-id').value=e.id;
  document.getElementById('ch-ev-name').value=e.title;
  document.getElementById('ch-ev-type').innerHTML=chEventTypeOptions(e.chEventType);
  document.getElementById('ch-ev-date').value=e.date||'';
  document.getElementById('ch-ev-time').value=e.start||'';
  document.getElementById('ch-ev-location').value=e.location||'';
  document.getElementById('ch-ev-cost').value=e.estCost!=null?e.estCost:'';
  document.getElementById('ch-ev-status').innerHTML=chStatusOptions(e.planningStatus);
  document.getElementById('ch-ev-owner').innerHTML='<option value="">Unassigned</option>'+sortedMembers().map(m=>`<option value="${m.id}" ${e.owner===m.id?'selected':''}>${esc(m.name)}</option>`).join('');
  document.getElementById('ch-ev-notes').value=e.notes||'';
  document.getElementById('ch-ev-reflection').value=e.reflection||'';
  chToggleEventCompletedFields();
  openM('m-ch-event');
}
async function chSaveEvent(){
  const id=document.getElementById('ch-ev-id').value;
  const title=document.getElementById('ch-ev-name').value.trim();
  const date=document.getElementById('ch-ev-date').value;
  if(!title||!date){ toast('Name and date are required','error'); return; }
  const fields={
    title, type:'brotherhood', chEventType:document.getElementById('ch-ev-type').value, date,
    start:document.getElementById('ch-ev-time').value,
    location:document.getElementById('ch-ev-location').value.trim(),
    estCost:document.getElementById('ch-ev-cost').value===''?null:parseFloat(document.getElementById('ch-ev-cost').value),
    planningStatus:document.getElementById('ch-ev-status').value,
    owner:document.getElementById('ch-ev-owner').value||null,
    notes:document.getElementById('ch-ev-notes').value.trim(),
    reflection:document.getElementById('ch-ev-reflection').value.trim(),
  };
  let prev=null;
  if(id){
    const e=D.events.find(x=>x.id===id);
    if(!e)return;
    if(!isCurrentSemester(semesterLabelForDate(e.date))){toast('This event is in a past semester and is read-only.','error');return;}
    prev={...e}; Object.assign(e,fields);
  }else{
    if(!isCurrentSemester(chSem())){toast('This semester is read-only.','error');return;}
    D.events.push({id:uid(),mandatory:false,...fields});
  }
  try{
    await saveD('events');
    closeM(null,document.getElementById('m-ch-event'));
    renderRitual();
    if(typeof renderCalendar==='function')renderCalendar();
    toast(id?'Event updated':'Event added','success');
  }catch(e2){
    if(id&&prev){ const e=D.events.find(x=>x.id===id); if(e)Object.assign(e,prev); }
    else{ D.events=D.events.filter(x=>x.title!==title||x.date!==date); }
    toast('Failed to save. Please try again.','error');
  }
}
async function chDeleteEvent(id){
  if(!chFull())return;
  const ev=D.events.find(x=>x.id===id);
  if(ev&&!isCurrentSemester(semesterLabelForDate(ev.date))){toast('This event is in a past semester and is read-only.','error');return;}
  const attNote=canEditPage('attendance')?' Its attendance record will also be removed.':'';
  const ok=await confirmDialog('Delete Event','Delete this brotherhood event?'+attNote);
  if(!ok)return;
  const removed=D.events.find(x=>x.id===id);
  const removedAtt=D.attendance[id];
  D.events=D.events.filter(x=>x.id!==id);
  delete D.attendance[id];
  // Only bundle 'attendance' if this caller's grant actually covers it — saveD's writeBatch
  // is atomic, so an unauthorized extra key would deny the whole batch (see js/events.js's
  // deleteEvent for the same fix and full explanation).
  const keys=['events'];
  if(canEditPage('attendance'))keys.push('attendance');
  try{
    await saveD(...keys);
    renderRitual();
    if(typeof renderCalendar==='function')renderCalendar();
    toast('Event deleted','info');
  }catch(e){
    if(removed)D.events.push(removed);
    if(removedAtt)D.attendance[id]=removedAtt;
    toast('Failed to delete. Please try again.','error');
  }
}

// ══════════════════════════════════════════════
// EVENT PLANNING BOARD (kanban, drag-and-drop — mirrors js/recruitment.js's rcRenderKanban)
// ══════════════════════════════════════════════
let CH_DRAG_ID=null;
function chRenderKanban(){
  const kanban=document.getElementById('ch-kanban');
  if(!kanban)return;
  const canDrag=chFull()&&isCurrentSemester(chSem());
  kanban.innerHTML=CH_PLANNING_STATUSES.map(stage=>{
    const items=chVisibleEvents().filter(e=>e.planningStatus===stage.v);
    return `<div class="rc-col">
      <div class="rc-col-head" style="border-top-color:${stage.v==='completed'?'var(--gn)':stage.v==='scheduled'?'var(--sky)':stage.v==='planning'?'var(--am)':'var(--ht)'}">
        <span style="font-size:11.5px;font-weight:500">${stage.l}</span>
        <span style="font-size:10.5px;color:var(--mt)">${items.length}</span>
      </div>
      <div class="rc-col-body rc-col-drop" id="chkd-${stage.v}"
        ondragover="event.preventDefault();this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="chDrop(event,'${stage.v}')">
        ${items.map(e=>`<div class="rc-card" draggable="${canDrag}" id="chkc-${e.id}" tabindex="0" role="button" aria-label="Edit ${esc(e.title)}"
          ondragstart="chDragStart('${e.id}')"
          ondragend="document.querySelectorAll('.rc-col-drop').forEach(c=>c.classList.remove('drag-over'))"
          onclick="chOpenEditEvent('${e.id}')">
          <div style="font-size:12px;font-weight:500;margin-bottom:4px">${esc(e.title)}</div>
          <div style="font-size:10.5px;color:var(--mt)">${esc(chEventTypeLabel(e.chEventType))} · ${fds(e.date)}</div>
          <div style="font-size:10px;color:var(--ht);margin-top:3px">${e.owner?esc(mB(e.owner).name.split(' ')[0]):'Unassigned'}</div>
        </div>`).join('')||`<div style="padding:14px;text-align:center;font-size:11px;color:var(--ht)">Drop here</div>`}
      </div>
    </div>`;
  }).join('');
}
function chDragStart(id){ CH_DRAG_ID=id; }
async function chDrop(event,stage){
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if(!CH_DRAG_ID)return;
  const e=chEvents().find(x=>x.id===CH_DRAG_ID);
  CH_DRAG_ID=null;
  if(!e||e.planningStatus===stage)return;
  if(!chFull()||!isCurrentSemester(semesterLabelForDate(e.date))){toast('This event is in a past semester and is read-only.','error');return;}
  const prevStatus=e.planningStatus;
  e.planningStatus=stage;
  chRenderKanban();
  try{ await saveD('events'); renderRitual(); toast(e.title+' moved to '+chStatusLabel(stage),'success'); }
  catch(err){ e.planningStatus=prevStatus; chRenderKanban(); toast('Failed to save. Please try again.','error'); }
}

// ══════════════════════════════════════════════
// MEMBER-FACING RESTRICTED VIEW
// ══════════════════════════════════════════════
function chRenderMemberView(){
  const el=document.getElementById('ch-member-content');
  if(!el)return;
  const today=localDateStr();
  const nextStudy=[...chBibleStudies()].filter(s=>s.status==='planned'&&s.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const visibleEvents=[...chEvents()].filter(e=>CH_MEMBER_VISIBLE_EVENT_STATUSES.includes(e.planningStatus)).sort((a,b)=>a.date.localeCompare(b.date));

  el.innerHTML=`
    <div class="card" style="margin-bottom:11px">
      <div class="card-hd"><span class="card-t">Next Bible Study</span></div>
      ${nextStudy?`<div style="font-size:13px;font-weight:500">${esc(nextStudy.topic||'Bible Study')}</div><div style="font-size:11px;color:var(--mt)">${fds(nextStudy.date)}${nextStudy.time?' at '+esc(nextStudy.time):''}</div>`:es('ti-book-2','slate','Nothing scheduled yet','Check back soon for the next Bible study.','')}
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-t">Upcoming &amp; Recent Brotherhood Events</span></div>
      ${visibleEvents.length?visibleEvents.map(e=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bdr)">
        <div><div style="font-size:12px;font-weight:500">${esc(e.title)}</div><div style="font-size:10.5px;color:var(--ht)">${esc(chEventTypeLabel(e.chEventType))} · ${fds(e.date)}${e.location?' · '+esc(e.location):''}</div></div>
        <span class="badge ${chStatusClass(e.planningStatus)}">${chStatusLabel(e.planningStatus)}</span>
      </div>`).join(''):es('ti-users-group','slate','No events yet','Check back soon for brotherhood events.','')}
    </div>`;
}

// Ritual checklist (D.ritual.items) — the card/modal for this were removed from Chaplain Hub;
// the underlying data is left in place, unused, rather than deleted (same convention as other
// removed features this session — e.g. Dashboard's old Announcements card).

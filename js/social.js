// ══════════════════════════════════════════════
// SOCIAL EVENTS & FORMAL PLANNING
// ══════════════════════════════════════════════
// Events live in the shared D.events calendar (type:'social'), same pattern as Philanthropy/
// Community Service — so Social always matches what's on the Calendar, not a separate copy.
// Rich planning data (venue/transportation/budget/checklist/etc.) lives in D.social.planning,
// keyed by the same event id. RSVPs do NOT live in D.social — see the RSVP section below for why.

function canEditSocial(){ return canEditPage('social'); }
function socEvents(){ return (D.events||[]).filter(e=>e.type==='social'); }

// ── Semester scoping — events already carry a real date (date-range filter, no stamp needed);
// planning[eventId] follows the filtered event list by id lookup, no separate field needed.
// vendors[] is chapter-wide reference data (like Community Service's locations[]) and stays
// unpartitioned. Detail-workspace tabs (checklist/budget/formal/vendors) inherit the lock via
// the header's Edit/Delete buttons being disabled — see socRenderDetailOverview().
let SOC_SELECTED_SEM=null;
function socSem(){ return SOC_SELECTED_SEM||getSemester(); }
function socKnownSemesters(){
  return unionKnownSemesters(socEvents().map(e=>semesterLabelForDate(e.date)).filter(Boolean));
}
function socVisibleEvents(){
  return socEvents().filter(e=>semesterLabelForDate(e.date)===socSem());
}
function socSemesterChanged(){
  SOC_SELECTED_SEM=document.getElementById('soc-semester-select').value;
  socShowList();
}

const SOC_EVENT_CATEGORIES = [
  {v:'date_party',  l:'Date Party'},
  {v:'exchange',     l:'Exchange'},
  {v:'mixer',        l:'Mixer'},
  {v:'formal',       l:'Formal'},
  {v:'semi_formal',  l:'Semi-Formal'},
  {v:'brotherhood',  l:'Brotherhood Event'},
  {v:'other',        l:'Other'},
];
const SOC_STATUSES = [
  {v:'idea',        l:'Idea',        c:'bm2'},
  {v:'planning',    l:'Planning',    c:'ba2'},
  {v:'registered',  l:'Registered',  c:'bg2'},
];
function socStatusLabel(v){ return (SOC_STATUSES.find(s=>s.v===v)||{}).l || v; }
function socStatusClass(v){ return (SOC_STATUSES.find(s=>s.v===v)||{}).c || 'bm2'; }
function socCatLabel(v){ return (SOC_EVENT_CATEGORIES.find(c=>c.v===v)||{}).l || v; }
function socIsFormalCat(cat){ return cat==='formal'||cat==='semi_formal'; }

// General members only see events the Social Chair has actually opened up — not early-stage
// planning, which may still contain costs/vendor names not meant for the whole chapter yet.
const SOC_MEMBER_VISIBLE_STATUSES = ['registered'];

function socDefaultPlan(){
  return {
    status:'idea', eventCategory:'other',
    readinessOverrideNotes:'',
    venue:{name:'',address:'',contact:'',phone:'',deposit:0,totalCost:0,confirmed:false,contractStatus:'not_started',notes:''},
    transportation:{required:false,provider:'',contact:'',pickupLocation:'',departureTime:'',returnTime:'',vehicleCount:0,capacity:0,cost:0,confirmed:false,notes:''},
    lodging:{required:false,hotel:'',address:'',contact:'',roomCount:0,bookingStatus:'not_started',cost:0,notes:''},
    catering:{provider:'',contact:'',serviceType:'',cost:0,confirmed:false,dietaryNotes:''},
    entertainment:{provider:'',contact:'',cost:0,confirmed:false,equipmentNeeds:'',notes:''},
    security:{provider:'',contact:'',staffCount:0,cost:0,confirmed:false,notes:''},
    checklist:[], plannedBudget:0,
  };
}
// Always returns a fully-shaped plan (deep-merges saved data over the defaults) so a
// partially-saved or freshly-created event never crashes a render on a missing sub-object.
function socPlan(eventId){
  if(!D.social) D.social={planning:{},vendors:[]};
  if(!D.social.planning) D.social.planning={};
  const saved = D.social.planning[eventId]||{};
  const base = socDefaultPlan();
  const merged = {...base, ...saved};
  ['venue','transportation','lodging','catering','entertainment','security'].forEach(k=>{ merged[k]={...base[k],...(saved[k]||{})}; });
  merged.checklist = saved.checklist||[];
  return merged;
}
function socSetPlan(eventId, updater){
  if(!D.social) D.social={planning:{},vendors:[]};
  if(!D.social.planning) D.social.planning={};
  const cur = socPlan(eventId);
  D.social.planning[eventId] = updater(cur) || cur;
}

// ── READINESS SCORE ──
// Only counts checks that actually apply to this event (e.g. Transportation is excluded
// entirely, not penalized, if the event doesn't need it) — never a single opaque number
// without the list of what's actually missing.
function socReadiness(plan){
  const checks=[]; const missing=[];
  checks.push(plan.venue.confirmed?1:0); if(!plan.venue.confirmed) missing.push('Venue confirmation');
  const hasBudget = (parseFloat(plan.plannedBudget)||0)>0;
  checks.push(hasBudget?1:0); if(!hasBudget) missing.push('Planned budget set');
  if(plan.transportation.required){ checks.push(plan.transportation.confirmed?1:0); if(!plan.transportation.confirmed) missing.push('Transportation confirmation'); }
  if(plan.catering.provider){ checks.push(plan.catering.confirmed?1:0); if(!plan.catering.confirmed) missing.push('Catering confirmation'); }
  if(plan.checklist.length){
    const done=plan.checklist.filter(c=>c.done).length;
    checks.push(done/plan.checklist.length);
    if(done<plan.checklist.length) missing.push((plan.checklist.length-done)+' checklist item'+(plan.checklist.length-done!==1?'s':'')+' incomplete');
  }
  const score = checks.length ? Math.round(100*checks.reduce((a,b)=>a+b,0)/checks.length) : 0;
  return {score, missing};
}

// ── BUDGET TOTALS ──
function socBudgetTotals(plan){
  const est = parseFloat(plan.plannedBudget)||0;
  const actual = (D.finance?.expenses||[]).filter(e=>e.eventId===plan._eventId).reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  return {est, actual};
}

// ══════════════════════════════════════════════
// MAIN RENDER — branches by role
// ══════════════════════════════════════════════
let SOC_CURRENT_EVENT_ID = null;

function renderSocial(){
  const full = canEditSocial() || isLeadUser();
  const fullEl = document.getElementById('soc-full-view');
  const memberEl = document.getElementById('soc-member-view');
  if(fullEl) fullEl.style.display = full ? '' : 'none';
  if(memberEl) memberEl.style.display = full ? 'none' : '';
  if(full){
    socShowList();
  } else {
    socRenderMemberView();
  }
}

// ── LIST / OVERVIEW ──
function socShowList(){
  document.getElementById('soc-list-view').style.display='';
  document.getElementById('soc-detail-view').style.display='none';
  initSemesterSelect('soc-semester-select',socKnownSemesters(),socSemesterChanged,socSem());
  const addBtn=document.getElementById('soc-add-event-btn');
  if(addBtn)addBtn.style.display=(canEditSocial()&&isCurrentSemester(socSem()))?'':'none';
  socRenderKpis();
  socRenderAlerts();
  socRenderEventList();
  socRenderVendorsTable();
}

function socRenderKpis(){
  const events = socVisibleEvents();
  const now = localDateStr();
  const upcoming = events.filter(e=>e.date>=now);
  const thisTermCount = events.length; // "this term" = the selected semester's social events
  let totalBudget=0, totalRemaining=0, needsAction=0;
  events.forEach(e=>{
    const plan = socPlan(e.id); plan._eventId=e.id;
    const tot = socBudgetTotals(plan);
    totalBudget += tot.est;
    totalRemaining += Math.max(0, tot.est - tot.actual);
    const r = socReadiness(plan);
    if(e.date>=now && r.missing.length) needsAction++;
  });
  document.getElementById('soc-kpi').innerHTML =
    statStrip('Upcoming Events', upcoming.length, 'On the calendar', 'neutral') +
    statStrip('Events This Term', thisTermCount, 'All social events', 'neutral') +
    statStrip('Total Planned Budget', '$'+Math.round(totalBudget).toLocaleString(), 'Across all events', 'neutral') +
    statStrip('Budget Remaining', '$'+Math.round(totalRemaining).toLocaleString(), 'Not yet spent', totalRemaining<0?'down':'neutral') +
    statStrip('Needs Action', needsAction, needsAction?'Missing required planning items':'All caught up', needsAction?'down':'up');
}

function socRenderAlerts(){
  const el = document.getElementById('soc-alerts'); if(!el) return;
  const now = localDateStr();
  const alerts = [];
  socVisibleEvents().forEach(e=>{
    if(e.date<now) return;
    const plan = socPlan(e.id); plan._eventId=e.id;
    if(!plan.venue.name) alerts.push({e,plan,text:'Venue not selected',icon:'ti-map-pin'});
    else if(!plan.venue.confirmed) alerts.push({e,plan,text:'Venue not confirmed',icon:'ti-map-pin'});
    if(plan.transportation.required && !plan.transportation.confirmed) alerts.push({e,plan,text:'Transportation not confirmed',icon:'ti-bus'});
    const tot = socBudgetTotals(plan);
    if(tot.actual > tot.est && tot.est>0) alerts.push({e,plan,text:'Budget exceeded',icon:'ti-alert-triangle'});
    if(plan.checklist.length){ const undone=plan.checklist.filter(c=>!c.done).length; if(undone && e.date<=localDateStr(new Date(Date.now()+7*86400000))) alerts.push({e,plan,text:undone+' checklist item'+(undone!==1?'s':'')+' incomplete, event is soon',icon:'ti-list-check'}); }
  });
  if(!alerts.length){ el.innerHTML = es('ti-circle-check','green','No planning alerts','Every upcoming event is on track.',''); return; }
  el.innerHTML = alerts.slice(0,8).map(a=>`<div class="al-row"><div class="al-ic" style="background:var(--am-bg);color:var(--am-tx)"><i class="ti ${a.icon}"></i></div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500">${esc(a.e.title)}</div><div style="font-size:11px;color:var(--mt)">${esc(a.text)}</div></div><button class="btn" style="height:24px;font-size:10.5px" onclick="socOpenDetail('${a.e.id}')">View</button></div>`).join('');
}

function socRenderEventList(){
  const el = document.getElementById('soc-events-table'); if(!el) return;
  const canEdit = (canEditSocial() || isLeadUser()) && isCurrentSemester(socSem());
  const events = [...socVisibleEvents()].sort((a,b)=>a.date.localeCompare(b.date));
  const mobEl = document.getElementById('soc-events-mobile-cards');
  if(!events.length){
    el.innerHTML = `<tbody><tr><td colspan="7">${es('ti-confetti','slate','No social events yet','Add a date party, mixer, or formal to start planning.', canEdit?`<button class="btn btn-p" onclick="socOpenAddEvent()"><i class="ti ti-plus"></i>Add Event</button>`:'')}</td></tr></tbody>`;
    if(mobEl)mobEl.innerHTML = `<div style="grid-column:1/-1">${es('ti-confetti','slate','No social events yet','Add a date party, mixer, or formal to start planning.', canEdit?`<button class="btn btn-p" onclick="socOpenAddEvent()"><i class="ti ti-plus"></i>Add Event</button>`:'')}</div>`;
    return;
  }
  el.innerHTML = `<thead><tr><th>Event</th><th>Type</th><th>Date</th><th>Location</th><th>Status</th><th>Budget</th><th>Readiness</th></tr></thead><tbody>${
    events.map(e=>{
      const plan=socPlan(e.id); plan._eventId=e.id;
      const r = socReadiness(plan);
      const tot = socBudgetTotals(plan);
      return `<tr style="cursor:pointer" onclick="socOpenDetail('${e.id}')">
        <td style="font-weight:500">${esc(e.title)}</td>
        <td style="color:var(--mt)">${socCatLabel(plan.eventCategory)}</td>
        <td>${fds(e.date)}</td>
        <td style="color:var(--mt)">${esc(e.location)||'—'}</td>
        <td><span class="badge ${socStatusClass(plan.status)}">${socStatusLabel(plan.status)}</span></td>
        <td style="color:var(--mt)">$${Math.round(tot.actual).toLocaleString()} / $${Math.round(tot.est).toLocaleString()}</td>
        <td><div style="display:flex;align-items:center;gap:6px"><div class="pb" style="width:50px;height:5px"><div class="pf" style="width:${r.score}%;background:${pgc(r.score)}"></div></div><span style="font-size:10.5px;color:var(--mt)">${r.score}%</span></div></td>
      </tr>`;
    }).join('')
  }</tbody>`;
  if(mobEl)mobEl.innerHTML = events.map(e=>{
    const plan=socPlan(e.id); plan._eventId=e.id;
    const r = socReadiness(plan);
    const tot = socBudgetTotals(plan);
    return `<div class="mob-card card clickable" tabindex="0" role="button" aria-label="Open ${esc(e.title)}" onclick="socOpenDetail('${e.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="font-weight:600;font-size:13px">${esc(e.title)}</div>
        <span class="badge ${socStatusClass(plan.status)}" style="flex-shrink:0">${socStatusLabel(plan.status)}</span>
      </div>
      <div style="font-size:11px;color:var(--mt);margin-bottom:8px">${socCatLabel(plan.eventCategory)} · ${fds(e.date)}${e.location?' · '+esc(e.location):''}</div>
      <div style="font-size:11.5px;color:var(--mt);margin-bottom:8px">Budget: $${Math.round(tot.actual).toLocaleString()} / $${Math.round(tot.est).toLocaleString()}</div>
      <div style="display:flex;align-items:center;gap:6px"><div class="pb" style="flex:1;height:5px"><div class="pf" style="width:${r.score}%;background:${pgc(r.score)}"></div></div><span style="font-size:10.5px;color:var(--mt);flex-shrink:0">${r.score}% ready</span></div>
    </div>`;
  }).join('');
}

// ── EVENT CREATE / EDIT ──
function socOpenAddEvent(){
  if(!canEditSocial()){toast('Only officers with Social Events access can add events.','error');return;}
  if(!isCurrentSemester(socSem())){toast('This semester is read-only.','error');return;}
  ['soc-ev-title','soc-ev-date','soc-ev-start','soc-ev-location'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('soc-ev-cat').value='mixer';
  document.getElementById('soc-ev-id').value='';
  document.getElementById('m-soc-addevent').querySelector('.md-t').childNodes[0].textContent='New Social Event';
  openM('m-soc-addevent');
}
function socOpenEditEventBasic(id){
  if(!canEditSocial()){toast('Only officers with Social Events access can edit events.','error');return;}
  const e = D.events.find(x=>x.id===id); if(!e) return;
  if(!isCurrentSemester(semesterLabelForDate(e.date))){toast('This event is in a past semester and is read-only.','error');return;}
  const plan = socPlan(id);
  document.getElementById('soc-ev-title').value=e.title;
  document.getElementById('soc-ev-date').value=e.date;
  document.getElementById('soc-ev-start').value=e.start||'';
  document.getElementById('soc-ev-location').value=e.location||'';
  document.getElementById('soc-ev-cat').value=plan.eventCategory;
  document.getElementById('soc-ev-id').value=id;
  document.getElementById('m-soc-addevent').querySelector('.md-t').childNodes[0].textContent='Edit Social Event';
  openM('m-soc-addevent');
}
async function socSaveEvent(){
  if(!canEditSocial())return;
  const title=document.getElementById('soc-ev-title').value.trim();
  if(!title){toast('Event name is required','error');return;}
  const date=document.getElementById('soc-ev-date').value;
  if(!date){toast('Date is required','error');return;}
  const editId=document.getElementById('soc-ev-id').value;
  const cat=document.getElementById('soc-ev-cat').value;
  const fields={title,date,start:document.getElementById('soc-ev-start').value,location:document.getElementById('soc-ev-location').value.trim()};
  let ev, isNew=false;
  if(editId){
    ev=D.events.find(x=>x.id===editId);
    if(ev){
      if(!isCurrentSemester(semesterLabelForDate(ev.date))){toast('This event is in a past semester and is read-only.','error');return;}
      Object.assign(ev,fields);
    }
  } else {
    if(!isCurrentSemester(socSem())){toast('This semester is read-only.','error');return;}
    isNew=true;
    ev={id:uid(),type:'social',mandatory:false,...fields};
    D.events.push(ev);
  }
  socSetPlan(ev.id, p=>({...p, eventCategory:cat}));
  try{
    await saveD('events','social');
    closeM(null,document.getElementById('m-soc-addevent'));
    if(typeof renderCalendar==='function') renderCalendar();
    socShowList();
    toast(isNew?'Event added':'Event updated','success');
  }catch(err){
    if(isNew) D.events=D.events.filter(x=>x.id!==ev.id);
    toast('Failed to save event. Please try again.','error');
  }
}
async function socDeleteEvent(id){
  if(!canEditSocial()&&!isLeadUser())return;
  const evToDelete = D.events.find(e=>e.id===id);
  if(evToDelete&&!isCurrentSemester(semesterLabelForDate(evToDelete.date))){toast('This event is in a past semester and is read-only.','error');return;}
  const ok = await confirmDialog('Delete Social Event','Delete this event and all of its planning data (venue, budget, checklist, vendor associations)? This cannot be undone.');
  if(!ok) return;
  const ev = D.events.find(e=>e.id===id);
  const removedPlan = D.social?.planning?.[id];
  D.events = D.events.filter(e=>e.id!==id);
  if(D.social?.planning) delete D.social.planning[id];
  try{
    await saveD('events','social');
    socShowList();
    if(typeof renderCalendar==='function') renderCalendar();
    toast('Event deleted','info');
  }catch(err){
    if(ev) D.events.push(ev);
    if(removedPlan){ if(!D.social.planning) D.social.planning={}; D.social.planning[id]=removedPlan; }
    toast('Failed to delete event. Please try again.','error');
  }
}

// ══════════════════════════════════════════════
// EVENT DETAIL WORKSPACE
// ══════════════════════════════════════════════
let SOC_ACTIVE_TAB = 'soc-overview';

function socOpenDetail(eventId){
  SOC_CURRENT_EVENT_ID = eventId;
  document.getElementById('soc-list-view').style.display='none';
  document.getElementById('soc-detail-view').style.display='';
  document.querySelectorAll('.soc-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  const plan = socPlan(eventId);
  const formalTab = document.getElementById('soc-tab-formal');
  if(formalTab) formalTab.style.display = socIsFormalCat(plan.eventCategory) ? '' : 'none';
  socTab(document.querySelector('.soc-tab'), 'soc-overview');
}
function socBackToList(){ SOC_CURRENT_EVENT_ID=null; socShowList(); }
function socTab(btn, tabId){
  document.querySelectorAll('.soc-tab').forEach(t=>t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('#soc-detail-view > .soc-panel').forEach(p=>{p.style.display = p.id===tabId ? '' : 'none';});
  SOC_ACTIVE_TAB = tabId;
  const id = SOC_CURRENT_EVENT_ID; if(!id) return;
  if(tabId==='soc-overview') socRenderDetailOverview();
  else if(tabId==='soc-checklist') socRenderChecklist();
  else if(tabId==='soc-budget') socRenderBudget();
  else if(tabId==='soc-vendors') socRenderEventVendors();
  else if(tabId==='soc-formal') socRenderFormal();
}

function socRenderDetailOverview(){
  const id = SOC_CURRENT_EVENT_ID; const e = D.events.find(x=>x.id===id); if(!e) return;
  const plan = socPlan(id); plan._eventId=id;
  const canEdit = (canEditSocial()||isLeadUser())&&isCurrentSemester(semesterLabelForDate(e.date));
  const r = socReadiness(plan);
  const days = Math.round((new Date(e.date+'T12:00:00')-new Date())/86400000);
  document.getElementById('soc-detail-title').textContent = e.title;
  document.getElementById('soc-detail-sub').textContent = `${socCatLabel(plan.eventCategory)} · ${fds(e.date)}${e.location?' · '+e.location:''}`;
  document.getElementById('soc-detail-edit-btn').style.display = canEdit?'':'none';
  const delBtn=document.getElementById('soc-detail-delete-btn'); if(delBtn)delBtn.style.display = canEdit?'':'none';
  document.getElementById('soc-overview').innerHTML = `
    <div class="d2-stats" style="margin-bottom:13px">
      ${statStrip('Countdown', days>=0?days+' day'+(days!==1?'s':''):'Past', days>=0?'Until event':'Event date has passed', 'neutral')}
      ${statStrip('Readiness', r.score+'%', r.missing.length?r.missing.length+' item(s) missing':'Fully ready', r.score>=80?'up':r.score>=50?'neutral':'down')}
      ${statStrip('Status', socStatusLabel(plan.status), 'Current planning stage', 'neutral')}
    </div>
    ${r.missing.length?`<div class="bnr warn" style="margin-bottom:13px"><i class="ti ti-alert-triangle" style="font-size:13px"></i><div><strong>Missing to be fully ready:</strong> ${r.missing.map(esc).join(', ')}</div></div>`:''}
    <div class="card" style="margin-bottom:13px">
      <div class="card-hd"><span class="card-t">Status</span></div>
      <div class="fr">
        <div class="fld"><label>Status</label><select id="soc-ov-status" ${canEdit?'':'disabled'} onchange="socUpdateStatus()">${SOC_STATUSES.map(s=>`<option value="${s.v}"${plan.status===s.v?' selected':''}>${s.l}</option>`).join('')}</select></div>
      </div>
    </div>`;
}
async function socUpdateStatus(){
  if(!(canEditSocial()||isLeadUser()))return;
  const v=document.getElementById('soc-ov-status').value;
  await socUpdateOverviewField('status',v);
}
async function socUpdateOverviewField(field,val){
  if(!(canEditSocial()||isLeadUser()))return;
  const id=SOC_CURRENT_EVENT_ID; const prev=socPlan(id)[field];
  socSetPlan(id,p=>({...p,[field]:val}));
  try{ await saveD('social'); socRenderDetailOverview(); socRenderEventList(); }
  catch(e){ socSetPlan(id,p=>({...p,[field]:prev})); toast('Failed to save. Please try again.','error'); }
}

// ── CHECKLIST ──
function socRenderChecklist(){
  const id=SOC_CURRENT_EVENT_ID; const plan=socPlan(id); const canEdit=canEditSocial()||isLeadUser();
  const el=document.getElementById('soc-checklist-list'); if(!el) return;
  const addRow = canEdit?`<div class="fr c3" style="margin-bottom:11px">
      <div class="fld"><label>New item</label><input id="soc-cl-label" placeholder="e.g. Venue contract signed"></div>
      <div class="fld"><label>Assigned to</label><select id="soc-cl-assignee"><option value="">— Unassigned —</option>${mOpts()}</select></div>
      <div class="fld"><label>Due date</label><input id="soc-cl-due" type="date"></div>
    </div>
    <div style="display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap"><label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--mt)"><input type="checkbox" id="soc-cl-linktask"> Also create a linked task</label><button class="btn btn-p" style="margin-left:auto" onclick="socAddChecklistItem()"><i class="ti ti-plus"></i>Add Item</button></div>`:'';
  if(!plan.checklist.length){
    el.innerHTML = addRow + es('ti-list-check','blue','No checklist items yet','Break planning into trackable steps.','');
    return;
  }
  const done=plan.checklist.filter(c=>c.done).length;
  el.innerHTML = addRow + `<div style="font-size:11px;color:var(--mt);margin-bottom:8px">${done}/${plan.checklist.length} complete</div>` + plan.checklist.map(c=>`
    <div class="tk-row">
      <div class="tc ${c.done?'done':''}" style="cursor:${canEdit?'pointer':'default'}" ${canEdit?`onclick="socToggleChecklistItem('${c.id}')"`:''}>${c.done?'<i class="ti ti-check" style="font-size:9px"></i>':''}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;${c.done?'text-decoration:line-through;color:var(--ht)':''}">${esc(c.label)}${c.linkedTaskId?' <i class="ti ti-link" title="Linked to a task" style="font-size:10px;color:var(--sky-tx)"></i>':''}</div>
        <div style="font-size:10.5px;color:var(--ht)">${c.assignedTo?esc(mB(c.assignedTo).name):'Unassigned'}${c.dueDate?' · Due '+fds(c.dueDate):''}</div>
      </div>
      ${canEdit?`<button class="ib" style="width:22px;height:22px;font-size:11px;color:var(--rd)" onclick="socDeleteChecklistItem('${c.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`:''}
    </div>`).join('');
}
async function socAddChecklistItem(){
  if(!(canEditSocial()||isLeadUser()))return;
  const label=document.getElementById('soc-cl-label').value.trim();
  if(!label){toast('Item description is required','error');return;}
  const assignedTo=document.getElementById('soc-cl-assignee').value;
  const dueDate=document.getElementById('soc-cl-due').value;
  const linkTask=document.getElementById('soc-cl-linktask').checked;
  const id=SOC_CURRENT_EVENT_ID;
  let linkedTaskId=null;
  if(linkTask && typeof D.tasks!=='undefined'){
    const task={id:uid(),title:label,assignedTo,priority:'medium',status:'todo',dueDate,desc:'Linked to social event checklist.'};
    D.tasks.push(task); linkedTaskId=task.id;
  }
  const item={id:uid(),label,assignedTo,dueDate,done:false,linkedTaskId};
  socSetPlan(id,p=>({...p,checklist:[...p.checklist,item]}));
  try{
    await (linkTask?saveD('social','tasks'):saveD('social'));
    document.getElementById('soc-cl-label').value='';
    socRenderChecklist();
    if(typeof renderDash==='function') renderDash();
    toast('Checklist item added'+(linkTask?' with linked task':''),'success');
  }catch(e){
    socSetPlan(id,p=>({...p,checklist:p.checklist.filter(c=>c.id!==item.id)}));
    if(linkedTaskId) D.tasks=D.tasks.filter(t=>t.id!==linkedTaskId);
    toast('Failed to add item. Please try again.','error');
  }
}
async function socToggleChecklistItem(itemId){
  if(!(canEditSocial()||isLeadUser()))return;
  const id=SOC_CURRENT_EVENT_ID; const plan=socPlan(id);
  const item=plan.checklist.find(c=>c.id===itemId); if(!item) return;
  const newDone=!item.done;
  socSetPlan(id,p=>({...p,checklist:p.checklist.map(c=>c.id===itemId?{...c,done:newDone}:c)}));
  // If linked to a task, keep the task's status in sync as a convenience (one-way, not a live subscription)
  if(item.linkedTaskId){ const t=D.tasks.find(x=>x.id===item.linkedTaskId); if(t) t.status = newDone?'done':'todo'; }
  try{ await (item.linkedTaskId?saveD('social','tasks'):saveD('social')); socRenderChecklist(); socRenderDetailOverview(); }
  catch(e){ socSetPlan(id,p=>({...p,checklist:p.checklist.map(c=>c.id===itemId?{...c,done:!newDone}:c)})); toast('Failed to update. Please try again.','error'); }
}
async function socDeleteChecklistItem(itemId){
  if(!(canEditSocial()||isLeadUser()))return;
  const id=SOC_CURRENT_EVENT_ID; const plan=socPlan(id);
  const removed=plan.checklist.find(c=>c.id===itemId);
  socSetPlan(id,p=>({...p,checklist:p.checklist.filter(c=>c.id!==itemId)}));
  try{ await saveD('social'); socRenderChecklist(); }
  catch(e){ if(removed) socSetPlan(id,p=>({...p,checklist:[...p.checklist,removed]})); toast('Failed to remove item. Please try again.','error'); }
}

// ── BUDGET — kept deliberately simple: one planned-budget number for the whole event, plus a
// log of what was actually spent (each logged expense also lands in Finance under the
// 'Events Social' category, tagged with this event's id, so the two books never disagree). ──
function socRenderBudget(){
  const id=SOC_CURRENT_EVENT_ID; const plan=socPlan(id); plan._eventId=id; const canEdit=canEditSocial()||isLeadUser();
  const el=document.getElementById('soc-budget-body'); if(!el) return;
  const tot=socBudgetTotals(plan);
  const remaining=tot.est-tot.actual;
  const kpiHtml = `<div class="d2-stats" style="margin-bottom:13px">
    ${statStrip('Budget Remaining','$'+Math.round(remaining).toLocaleString(),remaining<0?'Over budget':'Left to spend',remaining<0?'down':'up')}
    ${statStrip('Planned Budget','$'+Math.round(tot.est).toLocaleString(),'Total estimate','neutral')}
    ${statStrip('Actual Spend','$'+Math.round(tot.actual).toLocaleString(),'From logged expenses','neutral')}
  </div>`;
  const plannedField = `<div class="fr" style="margin-bottom:13px"><div class="fld"><label>Planned Budget</label><input id="soc-bg-planned" type="number" min="0" step="0.01" value="${plan.plannedBudget||0}" ${canEdit?'':'disabled'} onchange="socUpdatePlannedBudget(this.value)"></div></div>`;
  const expenses=(D.finance?.expenses||[]).filter(e=>e.eventId===id).sort((a,b)=>b.date.localeCompare(a.date));
  const expTable = expenses.length ? `<div class="tw"><table class="tbl"><thead><tr><th>Date</th><th>Description</th><th>Amount</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    expenses.map(e=>`<tr><td>${fds(e.date)}</td><td style="font-weight:500">${esc(e.desc)}</td><td>$${(+e.amount||0).toLocaleString()}</td>${canEdit?`<td><button class="ib" style="width:22px;height:22px;font-size:11px;color:var(--rd)" onclick="socDeleteExpense('${e.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`).join('')
  }</tbody></table></div>` : es('ti-receipt','amber','No expenses logged yet','Log what this event actually costs as you spend.','');
  el.innerHTML = kpiHtml + plannedField + (canEdit?`<button class="btn btn-p" style="margin-bottom:14px" onclick="socOpenLogExpense()"><i class="ti ti-receipt"></i>Log Expense</button>`:'') + expTable;
}
async function socUpdatePlannedBudget(value){
  if(!(canEditSocial()||isLeadUser()))return;
  const id=SOC_CURRENT_EVENT_ID; const prev=socPlan(id).plannedBudget;
  const val=value===''?0:parseFloat(value)||0;
  socSetPlan(id,p=>({...p,plannedBudget:val}));
  try{ await saveD('social'); socRenderBudget(); socRenderEventList(); }
  catch(e){ socSetPlan(id,p=>({...p,plannedBudget:prev})); toast('Failed to save. Please try again.','error'); socRenderBudget(); }
}
async function socDeleteExpense(expId){
  if(!(canEditSocial()||isLeadUser()))return;
  const ok=await confirmDialog('Delete Expense','Remove this logged expense? This also removes it from Finance.');
  if(!ok)return;
  const idx=(D.finance?.expenses||[]).findIndex(e=>e.id===expId);
  if(idx<0)return;
  const removed=D.finance.expenses[idx];
  D.finance.expenses=D.finance.expenses.filter(e=>e.id!==expId);
  try{ await saveFinanceLedger(); socRenderBudget(); socRenderEventList(); toast('Expense deleted','info'); }
  catch(e){ D.finance.expenses.splice(idx,0,removed); toast('Failed to delete expense. Please try again.','error'); }
}
// Bridges to Finance: logs a real, dated expense under the existing 'Events Social' category,
// tagged with this event's id so socBudgetTotals() can show real confirmed spend. Does not
// touch finance.js's own modal — this is a lightweight equivalent scoped to Social.
function socOpenLogExpense(){
  if(!(canEditSocial()||isLeadUser())){toast('You do not have permission to log expenses.','error');return;}
  document.getElementById('soc-exp-desc').value='';
  document.getElementById('soc-exp-amount').value='';
  document.getElementById('soc-exp-date').value=localDateStr();
  const sel=document.getElementById('soc-exp-officer');
  sel.innerHTML=D.members.filter(m=>m.role!=='Member').map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('');
  if(CURRENT_USER?.mid) sel.value=CURRENT_USER.mid;
  openM('m-soc-logexpense');
}
async function socLogExpenseToFinance(){
  if(!(canEditSocial()||isLeadUser()))return;
  const amount=parseFloat(document.getElementById('soc-exp-amount').value);
  const desc=document.getElementById('soc-exp-desc').value.trim();
  if(!amount||amount<=0||!desc){toast('Description and a valid amount are required','error');return;}
  if(!D.finance) D.finance={expenses:[]}; if(!D.finance.expenses) D.finance.expenses=[];
  const expense={id:'ex'+uid(),category:'Events Social',desc,amount,officer:document.getElementById('soc-exp-officer').value,date:document.getElementById('soc-exp-date').value||localDateStr(),eventId:SOC_CURRENT_EVENT_ID};
  D.finance.expenses.unshift(expense);
  try{
    await saveFinanceLedger();
    closeM(null,document.getElementById('m-soc-logexpense'));
    socRenderBudget();
    socRenderEventList();
    toast('Expense of $'+amount+' logged to Finance','success');
  }catch(e){
    D.finance.expenses=D.finance.expenses.filter(x=>x.id!==expense.id);
    toast('Failed to log expense. Please try again.','error');
  }
}

// ── VENDORS (chapter-wide directory, associated to events) ──
function socRenderVendorsTable(){
  const el=document.getElementById('soc-vendors-table'); if(!el) return;
  const canEdit=canEditSocial()||isLeadUser();
  const vendors=D.social?.vendors||[];
  if(!vendors.length){ el.innerHTML=`<tbody><tr><td colspan="4">${es('ti-truck-delivery','blue','No vendors yet','Track venues, transportation providers, caterers, and other vendors here.',canEdit?`<button class="btn btn-p" onclick="socOpenAddVendor()"><i class="ti ti-plus"></i>Add Vendor</button>`:'')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Name</th><th>Type</th><th>Contact</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    vendors.map(v=>`<tr><td style="font-weight:500">${esc(v.name)}</td><td style="color:var(--mt)">${esc((SOC_EVENT_CATEGORIES.find(c=>c.v===v.type)||{}).l||v.type)}</td><td style="color:var(--mt)">${esc(v.contactName)||'—'}${v.phone?' · '+esc(v.phone):''}</td>${canEdit?`<td><button class="ib" style="width:22px;height:22px;font-size:11px;color:var(--rd)" onclick="socDeleteVendor('${v.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`).join('')
  }</tbody>`;
}
function socOpenAddVendor(){
  if(!(canEditSocial()||isLeadUser())){toast('Only officers with Social Events access can add vendors.','error');return;}
  ['soc-vd-name','soc-vd-contact','soc-vd-phone','soc-vd-email','soc-vd-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openM('m-soc-addvendor');
}
async function socAddVendor(){
  if(!(canEditSocial()||isLeadUser()))return;
  const name=document.getElementById('soc-vd-name').value.trim();
  if(!name){toast('Vendor name is required','error');return;}
  const vendor={id:uid(),name,type:document.getElementById('soc-vd-type').value,contactName:document.getElementById('soc-vd-contact').value.trim(),phone:document.getElementById('soc-vd-phone').value.trim(),email:document.getElementById('soc-vd-email').value.trim(),notes:document.getElementById('soc-vd-notes').value.trim(),associatedEventIds:[]};
  if(!D.social) D.social={planning:{},vendors:[]}; if(!D.social.vendors) D.social.vendors=[];
  D.social.vendors.push(vendor);
  try{ await saveD('social'); closeM(null,document.getElementById('m-soc-addvendor')); socRenderVendorsTable(); if(SOC_CURRENT_EVENT_ID) socRenderEventVendors(); toast('Vendor added','success'); }
  catch(e){ D.social.vendors=D.social.vendors.filter(v=>v.id!==vendor.id); toast('Failed to add vendor. Please try again.','error'); }
}
async function socDeleteVendor(id){
  if(!(canEditSocial()||isLeadUser()))return;
  const ok=await confirmDialog('Remove Vendor','Remove this vendor from the directory?'); if(!ok) return;
  const removed=D.social.vendors.find(v=>v.id===id);
  D.social.vendors=D.social.vendors.filter(v=>v.id!==id);
  try{ await saveD('social'); socRenderVendorsTable(); if(SOC_CURRENT_EVENT_ID) socRenderEventVendors(); toast('Vendor removed','info'); }
  catch(e){ if(removed) D.social.vendors.push(removed); toast('Failed to remove vendor. Please try again.','error'); }
}
function socRenderEventVendors(){
  const id=SOC_CURRENT_EVENT_ID; const canEdit=canEditSocial()||isLeadUser();
  const el=document.getElementById('soc-event-vendors'); if(!el) return;
  const vendors=D.social?.vendors||[];
  if(!vendors.length){ el.innerHTML=es('ti-truck-delivery','blue','No vendors in the directory yet','Add vendors from the main Social Events list, then associate them here.',''); return; }
  el.innerHTML = vendors.map(v=>{
    const assoc = (v.associatedEventIds||[]).includes(id);
    return `<div class="sh-row"><div class="sh-av" style="width:28px;height:28px;font-size:9.5px">${esc(v.name.slice(0,2).toUpperCase())}</div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500">${esc(v.name)}</div><div style="font-size:10.5px;color:var(--ht)">${esc((SOC_EVENT_CATEGORIES.find(c=>c.v===v.type)||{}).l||v.type)}</div></div>${canEdit?`<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mt)"><input type="checkbox" ${assoc?'checked':''} onchange="socToggleVendorAssoc('${v.id}')"> For this event</label>`:(assoc?'<span class="badge bb2">Booked</span>':'')}</div>`;
  }).join('');
}
async function socToggleVendorAssoc(vendorId){
  if(!(canEditSocial()||isLeadUser()))return;
  const eventId=SOC_CURRENT_EVENT_ID;
  const v=D.social.vendors.find(x=>x.id===vendorId); if(!v) return;
  if(!v.associatedEventIds) v.associatedEventIds=[];
  const has=v.associatedEventIds.includes(eventId);
  v.associatedEventIds = has ? v.associatedEventIds.filter(id=>id!==eventId) : [...v.associatedEventIds,eventId];
  try{ await saveD('social'); }
  catch(e){ v.associatedEventIds = has ? [...v.associatedEventIds,eventId] : v.associatedEventIds.filter(id=>id!==eventId); toast('Failed to update. Please try again.','error'); }
}

// ── FORMAL PLANNING (venue/transportation/lodging/catering/entertainment/security) ──
function socRenderFormal(){
  const id=SOC_CURRENT_EVENT_ID; const plan=socPlan(id); const canEdit=canEditSocial()||isLeadUser();
  const el=document.getElementById('soc-formal-body'); if(!el) return;
  const dis = canEdit?'':'disabled';
  el.innerHTML = `
    <div class="card" style="margin-bottom:11px"><div class="card-hd"><span class="card-t">Venue</span></div>
      <div class="fr c2"><div class="fld"><label>Venue Name</label><input id="soc-f-venue-name" ${dis} value="${esc(plan.venue.name)}"></div><div class="fld"><label>Contact</label><input id="soc-f-venue-contact" ${dis} value="${esc(plan.venue.contact)}"></div></div>
      <div class="fr c2"><div class="fld"><label>Address</label><input id="soc-f-venue-address" ${dis} value="${esc(plan.venue.address)}"></div><div class="fld"><label>Phone</label><input id="soc-f-venue-phone" ${dis} value="${esc(plan.venue.phone)}"></div></div>
      <div class="fr c3">
        <div class="fld"><label>Deposit</label><input id="soc-f-venue-deposit" type="number" min="0" step="0.01" ${dis} value="${plan.venue.deposit||0}"></div>
        <div class="fld"><label>Total Cost</label><input id="soc-f-venue-total" type="number" min="0" step="0.01" ${dis} value="${plan.venue.totalCost||0}"></div>
        <div class="fld"><label>Contract Status</label><select id="soc-f-venue-contract" ${dis}><option value="not_started"${plan.venue.contractStatus==='not_started'?' selected':''}>Not Started</option><option value="sent"${plan.venue.contractStatus==='sent'?' selected':''}>Sent</option><option value="signed"${plan.venue.contractStatus==='signed'?' selected':''}>Signed</option></select></div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:6px 0"><input type="checkbox" id="soc-f-venue-confirmed" ${dis} ${plan.venue.confirmed?'checked':''}> Venue confirmed</label>
      <div class="fld"><label>Notes</label><textarea id="soc-f-venue-notes" ${dis} style="height:60px">${esc(plan.venue.notes)}</textarea></div>
      ${canEdit?`<button class="btn btn-p" style="margin-top:8px" onclick="socSaveFormalSection('venue')">Save Venue</button>`:''}
    </div>
    <div class="card" style="margin-bottom:11px"><div class="card-hd"><span class="card-t">Transportation</span></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:8px"><input type="checkbox" id="soc-f-trans-required" ${dis} ${plan.transportation.required?'checked':''}> Transportation required for this event</label>
      <div class="fr c2"><div class="fld"><label>Provider</label><input id="soc-f-trans-provider" ${dis} value="${esc(plan.transportation.provider)}"></div><div class="fld"><label>Contact</label><input id="soc-f-trans-contact" ${dis} value="${esc(plan.transportation.contact)}"></div></div>
      <div class="fr c2"><div class="fld"><label>Pickup Location</label><input id="soc-f-trans-pickup" ${dis} value="${esc(plan.transportation.pickupLocation)}"></div><div class="fld"><label>Cost</label><input id="soc-f-trans-cost" type="number" min="0" step="0.01" ${dis} value="${plan.transportation.cost||0}"></div></div>
      <div class="fr c3">
        <div class="fld"><label>Departure Time</label><input id="soc-f-trans-depart" type="time" ${dis} value="${plan.transportation.departureTime||''}"></div>
        <div class="fld"><label>Return Time</label><input id="soc-f-trans-return" type="time" ${dis} value="${plan.transportation.returnTime||''}"></div>
        <div class="fld"><label>Vehicles / Capacity</label><div style="display:flex;gap:6px;flex-wrap:wrap"><input id="soc-f-trans-vcount" type="number" min="0" placeholder="Vehicles" ${dis} value="${plan.transportation.vehicleCount||0}" style="flex:1;min-width:80px"><input id="soc-f-trans-vcap" type="number" min="0" placeholder="Capacity" ${dis} value="${plan.transportation.capacity||0}" style="flex:1;min-width:80px"></div></div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:6px 0"><input type="checkbox" id="soc-f-trans-confirmed" ${dis} ${plan.transportation.confirmed?'checked':''}> Transportation confirmed</label>
      <div class="fld"><label>Notes</label><textarea id="soc-f-trans-notes" ${dis} style="height:50px">${esc(plan.transportation.notes)}</textarea></div>
      ${canEdit?`<button class="btn btn-p" style="margin-top:8px" onclick="socSaveFormalSection('transportation')">Save Transportation</button>`:''}
    </div>
    <div class="card" style="margin-bottom:11px"><div class="card-hd"><span class="card-t">Lodging</span></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:8px"><input type="checkbox" id="soc-f-lodge-required" ${dis} ${plan.lodging.required?'checked':''}> Lodging required for this event</label>
      <div class="fr c2"><div class="fld"><label>Hotel</label><input id="soc-f-lodge-hotel" ${dis} value="${esc(plan.lodging.hotel)}"></div><div class="fld"><label>Contact</label><input id="soc-f-lodge-contact" ${dis} value="${esc(plan.lodging.contact)}"></div></div>
      <div class="fr c3">
        <div class="fld"><label>Room Count</label><input id="soc-f-lodge-rooms" type="number" min="0" ${dis} value="${plan.lodging.roomCount||0}"></div>
        <div class="fld"><label>Cost</label><input id="soc-f-lodge-cost" type="number" min="0" step="0.01" ${dis} value="${plan.lodging.cost||0}"></div>
        <div class="fld"><label>Booking Status</label><select id="soc-f-lodge-status" ${dis}><option value="not_started"${plan.lodging.bookingStatus==='not_started'?' selected':''}>Not Started</option><option value="booked"${plan.lodging.bookingStatus==='booked'?' selected':''}>Booked</option><option value="paid"${plan.lodging.bookingStatus==='paid'?' selected':''}>Paid</option></select></div>
      </div>
      <div class="fld"><label>Notes</label><textarea id="soc-f-lodge-notes" ${dis} style="height:50px">${esc(plan.lodging.notes)}</textarea></div>
      ${canEdit?`<button class="btn btn-p" style="margin-top:8px" onclick="socSaveFormalSection('lodging')">Save Lodging</button>`:''}
    </div>
    <div class="card" style="margin-bottom:11px"><div class="card-hd"><span class="card-t">Catering</span></div>
      <div class="fr c2"><div class="fld"><label>Provider</label><input id="soc-f-cater-provider" ${dis} value="${esc(plan.catering.provider)}"></div><div class="fld"><label>Contact</label><input id="soc-f-cater-contact" ${dis} value="${esc(plan.catering.contact)}"></div></div>
      <div class="fr c2"><div class="fld"><label>Service Type</label><input id="soc-f-cater-type" ${dis} value="${esc(plan.catering.serviceType)}" placeholder="e.g. plated, buffet"></div><div class="fld"><label>Cost</label><input id="soc-f-cater-cost" type="number" min="0" step="0.01" ${dis} value="${plan.catering.cost||0}"></div></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:6px 0"><input type="checkbox" id="soc-f-cater-confirmed" ${dis} ${plan.catering.confirmed?'checked':''}> Catering confirmed</label>
      <div class="fld"><label>Dietary Notes</label><textarea id="soc-f-cater-dietary" ${dis} style="height:50px">${esc(plan.catering.dietaryNotes)}</textarea></div>
      ${canEdit?`<button class="btn btn-p" style="margin-top:8px" onclick="socSaveFormalSection('catering')">Save Catering</button>`:''}
    </div>
    <div class="card" style="margin-bottom:11px"><div class="card-hd"><span class="card-t">Entertainment</span></div>
      <div class="fr c2"><div class="fld"><label>Provider (DJ/Band)</label><input id="soc-f-ent-provider" ${dis} value="${esc(plan.entertainment.provider)}"></div><div class="fld"><label>Contact</label><input id="soc-f-ent-contact" ${dis} value="${esc(plan.entertainment.contact)}"></div></div>
      <div class="fr c2"><div class="fld"><label>Cost</label><input id="soc-f-ent-cost" type="number" min="0" step="0.01" ${dis} value="${plan.entertainment.cost||0}"></div><div class="fld"><label>Equipment Needs</label><input id="soc-f-ent-equip" ${dis} value="${esc(plan.entertainment.equipmentNeeds)}"></div></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:6px 0"><input type="checkbox" id="soc-f-ent-confirmed" ${dis} ${plan.entertainment.confirmed?'checked':''}> Entertainment confirmed</label>
      <div class="fld"><label>Notes</label><textarea id="soc-f-ent-notes" ${dis} style="height:50px">${esc(plan.entertainment.notes)}</textarea></div>
      ${canEdit?`<button class="btn btn-p" style="margin-top:8px" onclick="socSaveFormalSection('entertainment')">Save Entertainment</button>`:''}
    </div>
    <div class="card"><div class="card-hd"><span class="card-t">Security / Staffing</span></div>
      <div class="fr c2"><div class="fld"><label>Provider</label><input id="soc-f-sec-provider" ${dis} value="${esc(plan.security.provider)}"></div><div class="fld"><label>Contact</label><input id="soc-f-sec-contact" ${dis} value="${esc(plan.security.contact)}"></div></div>
      <div class="fr c2"><div class="fld"><label>Staff Count</label><input id="soc-f-sec-count" type="number" min="0" ${dis} value="${plan.security.staffCount||0}"></div><div class="fld"><label>Cost</label><input id="soc-f-sec-cost" type="number" min="0" step="0.01" ${dis} value="${plan.security.cost||0}"></div></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:6px 0"><input type="checkbox" id="soc-f-sec-confirmed" ${dis} ${plan.security.confirmed?'checked':''}> Security/staffing confirmed</label>
      <div class="fld"><label>Notes</label><textarea id="soc-f-sec-notes" ${dis} style="height:50px">${esc(plan.security.notes)}</textarea></div>
      ${canEdit?`<button class="btn btn-p" style="margin-top:8px" onclick="socSaveFormalSection('security')">Save Security</button>`:''}
    </div>`;
}
async function socSaveFormalSection(section){
  if(!(canEditSocial()||isLeadUser()))return;
  const id=SOC_CURRENT_EVENT_ID;
  const g=(elId)=>document.getElementById(elId);
  const sections = {
    venue: ()=>({name:g('soc-f-venue-name').value.trim(),contact:g('soc-f-venue-contact').value.trim(),address:g('soc-f-venue-address').value.trim(),phone:g('soc-f-venue-phone').value.trim(),deposit:parseFloat(g('soc-f-venue-deposit').value)||0,totalCost:parseFloat(g('soc-f-venue-total').value)||0,contractStatus:g('soc-f-venue-contract').value,confirmed:g('soc-f-venue-confirmed').checked,notes:g('soc-f-venue-notes').value.trim()}),
    transportation: ()=>({required:g('soc-f-trans-required').checked,provider:g('soc-f-trans-provider').value.trim(),contact:g('soc-f-trans-contact').value.trim(),pickupLocation:g('soc-f-trans-pickup').value.trim(),cost:parseFloat(g('soc-f-trans-cost').value)||0,departureTime:g('soc-f-trans-depart').value,returnTime:g('soc-f-trans-return').value,vehicleCount:parseFloat(g('soc-f-trans-vcount').value)||0,capacity:parseFloat(g('soc-f-trans-vcap').value)||0,confirmed:g('soc-f-trans-confirmed').checked,notes:g('soc-f-trans-notes').value.trim()}),
    lodging: ()=>({required:g('soc-f-lodge-required').checked,hotel:g('soc-f-lodge-hotel').value.trim(),contact:g('soc-f-lodge-contact').value.trim(),roomCount:parseFloat(g('soc-f-lodge-rooms').value)||0,cost:parseFloat(g('soc-f-lodge-cost').value)||0,bookingStatus:g('soc-f-lodge-status').value,notes:g('soc-f-lodge-notes').value.trim()}),
    catering: ()=>({provider:g('soc-f-cater-provider').value.trim(),contact:g('soc-f-cater-contact').value.trim(),serviceType:g('soc-f-cater-type').value.trim(),cost:parseFloat(g('soc-f-cater-cost').value)||0,confirmed:g('soc-f-cater-confirmed').checked,dietaryNotes:g('soc-f-cater-dietary').value.trim()}),
    entertainment: ()=>({provider:g('soc-f-ent-provider').value.trim(),contact:g('soc-f-ent-contact').value.trim(),cost:parseFloat(g('soc-f-ent-cost').value)||0,equipmentNeeds:g('soc-f-ent-equip').value.trim(),confirmed:g('soc-f-ent-confirmed').checked,notes:g('soc-f-ent-notes').value.trim()}),
    security: ()=>({provider:g('soc-f-sec-provider').value.trim(),contact:g('soc-f-sec-contact').value.trim(),staffCount:parseFloat(g('soc-f-sec-count').value)||0,cost:parseFloat(g('soc-f-sec-cost').value)||0,confirmed:g('soc-f-sec-confirmed').checked,notes:g('soc-f-sec-notes').value.trim()}),
  };
  const newVal = sections[section]();
  const prev = socPlan(id)[section];
  socSetPlan(id,p=>({...p,[section]:newVal}));
  try{ await saveD('social'); socRenderDetailOverview(); socRenderEventList(); toast(section.charAt(0).toUpperCase()+section.slice(1)+' saved','success'); }
  catch(e){ socSetPlan(id,p=>({...p,[section]:prev})); toast('Failed to save. Please try again.','error'); }
}

// ── MEMBER-FACING RESTRICTED VIEW — read-only list of upcoming social events. Used to include
// a self-service RSVP (yes/maybe/no) backed by a separate socialRsvps Firestore collection;
// removed, so this is now just SOC_MEMBER_VISIBLE_STATUSES-filtered event info. ──
function socRenderMemberView(){
  const el = document.getElementById('soc-member-events'); if(!el) return;
  const now = localDateStr();
  const events = socEvents().filter(e=>{
    const plan=socPlan(e.id);
    return e.date>=now && SOC_MEMBER_VISIBLE_STATUSES.includes(plan.status);
  }).sort((a,b)=>a.date.localeCompare(b.date));
  if(!events.length){ el.innerHTML = es('ti-confetti','slate','No upcoming social events','Check back soon for what\'s next.',''); return; }
  el.innerHTML = events.map(e=>{
    const plan=socPlan(e.id);
    return `<div class="card" style="margin-bottom:11px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div><div style="font-size:14px;font-weight:600">${esc(e.title)}</div><div style="font-size:11.5px;color:var(--mt)">${socCatLabel(plan.eventCategory)} · ${fds(e.date)}${e.start?' · '+to12h(e.start):''}${e.location?' · '+esc(e.location):''}</div></div>
        <span class="badge ${socStatusClass(plan.status)}">${socStatusLabel(plan.status)}</span>
      </div>
    </div>`;
  }).join('');
}

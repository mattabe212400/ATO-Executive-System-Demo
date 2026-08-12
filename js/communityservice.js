// ── COMMUNITY SERVICE ──
function canEditCommunityService(){
  return canEditPage('communityService');
}
// Events live in the shared D.events calendar (type:'service') so Community Service's
// event list always matches what's on the Calendar page, not a separate copy.
function csEvents(){
  return (D.events||[]).filter(e=>e.type==='service');
}

let CS_SELECTED_SEM=null;
function csSem(){ return CS_SELECTED_SEM||getSemester(); }
function csKnownSemesters(){
  return unionKnownSemesters([...(D.communityService.hours||[]).map(h=>h.semester),...Object.keys(D.communityService.goals||{})].filter(Boolean));
}
function csSemesterChanged(){
  CS_SELECTED_SEM=document.getElementById('cs-semester-select').value;
  renderCommunityService();
}
// Hours entries already carry a real .date, but also get an explicit .semester stamped at log
// time (see csLogHours()) — .semester is the archival source of truth (immutable), .date stays
// for within-semester chronological sort/display, so editing a date later doesn't silently move
// an entry into a different semester's archive. Legacy entries with no .semester stay visible
// regardless of which semester is selected, rather than vanishing.
function csVisibleHours(){
  const sem=csSem();
  return (D.communityService.hours||[]).filter(h=>!h.semester||h.semester===sem);
}
// One-time migration: the goal used to be one flat {totalHrs,events,avgHrs} object — wrap it into
// the current semester's slot the first time it's encountered, same pattern as
// finance.js's finEnsureDuesMigrated()/recruitment.js's rcEnsureGoalMigrated().
function csEnsureGoalMigrated(){
  const g=D.communityService.goals;
  if(g&&('totalHrs' in g)){
    D.communityService.goals={[getSemester()]:g};
  }
}
function csGoalForSemester(semester){
  return (D.communityService.goals||{})[semester||csSem()]||{totalHrs:500,events:6,avgHrs:4};
}

function renderCommunityService(){
  csEnsureGoalMigrated();
  if(!CS_SELECTED_SEM)CS_SELECTED_SEM=getSemester();
  initSemesterSelect('cs-semester-select',csKnownSemesters(),csSemesterChanged,CS_SELECTED_SEM);
  const sem=csSem();
  const canEditNow=canEditCommunityService()&&isCurrentSemester(sem);
  const logBtn=document.getElementById('cs-log-hours-btn');if(logBtn)logBtn.style.display=canEditNow?'':'none';
  const evBtn=document.getElementById('cs-add-event-btn');if(evBtn)evBtn.style.display=canEditNow?'':'none';
  const range=semesterDateRange(sem);
  const events=csEvents().filter(e=>!range||(e.date>=range.start&&e.date<=range.end));
  const hours=csVisibleHours();
  const totalHrs=Math.round(hours.reduce((s,h)=>s+(h.hours||0),0)*10)/10;
  const memberHrsMap={};
  hours.forEach(h=>{ memberHrsMap[h.memberId]=(memberHrsMap[h.memberId]||0)+(h.hours||0); });
  const participants=Object.keys(memberHrsMap).length;
  const avgHrs=participants?Math.round(totalHrs/participants*10)/10:0;
  const eventsCompleted=events.filter(e=>!isUp(e.date)).length;
  const goal=csGoalForSemester(sem);
  const goalProgress=pc(totalHrs,goal.totalHrs);
  const underReq=goal.avgHrs?D.members.filter(m=>(memberHrsMap[m.id]||0)<goal.avgHrs):[];

  document.getElementById('cs-kpi').innerHTML=
    statStrip('Total Service Hours',totalHrs,sem,'neutral')+
    statStrip('Members Participated',participants,D.members.length+' total members','neutral')+
    statStrip('Avg Hours / Member',avgHrs,'Per participant','neutral')+
    statStrip('Events Completed',eventsCompleted,events.length+' total events','neutral')+
    statStrip('Goal Progress',goalProgress+'%',goalProgress>=100?'Goal met':'Toward '+goal.totalHrs+' hrs',goalProgress>=75?'up':'neutral')+
    statStrip('Below Requirement',underReq.length,underReq.length?'Need '+goal.avgHrs+'+ hrs':'All on track',underReq.length?'down':'up');

  csRenderGoalBars();
  csRenderChart();
  csRenderLeaderboard();
  csRenderEvents();
  csFilterHours();
  csRenderMissing();
  csRenderLocations();
}

function csRenderGoalBars(){
  const sem=csSem();
  const goal=csGoalForSemester(sem);
  const range=semesterDateRange(sem);
  const totalHrs=csVisibleHours().reduce((s,h)=>s+(h.hours||0),0);
  const eventsCount=csEvents().filter(e=>!range||(e.date>=range.start&&e.date<=range.end)).length;
  const btn=document.getElementById('cs-goal-edit-btn');
  if(btn)btn.style.display=(canEditCommunityService()&&isCurrentSemester(sem))?'':'none';
  const bars=[
    {title:'Total Hours',cur:Math.round(totalHrs*10)/10,tgt:goal.totalHrs},
    {title:'Events',cur:eventsCount,tgt:goal.events},
  ];
  document.getElementById('cs-goal-bars').innerHTML=bars.map(b=>{
    const p=Math.min(pc(b.cur,b.tgt),100);
    return `<div class="pr"><span class="pl">${b.title} (${b.cur}/${b.tgt})</span><div class="pb"><div class="pf" style="width:${p}%;background:${pgc(p)}"></div></div><span class="pv">${p}%</span></div>`;
  }).join('');
}

function csRenderChart(){
  const hours=csVisibleHours();
  const chartEl=document.getElementById('cs-chart');
  const labEl=document.getElementById('cs-chart-labels');
  if(!chartEl)return;
  if(!hours.length){
    chartEl.innerHTML=`<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--ht)">No hours logged yet</div>`;
    if(labEl)labEl.innerHTML='';
    return;
  }
  const byWeek={};
  hours.forEach(h=>{
    if(!h.date)return;
    const d=new Date(h.date+'T12:00:00');
    const weekStart=new Date(d);weekStart.setDate(d.getDate()-d.getDay());
    const key=localDateStr(weekStart);
    byWeek[key]=(byWeek[key]||0)+(h.hours||0);
  });
  const weeks=Object.keys(byWeek).sort().slice(-8);
  const data=weeks.map(w=>byWeek[w]);
  const labels=weeks.map(w=>mos(w)+' '+dom(w));
  const mx=Math.max(...data,1);
  chartEl.innerHTML=data.map((v,i)=>`<div class="mb" style="flex:1;height:${Math.round(v/mx*100)}%;background:${i===data.length-1?'var(--navy)':'var(--sky-bg)'};border-radius:3px 3px 0 0" title="${labels[i]}: ${v} hrs"></div>`).join('');
  if(labEl)labEl.innerHTML=labels.map(l=>`<span>${l}</span>`).join('');
}

function csRenderLeaderboard(){
  const hours=csVisibleHours();
  const memberHrsMap={};
  hours.forEach(h=>{ memberHrsMap[h.memberId]=(memberHrsMap[h.memberId]||0)+(h.hours||0); });
  const totalHrs=Math.round(hours.reduce((s,h)=>s+(h.hours||0),0)*10)/10;
  const totalEl=document.getElementById('cs-total-hrs');
  if(totalEl)totalEl.textContent=totalHrs+' total hrs';
  const top=Object.entries(memberHrsMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const el=document.getElementById('cs-leaderboard');
  if(!el)return;
  if(!top.length){ el.innerHTML=es('ti-trophy','green','No hours yet','Log service hours to see top volunteers.',''); return; }
  el.innerHTML=top.map(([id,hrs],i)=>{
    const m=mB(id);
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)">
      <span style="font-size:11px;color:var(--mt);width:16px">${i+1}</span>
      <div class="sh-av" style="width:24px;height:24px;font-size:9px">${m.initials}</div>
      <span style="flex:1;font-size:12px;font-weight:500">${esc(m.name)}</span>
      <span style="font-size:12px;font-weight:600;color:var(--gn)">${Math.round(hrs*10)/10} hrs</span>
    </div>`;
  }).join('');
}

function csRenderEvents(){
  const sem=csSem();
  const range=semesterDateRange(sem);
  const events=csEvents().filter(e=>!range||(e.date>=range.start&&e.date<=range.end));
  const canEdit=canEditCommunityService()&&isCurrentSemester(sem);
  const el=document.getElementById('cs-events-table');
  if(!el)return;
  if(!events.length){ el.innerHTML=`<tbody><tr><td>${es('ti-calendar','green','No service events','Add an event to get started.',canEdit?`<button class="btn btn-p" onclick="csOpenAddEvent()">Add Event</button>`:'')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Event</th><th>Date</th><th>Org</th><th>Hour Goal</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    [...events].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr><td style="font-weight:500">${esc(e.title)}</td><td>${fds(e.date)}</td><td style="color:var(--mt)">${esc(e.org)||'N/A'}</td><td>${e.hourGoal||'N/A'}</td>${canEdit?`<td><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="csDeleteEvent('${e.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`).join('')
  }</tbody>`;
}

function csFilterHours(){
  const q=(document.getElementById('cs-search')?.value||'').toLowerCase();
  const hours=csVisibleHours();
  const canEdit=canEditCommunityService()&&isCurrentSemester(csSem());
  const rows=hours.filter(h=>(h.memberName||mB(h.memberId).name).toLowerCase().includes(q));
  const el=document.getElementById('cs-hours-table');
  if(!el)return;
  const mobEl=document.getElementById('cs-hours-mobile-cards');
  if(!rows.length){
    el.innerHTML=`<tbody><tr><td>${es('ti-clock','blue','No hours logged','Log hours to track member participation.','')}</td></tr></tbody>`;
    if(mobEl)mobEl.innerHTML=`<div style="color:var(--ht);font-size:12px;padding:20px;text-align:center">No hours logged. Log hours to track member participation.</div>`;
    return;
  }
  const events=csEvents();
  const sorted=[...rows].sort((a,b)=>b.date.localeCompare(a.date));
  el.innerHTML=`<thead><tr><th>Member</th><th>Hours</th><th>Event</th><th>Date</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    sorted.map(h=>{
      const ev=events.find(e=>e.id===h.eventId);
      return `<tr><td style="font-weight:500">${esc(h.memberName||mB(h.memberId).name)}</td><td>${h.hours}</td><td style="color:var(--mt)">${ev?esc(ev.title):'General'}</td><td>${fds(h.date)}</td>${canEdit?`<td><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="csDeleteHours('${h.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`;
    }).join('')
  }</tbody>`;
  if(mobEl)mobEl.innerHTML=sorted.map(h=>{
    const m=mB(h.memberId);
    const displayName=h.memberName||m.name;
    const ev=events.find(e=>e.id===h.eventId);
    return`<div class="mob-card card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div class="sh-av" style="width:34px;height:34px;font-size:12px;flex-shrink:0">${esc(m.initials)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(displayName)}</div>
          <div style="font-size:11px;color:var(--mt)">${ev?esc(ev.title):'General'} · ${fds(h.date)}</div>
        </div>
        <span style="font-size:14px;font-weight:700;color:var(--gn);flex-shrink:0">${h.hours} hrs</span>
      </div>
      ${canEdit?`<button class="btn btn-d" style="height:22px;font-size:10px;padding:0 7px" onclick="csDeleteHours('${h.id}')" aria-label="Delete"><i class="ti ti-trash"></i>Delete</button>`:''}
    </div>`;
  }).join('');
}

function csRenderMissing(){
  const hours=csVisibleHours();
  const goal=csGoalForSemester();
  const req=goal.avgHrs||0;
  const memberHrsMap={};
  hours.forEach(h=>{ memberHrsMap[h.memberId]=(memberHrsMap[h.memberId]||0)+(h.hours||0); });
  const missing=req?D.members.filter(m=>(memberHrsMap[m.id]||0)<req):[];
  const el=document.getElementById('cs-missing-table');
  if(!el)return;
  if(!req||!missing.length){ el.innerHTML=`<tbody><tr><td>${es('ti-circle-check','green','Everyone on track','No per-member hour requirement set, or everyone meets it.','')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Member</th><th>Hours</th><th>Needed</th></tr></thead><tbody>${
    [...missing].sort(mNameCompare).map(m=>`<tr><td style="font-weight:500">${esc(m.name)}</td><td>${Math.round((memberHrsMap[m.id]||0)*10)/10}</td><td style="color:var(--rd)">${(req-(memberHrsMap[m.id]||0)).toFixed(1)}</td></tr>`).join('')
  }</tbody>`;
}

function csRenderLocations(){
  const locations=D.communityService.locations||[];
  const canEdit=canEditCommunityService();
  const el=document.getElementById('cs-locations-table');
  if(!el)return;
  if(!locations.length){ el.innerHTML=`<tbody><tr><td>${es('ti-map-pin','green','No service locations yet','Track where the chapter volunteers and who to contact.','')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Location</th><th>Address</th><th>Contact</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    locations.map(l=>`<tr><td style="font-weight:500">${esc(l.name)}</td><td style="color:var(--mt)">${esc(l.address)||'N/A'}</td><td style="color:var(--mt)">${esc([l.contactName,l.contactInfo].filter(Boolean).join(' · '))||'N/A'}</td>${canEdit?`<td><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="csDeleteLocation('${l.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`).join('')
  }</tbody>`;
}

// ── ACTIONS ──
function csOpenAddEvent(){
  if(!canEditCommunityService()){toast('Only officers with Community Service access can add events.','error');return;}
  ['cs-ev-title','cs-ev-date','cs-ev-goal','cs-ev-org','cs-ev-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openM('m-cs-addevent');
}
async function csAddEvent(){
  if(!canEditCommunityService())return;
  if(!isCurrentSemester(csSem())){toast('This semester is read-only.','error');return;}
  const title=document.getElementById('cs-ev-title').value.trim();
  if(!title){toast('Event name is required','error');return;}
  const event={id:uid(),title,type:'service',date:document.getElementById('cs-ev-date').value||localDateStr(),hourGoal:parseFloat(document.getElementById('cs-ev-goal').value)||0,org:document.getElementById('cs-ev-org').value.trim(),notes:document.getElementById('cs-ev-notes').value.trim()};
  D.events.push(event);
  try{
    await saveD('events');
    closeM(null,document.getElementById('m-cs-addevent'));
    renderCommunityService();
    if(typeof renderCalendar==='function')renderCalendar();
    toast('Event added','success');
  }catch(e){
    D.events=D.events.filter(x=>x.id!==event.id);
    toast('Failed to add event. Please try again.','error');
  }
}
async function csDeleteEvent(id){
  if(!canEditCommunityService())return;
  const target=D.events.find(e=>e.id===id);
  if(!isCurrentSemester(semesterLabelForDate(target?.date))){toast('This event is in a past semester and is read-only.','error');return;}
  const attNote=canEditPage('attendance')?' Attendance records for it will also be removed.':'';
  const ok=await confirmDialog('Delete Event','Delete this event?'+attNote);
  if(!ok)return;
  const removed=D.events.find(e=>e.id===id);
  const removedAtt=D.attendance[id];
  const removedPlanning=D.social?.planning?.[id];
  D.events=D.events.filter(e=>e.id!==id);
  delete D.attendance[id];
  if(D.social?.planning)delete D.social.planning[id];
  // Only bundle 'attendance'/'social' if this caller's grant actually covers them — saveD's
  // writeBatch is atomic, so an unauthorized extra key would deny the whole batch (see
  // js/events.js's deleteEvent for the same fix and full explanation).
  const keys=['events'];
  if(canEditPage('attendance'))keys.push('attendance');
  if(canEditPage('social'))keys.push('social');
  try{
    await saveD(...keys);
    renderCommunityService();
    if(typeof renderCalendar==='function')renderCalendar();
    toast('Event deleted','info');
  }catch(e){
    if(removed)D.events.push(removed);
    if(removedAtt)D.attendance[id]=removedAtt;
    if(removedPlanning&&D.social?.planning)D.social.planning[id]=removedPlanning;
    toast('Failed to delete event. Please try again.','error');
  }
}

function csOpenLogHours(){
  if(!canEditCommunityService()){toast('Only officers with Community Service access can log hours.','error');return;}
  const memberSel=document.getElementById('cs-log-member');
  memberSel.innerHTML=mOpts();
  const eventSel=document.getElementById('cs-log-event');
  // Multiple service events at the same org (e.g. several "Reiman Gardens" dates through the
  // semester) are otherwise indistinguishable by title alone — the date suffix disambiguates them,
  // and picking one auto-fills the Date field below so the two can't end up mismatched.
  const sortedEvents=[...csEvents()].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  eventSel.innerHTML='<option value="">-- General / Other --</option>'+sortedEvents.map(e=>`<option value="${e.id}" data-date="${esc(e.date||'')}">${esc(e.title)}, ${fd(e.date)}</option>`).join('');
  document.getElementById('cs-log-hours').value='';
  document.getElementById('cs-log-date').value=localDateStr();
  document.getElementById('cs-log-notes').value='';
  openM('m-cs-loghours');
}
// Keeps the Date field in sync with whichever event is picked — without this, picking "Reiman
// Gardens (Oct 21)" but leaving Date at today's default would silently log the hours against the
// wrong day for that event.
function csLogEventChanged(){
  const sel=document.getElementById('cs-log-event');
  const date=sel.options[sel.selectedIndex]?.dataset.date;
  if(date)document.getElementById('cs-log-date').value=date;
}
async function csLogHours(){
  if(!canEditCommunityService())return;
  if(!isCurrentSemester(csSem())){toast('This semester is read-only.','error');return;}
  const memberId=document.getElementById('cs-log-member').value;
  const hrs=parseFloat(document.getElementById('cs-log-hours').value);
  if(!memberId||!hrs||hrs<=0){toast('Member and hours are required','error');return;}
  // memberName snapshot at log time — same reason judicial cases now snapshot it (js/judicial.js
  // addCase()): without it, a deleted member's hours history shows "Unknown" forever since this
  // isn't in deleteMember()'s cascade cleanup. semester is likewise stamped once here and never
  // recomputed — the archival source of truth, independent of the editable .date field.
  const log={id:uid(),memberId,memberName:mB(memberId).name,hours:hrs,eventId:document.getElementById('cs-log-event').value||null,date:document.getElementById('cs-log-date').value||localDateStr(),notes:document.getElementById('cs-log-notes').value.trim(),semester:getSemester()};
  D.communityService.hours.push(log);
  try{
    await saveD('communityService');
    closeM(null,document.getElementById('m-cs-loghours'));
    renderCommunityService();
    toast('Hours logged','success');
  }catch(e){
    D.communityService.hours=D.communityService.hours.filter(x=>x.id!==log.id);
    toast('Failed to log hours. Please try again.','error');
  }
}
async function csDeleteHours(id){
  if(!canEditCommunityService())return;
  const target=D.communityService.hours.find(h=>h.id===id);
  if(target?.semester&&!isCurrentSemester(target.semester)){toast('This semester is read-only.','error');return;}
  const ok=await confirmDialog('Remove Log','Remove this hours log entry?');
  if(!ok)return;
  const removed=D.communityService.hours.find(h=>h.id===id);
  D.communityService.hours=D.communityService.hours.filter(h=>h.id!==id);
  try{await saveD('communityService');renderCommunityService();toast('Log removed','info');}
  catch(e){if(removed)D.communityService.hours.push(removed);toast('Failed to remove log. Please try again.','error');}
}

function csOpenGoalEdit(){
  if(!canEditCommunityService()){toast('Only officers with Community Service access can edit goals.','error');return;}
  if(!isCurrentSemester(csSem())){toast('This semester is read-only.','error');return;}
  const goal=csGoalForSemester();
  document.getElementById('csg-hours').value=goal.totalHrs||'';
  document.getElementById('csg-events').value=goal.events||'';
  document.getElementById('csg-avg').value=goal.avgHrs||'';
  openM('m-cs-goal');
}
async function csSaveGoal(){
  if(!canEditCommunityService())return;
  if(!isCurrentSemester(csSem())){toast('This semester is read-only.','error');return;}
  const totalHrs=parseFloat(document.getElementById('csg-hours').value)||0;
  const events=parseFloat(document.getElementById('csg-events').value)||0;
  const avgHrs=parseFloat(document.getElementById('csg-avg').value)||0;
  if(!D.communityService.goals)D.communityService.goals={};
  const sem=getSemester();
  const prev=D.communityService.goals[sem];
  D.communityService.goals[sem]={totalHrs,events,avgHrs};
  try{
    await saveD('communityService');
    closeM(null,document.getElementById('m-cs-goal'));
    renderCommunityService();
    toast('Goals updated','success');
  }catch(e){
    D.communityService.goals[sem]=prev;
    toast('Failed to update goals. Please try again.','error');
  }
}

function csOpenAddLocation(){
  if(!canEditCommunityService()){toast('Only officers with Community Service access can add locations.','error');return;}
  ['cs-loc-name','cs-loc-address','cs-loc-contact-name','cs-loc-contact-info','cs-loc-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openM('m-cs-addlocation');
}
async function csAddLocation(){
  if(!canEditCommunityService())return;
  const name=document.getElementById('cs-loc-name').value.trim();
  if(!name){toast('Location name is required','error');return;}
  const location={id:uid(),name,address:document.getElementById('cs-loc-address').value.trim(),contactName:document.getElementById('cs-loc-contact-name').value.trim(),contactInfo:document.getElementById('cs-loc-contact-info').value.trim(),notes:document.getElementById('cs-loc-notes').value.trim()};
  D.communityService.locations.push(location);
  try{
    await saveD('communityService');
    closeM(null,document.getElementById('m-cs-addlocation'));
    renderCommunityService();
    toast('Location added','success');
  }catch(e){
    D.communityService.locations=D.communityService.locations.filter(x=>x.id!==location.id);
    toast('Failed to add location. Please try again.','error');
  }
}
async function csDeleteLocation(id){
  if(!canEditCommunityService())return;
  const ok=await confirmDialog('Remove Location','Remove this service location?');
  if(!ok)return;
  const removed=D.communityService.locations.find(l=>l.id===id);
  D.communityService.locations=D.communityService.locations.filter(l=>l.id!==id);
  try{await saveD('communityService');renderCommunityService();toast('Location removed','info');}
  catch(e){if(removed)D.communityService.locations.push(removed);toast('Failed to remove location. Please try again.','error');}
}

function csExport(){
  const sem=csSem();
  const hours=csVisibleHours();
  const events=csEvents();
  let csv='Member,Hours,Event,Date,Notes\n';
  hours.forEach(h=>{
    const ev=events.find(e=>e.id===h.eventId);
    csv+=`${csvSafe(h.memberName||mB(h.memberId).name)},${h.hours},${csvSafe(ev?ev.title:'General')},${h.date},${csvSafe((h.notes||'').replace(/,/g,';'))}\n`;
  });
  downloadCSV('community_service_hours_'+sem.replace(/\s+/g,'_')+'.csv',csv);
}

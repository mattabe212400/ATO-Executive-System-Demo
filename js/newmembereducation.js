// ── NEW MEMBER EDUCATION ──
function canEditNewMemberEducation(){
  return canEditPage('newMemberEducation');
}

// Uses the explicit m.memberStatus field, NOT class year — a Freshman may already be an
// initiated active brother, and a Sophomore/Junior can be a brand-new member (transfer,
// spring bid, etc.), so class year can never stand in for membership status.
function nmeGetClass(){
  return sortedMembers().filter(m=>(m.memberStatus||'Active')==='New Member');
}
function nmeReqDone(memberId,reqId){
  return !!(D.newMemberEducation.progress[memberId]&&D.newMemberEducation.progress[memberId][reqId]);
}
function nmeProgressPct(memberId){
  const requirements=D.newMemberEducation.requirements||[];
  if(!requirements.length)return 0;
  const done=requirements.filter(r=>nmeReqDone(memberId,r.id)).length;
  return Math.round(done/requirements.length*100);
}
// Sessions live in the shared D.events calendar (type:'pledge'), same pattern as Social/
// Philanthropy/Community Service — so a scheduled session always matches what's on the
// Calendar, not a separate copy. Attendance for them is tracked the normal way, through the
// Attendance page (D.attendance keyed by event id), not a local per-session array.
function nmeSessions(){ return (D.events||[]).filter(e=>e.type==='pledge'); }

// ── Semester scoping — deliberately narrow: only the sessions/events view is date-range
// filtered. Requirements/progress stay always-current/unfiltered, since "New Member" is a live
// memberStatus field, not a frozen semester cohort — once someone's initiated they naturally age
// out of nmeGetClass() with nothing retroactive to preserve, unlike Rushees.
let NME_SELECTED_SEM=null;
function nmeSem(){ return NME_SELECTED_SEM||getSemester(); }
function nmeKnownSemesters(){
  return unionKnownSemesters(nmeSessions().map(s=>semesterLabelForDate(s.date)).filter(Boolean));
}
function nmeVisibleSessions(){
  return nmeSessions().filter(s=>semesterLabelForDate(s.date)===nmeSem());
}
function nmeSemesterChanged(){
  NME_SELECTED_SEM=document.getElementById('nme-semester-select').value;
  renderNewMemberEducation();
}

function renderNewMemberEducation(){
  // The curriculum/progress-tracking on this page names and ranks every new member's standing,
  // which isn't general-member-visible (same reasoning renderAttendanceOwnOnly() uses to hide
  // Risk Stratification from viewers) — enforced by leaving 'newMemberEducation' out of
  // VIEWER_PAGES (js/auth.js) rather than an in-page gate, now that the Peer Mentor Program
  // section (the one part viewers used to see here) has moved to Committees.
  const editActions=document.getElementById('nme-edit-actions');
  if(editActions)editActions.style.display=canEditNewMemberEducation()?'':'none';
  initSemesterSelect('nme-semester-select',nmeKnownSemesters(),nmeSemesterChanged,nmeSem());
  const addSessBtn=document.getElementById('nme-add-session-btn');
  if(addSessBtn)addSessBtn.style.display=(canEditNewMemberEducation()&&isCurrentSemester(nmeSem()))?'':'none';
  const nme=D.newMemberEducation;
  const sessions=nmeVisibleSessions();
  const requirements=nme.requirements||[];
  const newMembers=nmeGetClass();
  const today=localDateStr();
  const completedSessions=sessions.filter(s=>s.date&&s.date<today).length;
  const progressPcts=newMembers.map(m=>nmeProgressPct(m.id));
  const avgProgress=progressPcts.length?Math.round(progressPcts.reduce((a,b)=>a+b,0)/progressPcts.length):0;
  const atRisk=newMembers.filter(m=>nmeProgressPct(m.id)<50).length;
  const reqCompletedTotal=newMembers.reduce((s,m)=>s+requirements.filter(r=>nmeReqDone(m.id,r.id)).length,0);

  document.getElementById('nme-kpi').innerHTML=
    statStrip('New Members',newMembers.length,'In program','neutral')+
    statStrip('Sessions Scheduled',sessions.length,completedSessions+' completed','neutral')+
    statStrip('Sessions Completed',completedSessions,sessions.length+' total','neutral')+
    statStrip('Avg Progress',avgProgress+'%','Across new members',avgProgress>=75?'up':avgProgress>=50?'neutral':'down')+
    statStrip('At-Risk Members',atRisk,atRisk?'Below 50% progress':'All on track',atRisk?'down':'up')+
    statStrip('Requirements Completed',reqCompletedTotal,'Across all new members','neutral');

  nmeRenderProgress();
  nmeRenderRisk();
  nmeRenderSessions();
  nmeRenderRequirements();
  nmeRenderGradeChecks();
}

// ── NEW MEMBER GRADE CHECKS — moved here from Academics' Grade Checks tab, since this table is
// new-member-specific (weekly nmCheckins against the GC_NM_TARGET minimum GPA). Membership
// Review Referrals (any member, not just new members) stayed in js/academics.js, which still
// owns GC_NM_TARGET/gcWeekStart()/gcLastCheckin()/gcDaysSince()/openLogCheckin()/saveCheckin()/
// openCheckinHistory()/deleteCheckin() as shared infrastructure for both tables — this function
// only builds the new-member table's markup. ──
function nmeRenderGradeChecks(){
  if(!D.academics)D.academics={gpas:{},history:[]};
  if(!D.academics.nmCheckins)D.academics.nmCheckins={};
  const el=document.getElementById('nme-grade-checks');
  if(!el)return;

  const today=localDateStr();
  const weekStart=gcWeekStart(today);
  const newMembers=nmeGetClass();
  const checkedThisWeek=newMembers.filter(m=>(D.academics.nmCheckins[m.id]||[]).some(c=>c.date>=weekStart&&c.date<=today)).length;
  const weekPct=newMembers.length?Math.round(checkedThisWeek/newMembers.length*100):0;
  const weekColor=weekPct===100?'var(--gn)':weekPct>=50?'var(--am)':'var(--rd)';

  const nmRows=newMembers.map(m=>{
    const checkins=D.academics.nmCheckins[m.id]||[];
    const last=gcLastCheckin(checkins);
    const days=gcDaysSince(last?.date);
    const thisWeek=checkins.some(c=>c.date>=weekStart&&c.date<=today);
    const lastGpa=last?parseFloat(last.gpa):null;
    const below=lastGpa!==null&&lastGpa<GC_NM_TARGET;
    return`<tr>
      <td><div style="display:flex;align-items:center;gap:7px">
        <div class="sh-av" style="width:22px;height:22px;font-size:8px">${esc(m.initials)}</div>
        <span style="font-weight:500;font-size:12px">${esc(m.name)}</span>
      </div></td>
      <td style="text-align:center">${lastGpa!==null?`<span class="gpa-badge ${gpaColor(lastGpa)}">${lastGpa.toFixed(2)}</span>`:'<span style="color:var(--ht)">—</span>'}</td>
      <td style="text-align:center;font-size:12px;font-weight:600;color:${below?'var(--rd)':'var(--gn)'}">${lastGpa!==null?(below?'<i class="ti ti-arrow-down" style="font-size:11px"></i> Below':'<i class="ti ti-check" style="font-size:11px"></i> Met'):'—'}</td>
      <td style="font-size:11px;color:var(--mt)">${last?fds(last.date):'Never'}</td>
      <td style="font-size:11px;font-weight:${days!==null&&days>7?'600':'400'};color:${days!==null&&days>7?'var(--rd)':'var(--mt)'}">${days!==null?days+'d ago':'—'}</td>
      <td><span class="badge ${thisWeek?'bg2':days!==null&&days>7?'br2':'bm2'}">${thisWeek?'Done':days!==null&&days>7?'Overdue':'Pending'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-p" style="height:23px;font-size:10px;padding:0 8px;margin-right:3px" onclick="openLogCheckin('${m.id}','nm')"><i class="ti ti-check"></i>Log</button>
        <button class="btn" style="height:23px;font-size:10px;padding:0 7px" onclick="openCheckinHistory('${m.id}','nm')" title="View history" aria-label="View check-in history for ${esc(m.name)}"><i class="ti ti-history"></i></button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML=`
    <div class="card">
      <div class="card-hd" style="flex-wrap:wrap;gap:8px">
        <div>
          <div class="card-t">New Member Grade Checks</div>
          <div style="font-size:11px;color:var(--mt);margin-top:1px">All new members · Weekly check-in required · Minimum ${GC_NM_TARGET.toFixed(2)} GPA</div>
        </div>
        <div style="display:flex;align-items:center;gap:9px;margin-left:auto">
          <span style="font-size:11.5px;color:var(--mt)">${checkedThisWeek} / ${newMembers.length} checked in this week</span>
          <div style="width:80px;height:7px;background:var(--bdr);border-radius:99px;overflow:hidden;flex-shrink:0">
            <div style="height:100%;background:${weekColor};width:100%;transform-origin:left;transform:scaleX(${weekPct/100});border-radius:99px;transition:transform .3s"></div>
          </div>
        </div>
      </div>
      ${newMembers.length
        ?`<div class="tw"><table class="tbl"><thead><tr>
            <th>Member</th><th style="text-align:center">Latest GPA</th><th style="text-align:center">vs ${GC_NM_TARGET.toFixed(2)}</th>
            <th>Last Check-In</th><th>Days Since</th><th>This Week</th><th></th>
          </tr></thead><tbody>${nmRows}</tbody></table></div>`
        :`<div style="color:var(--ht);font-size:11.5px;padding:16px 0;text-align:center">No new members enrolled yet. Members with Member Status set to "New Member" (on the Members page) will appear here automatically.</div>`}
    </div>`;
}

function nmeRenderProgress(){
  const requirements=D.newMemberEducation.requirements||[];
  const newMembers=nmeGetClass();
  const canEdit=canEditNewMemberEducation();
  const el=document.getElementById('nme-progress-table');
  if(!el)return;
  if(!newMembers.length){ el.innerHTML=`<tbody><tr><td>${es('ti-school','blue','No new members','Members with Member Status set to "New Member" (on the Members page) appear here.','')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Member</th><th>Class</th><th>Progress</th><th>Requirements</th><th>Status</th></tr></thead><tbody>${
    newMembers.map(m=>{
      const done=requirements.filter(r=>nmeReqDone(m.id,r.id)).length;
      const pct=nmeProgressPct(m.id);
      const status=pct>=100?['On Track','bg2']:pct>=50?['In Progress','ba2']:['At Risk','br2'];
      return `<tr style="${canEdit?'cursor:pointer':''}" ${canEdit?`onclick="nmeOpenProgress('${m.id}')"`:''}>
        <td style="font-weight:500">${esc(m.name)}</td><td style="color:var(--mt)">${esc(m.classYear)}</td>
        <td><div class="pb" style="width:70px;display:inline-block;vertical-align:middle"><div class="pf" style="width:${pct}%;background:${pgc(pct)}"></div></div> <span style="font-size:11px">${pct}%</span></td>
        <td>${done}/${requirements.length}</td><td><span class="badge ${status[1]}">${status[0]}</span></td>
      </tr>`;
    }).join('')
  }</tbody>`;
}

function nmeRenderRisk(){
  const newMembers=nmeGetClass();
  const el=document.getElementById('nme-risk-table');
  if(!el)return;
  const risk=newMembers.filter(m=>nmeProgressPct(m.id)<50);
  if(!risk.length){ el.innerHTML=`<tbody><tr><td>${es('ti-circle-check','green','No members at risk','Everyone is on track.','')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Member</th><th>Progress</th></tr></thead><tbody>${
    [...risk].sort(mNameCompare).map(m=>`<tr><td style="font-weight:500">${esc(m.name)}</td><td style="color:var(--rd)">${nmeProgressPct(m.id)}%</td></tr>`).join('')
  }</tbody>`;
}

function nmeRenderSessions(){
  const sessions=nmeVisibleSessions();
  const canEdit=canEditNewMemberEducation()&&isCurrentSemester(nmeSem());
  const el=document.getElementById('nme-sessions-table');
  if(!el)return;
  if(!sessions.length){ el.innerHTML=`<tbody><tr><td>${es('ti-calendar','blue','No sessions yet','Schedule your first education session.',canEdit?`<button class="btn btn-p" onclick="nmeOpenAddSession()">Add Session</button>`:'')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Session</th><th>Date</th><th>Facilitator</th><th>Notes</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    [...sessions].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>{
      const notesCell=canEdit
        ?`<textarea rows="1" placeholder="Agenda notes..." style="width:100%;min-width:170px;padding:4px 7px;border:1px solid var(--bdr);border-radius:6px;font-size:11px;font-family:inherit;background:var(--surf2);color:var(--tx);resize:vertical;outline:none" onblur="nmeSaveSessionNotes('${s.id}',this.value)">${esc(s.notes||'')}</textarea>`
        :`<span style="color:var(--mt)">${s.notes?esc(s.notes):'—'}</span>`;
      return`<tr><td style="font-weight:500">${esc(s.title)}</td><td>${fds(s.date)}</td><td style="color:var(--mt)">${s.facilitatorId?esc(mB(s.facilitatorId).name):'—'}</td><td>${notesCell}</td>${canEdit?`<td style="display:flex;gap:4px;justify-content:flex-end"><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="nmeDeleteSession('${s.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`;
    }).join('')
  }</tbody>`;
}
async function nmeSaveSessionNotes(id,value){
  if(!canEditNewMemberEducation())return;
  const ev=D.events.find(e=>e.id===id);
  if(!ev)return;
  if(!isCurrentSemester(semesterLabelForDate(ev.date))){toast('This session is in a past semester and is read-only.','error');return;}
  const prev=ev.notes;
  const notes=value.trim();
  if(notes===(prev||''))return;
  ev.notes=notes;
  try{ await saveD('events'); }
  catch(e){ ev.notes=prev; toast('Failed to save notes. Please try again.','error'); nmeRenderSessions(); }
}

function nmeRenderRequirements(){
  const requirements=D.newMemberEducation.requirements||[];
  const newMembers=nmeGetClass();
  const canEdit=canEditNewMemberEducation();
  const el=document.getElementById('nme-requirements-table');
  if(!el)return;
  if(!requirements.length){ el.innerHTML=`<tbody><tr><td>${es('ti-list-check','blue','No requirements yet','Add requirements new members must complete.',canEdit?`<button class="btn btn-p" onclick="nmeOpenAddRequirement()">Add Requirement</button>`:'')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Requirement</th><th>Due</th><th>Completed</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    requirements.map(r=>{
      const done=newMembers.filter(m=>nmeReqDone(m.id,r.id)).length;
      return `<tr><td style="font-weight:500">${esc(r.title)}</td><td>${r.due?fds(r.due):'—'}</td><td>${done}/${newMembers.length}</td>${canEdit?`<td><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="nmeDeleteRequirement('${r.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`;
    }).join('')
  }</tbody>`;
}

// ── SESSIONS ──
function nmeOpenAddSession(){
  if(!canEditNewMemberEducation()){toast('Only officers with New Member Education access can add sessions.','error');return;}
  if(!isCurrentSemester(nmeSem())){toast('This semester is read-only.','error');return;}
  document.getElementById('nmes-id').value='';
  document.getElementById('nmes-title').value='';
  document.getElementById('nmes-date').value=localDateStr();
  document.getElementById('nmes-facilitator').innerHTML='<option value="">— None —</option>'+mOpts();
  document.getElementById('nmes-notes').value='';
  openM('m-nme-addsession');
}
async function nmeAddSession(){
  if(!canEditNewMemberEducation()||!isCurrentSemester(nmeSem()))return;
  const title=document.getElementById('nmes-title').value.trim();
  if(!title){toast('Session title is required','error');return;}
  const event={id:uid(),title,type:'pledge',date:document.getElementById('nmes-date').value||localDateStr(),facilitatorId:document.getElementById('nmes-facilitator').value||null,notes:document.getElementById('nmes-notes').value.trim(),mandatory:false};
  D.events.push(event);
  try{
    await saveD('events');
    closeM(null,document.getElementById('m-nme-addsession'));
    renderNewMemberEducation();
    if(typeof renderCalendar==='function')renderCalendar();
    toast('Session added','success');
  }catch(e){
    D.events=D.events.filter(x=>x.id!==event.id);
    toast('Failed to add session. Please try again.','error');
  }
}
async function nmeDeleteSession(id){
  if(!canEditNewMemberEducation())return;
  const sess=D.events.find(e=>e.id===id);
  if(sess&&!isCurrentSemester(semesterLabelForDate(sess.date))){toast('This session is in a past semester and is read-only.','error');return;}
  const attNote=canEditPage('attendance')?' and its attendance record':'';
  const ok=await confirmDialog('Delete Session','Delete this session'+attNote+'?');
  if(!ok)return;
  const removed=D.events.find(e=>e.id===id);
  const removedAtt=D.attendance[id];
  D.events=D.events.filter(e=>e.id!==id);
  delete D.attendance[id];
  // Only bundle 'attendance' if this caller's grant actually covers it — saveD's writeBatch
  // is atomic, so an unauthorized extra key would deny the whole batch (see js/events.js's
  // deleteEvent for the same fix and full explanation).
  const keys=['events'];
  if(canEditPage('attendance'))keys.push('attendance');
  try{
    await saveD(...keys);
    renderNewMemberEducation();
    if(typeof renderCalendar==='function')renderCalendar();
    toast('Session deleted','info');
  }catch(e){
    if(removed)D.events.push(removed);
    if(removedAtt)D.attendance[id]=removedAtt;
    toast('Failed to delete session. Please try again.','error');
  }
}

// ── REQUIREMENTS ──
function nmeOpenAddRequirement(){
  if(!canEditNewMemberEducation()){toast('Only officers with New Member Education access can add requirements.','error');return;}
  document.getElementById('nmereq-title').value='';
  document.getElementById('nmereq-due').value='';
  document.getElementById('nmereq-desc').value='';
  openM('m-nme-addreq');
}
async function nmeAddRequirement(){
  if(!canEditNewMemberEducation())return;
  const title=document.getElementById('nmereq-title').value.trim();
  if(!title){toast('Requirement title is required','error');return;}
  const req={id:uid(),title,due:document.getElementById('nmereq-due').value||null,desc:document.getElementById('nmereq-desc').value.trim()};
  D.newMemberEducation.requirements.push(req);
  try{
    await saveD('newMemberEducation');
    closeM(null,document.getElementById('m-nme-addreq'));
    renderNewMemberEducation();
    toast('Requirement added','success');
  }catch(e){
    D.newMemberEducation.requirements=D.newMemberEducation.requirements.filter(x=>x.id!==req.id);
    toast('Failed to add requirement. Please try again.','error');
  }
}
async function nmeDeleteRequirement(id){
  if(!canEditNewMemberEducation())return;
  const ok=await confirmDialog('Delete Requirement','Delete this requirement? Progress toward it will be lost.');
  if(!ok)return;
  const removed=D.newMemberEducation.requirements.find(r=>r.id===id);
  D.newMemberEducation.requirements=D.newMemberEducation.requirements.filter(r=>r.id!==id);
  try{await saveD('newMemberEducation');renderNewMemberEducation();toast('Requirement deleted','info');}
  catch(e){if(removed)D.newMemberEducation.requirements.push(removed);toast('Failed to delete requirement. Please try again.','error');}
}

// ── PER-MEMBER PROGRESS (finally wires up what nmProgress never did) ──
function nmeOpenProgress(memberId){
  if(!canEditNewMemberEducation())return;
  const m=mB(memberId);
  document.getElementById('nmep-member-id').value=memberId;
  document.getElementById('nmep-title').textContent=m.name+' — Progress';
  const requirements=D.newMemberEducation.requirements||[];
  const el=document.getElementById('nmep-list');
  if(!requirements.length){ el.innerHTML=es('ti-list-check','blue','No requirements yet','Add requirements first.',''); }
  else{
    el.innerHTML=requirements.map(r=>`
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr);cursor:pointer">
        <input type="checkbox" ${nmeReqDone(memberId,r.id)?'checked':''} onchange="nmeToggleProgress('${memberId}','${r.id}',this.checked)">
        <span style="font-size:12.5px">${esc(r.title)}</span>
      </label>`).join('');
  }
  openM('m-nme-progress');
}
function nmeToggleProgress(memberId,reqId,checked){
  if(!canEditNewMemberEducation())return;
  if(!D.newMemberEducation.progress[memberId])D.newMemberEducation.progress[memberId]={};
  D.newMemberEducation.progress[memberId][reqId]=checked;
  saveD('newMemberEducation');
  renderNewMemberEducation();
}

function nmeExport(){
  const requirements=D.newMemberEducation.requirements||[];
  const newMembers=nmeGetClass();
  let csv='Member,Class Year,Progress %,Requirements Completed\n';
  newMembers.forEach(m=>{
    const done=requirements.filter(r=>nmeReqDone(m.id,r.id)).length;
    csv+=`${csvSafe(m.name)},${m.classYear},${nmeProgressPct(m.id)},${done}/${requirements.length}\n`;
  });
  downloadCSV('new_member_education_progress.csv',csv);
}

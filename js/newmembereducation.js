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
// Sessions live in the shared D.events calendar (type:'pledge'), same pattern as Social/
// Philanthropy/Community Service — so a scheduled session always matches what's on the
// Calendar, not a separate copy. Attendance for them is tracked the normal way, through the
// Attendance page (D.attendance keyed by event id), not a local per-session array.
function nmeSessions(){ return (D.events||[]).filter(e=>e.type==='pledge'); }

// ── Semester scoping — only the sessions/events view is date-range filtered, since "New
// Member" is a live memberStatus field, not a frozen semester cohort — once someone's
// initiated they naturally age out of nmeGetClass(), unlike Rushees.
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
  // VIEWER_PAGES (js/auth.js). The one exception is any member individually flagged isPeerMentor
  // (Settings → General Member Users, or Exec Users for an officer whose position doesn't already
  // grant this page), who gets this whole page — Peer Mentor Program included — via the
  // isPeerMentor overrides in getRoleAccess()/canEditPage(), not a change to any position config.
  const editActions=document.getElementById('nme-edit-actions');
  if(editActions)editActions.style.display=canEditNewMemberEducation()?'':'none';
  initSemesterSelect('nme-semester-select',nmeKnownSemesters(),nmeSemesterChanged,nmeSem());
  const addSessBtn=document.getElementById('nme-add-session-btn');
  if(addSessBtn)addSessBtn.style.display=(canEditNewMemberEducation()&&isCurrentSemester(nmeSem()))?'':'none';
  const sessions=nmeVisibleSessions();
  const newMembers=nmeGetClass();
  const today=localDateStr();
  const completedSessions=sessions.filter(s=>s.date&&s.date<today).length;

  document.getElementById('nme-kpi').innerHTML=
    statStrip('New Members',newMembers.length,'In program','neutral')+
    statStrip('Sessions Scheduled',sessions.length,completedSessions+' completed','neutral')+
    statStrip('Sessions Completed',completedSessions,sessions.length+' total','neutral');

  nmeRenderSessions();
  nmeRenderGradeChecks();
  nmeRenderPeerMentor();
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
      <td style="text-align:center">${lastGpa!==null?`<span class="gpa-badge ${gpaColor(lastGpa)}">${lastGpa.toFixed(2)}</span>`:'<span style="color:var(--ht)">N/A</span>'}</td>
      <td style="text-align:center;font-size:12px;font-weight:600;color:${below?'var(--rd)':'var(--gn)'}">${lastGpa!==null?(below?'<i class="ti ti-arrow-down" style="font-size:11px"></i> Below':'<i class="ti ti-check" style="font-size:11px"></i> Met'):'N/A'}</td>
      <td style="font-size:11px;color:var(--mt)">${last?fds(last.date):'Never'}</td>
      <td style="font-size:11px;font-weight:${days!==null&&days>7?'600':'400'};color:${days!==null&&days>7?'var(--rd)':'var(--mt)'}">${days!==null?days+'d ago':'N/A'}</td>
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
        :`<span style="color:var(--mt)">${s.notes?esc(s.notes):'N/A'}</span>`;
      return`<tr><td style="font-weight:500">${esc(s.title)}</td><td>${fds(s.date)}</td><td style="color:var(--mt)">${s.facilitatorId?esc(mB(s.facilitatorId).name):'N/A'}</td><td>${notesCell}</td>${canEdit?`<td style="display:flex;gap:4px;justify-content:flex-end"><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="nmeDeleteSession('${s.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`;
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

// ── SESSIONS ──
function nmeOpenAddSession(){
  if(!canEditNewMemberEducation()){toast('Only officers with New Member Education access can add sessions.','error');return;}
  if(!isCurrentSemester(nmeSem())){toast('This semester is read-only.','error');return;}
  document.getElementById('nmes-id').value='';
  document.getElementById('nmes-title').value='';
  document.getElementById('nmes-date').value=localDateStr();
  document.getElementById('nmes-facilitator').innerHTML='<option value="">None</option>'+mOpts();
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
  const ok=await confirmDialog('Delete Session',`Delete "${sess?sess.title:'this session'}"`+attNote+'?');
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

// ── PEER MENTOR PROGRAM — moved here from Committees (it used to just be a generic committee
// entry). Peer Mentors are ACTIVE members, not new members — new members get assigned INTO a
// mentor's group, not the other way around. Groups are deliberately rotating rather than fixed
// for the semester: nmePeerMentorRandomize() reshuffles which new members sit in which mentor's
// group while the mentor roster itself is untouched. A general member can additionally be
// granted view+edit on this page specifically via Settings' "Peer Mentor" checkbox
// (seTogglePeerMentor(), js/auth.js) without becoming a full officer — see getRoleAccess()/
// canEditPage()'s viewer-branch overrides there.
function nmeEnsurePeerMentor(){
  if(!D.newMemberEducation.peerMentor)D.newMemberEducation.peerMentor={program:[],mentorIds:[],assignments:{}};
  if(!D.newMemberEducation.peerMentor.program)D.newMemberEducation.peerMentor.program=[];
  if(!D.newMemberEducation.peerMentor.mentorIds)D.newMemberEducation.peerMentor.mentorIds=[];
  if(!D.newMemberEducation.peerMentor.assignments)D.newMemberEducation.peerMentor.assignments={};
}
function nmeRenderPeerMentor(){
  nmeEnsurePeerMentor();
  const pm=D.newMemberEducation.peerMentor;
  const canEdit=canEditNewMemberEducation();
  const importBtn=document.getElementById('nme-pm-import-btn');
  if(importBtn)importBtn.style.display=canEdit?'':'none';
  const randomBtn=document.getElementById('nme-pm-randomize-btn');
  if(randomBtn)randomBtn.style.display=canEdit?'':'none';

  // Mentors are drawn from Active members only. A stored id that no longer resolves to an
  // Active member (status changed, or removed from the roster) is dropped defensively at render
  // time, not mutated into saved state on every render.
  const activeMembers=sortedMembers().filter(m=>(m.memberStatus||'Active')==='Active');
  const mentorIds=pm.mentorIds.filter(id=>activeMembers.some(m=>m.id===id));
  const newMembers=nmeGetClass();

  const mentorsEl=document.getElementById('nme-pm-mentors');
  if(mentorsEl){
    const takenIds=new Set(mentorIds);
    const availOpts=activeMembers.filter(m=>!takenIds.has(m.id)).map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('');
    const rows=mentorIds.map(id=>{
      const m=mB(id);
      return`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr)">
        <div class="sh-av" style="width:24px;height:24px;font-size:8.5px;flex-shrink:0">${esc(m.initials)}</div>
        <span style="font-size:12.5px;font-weight:500;flex:1">${esc(m.name)}</span>
        ${canEdit?`<button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="nmeRemoveMentor('${id}')" aria-label="Remove ${esc(m.name)} as a Peer Mentor"><i class="ti ti-x"></i></button>`:''}
      </div>`;
    }).join('');
    const addRow=canEdit?`<div style="display:flex;align-items:center;gap:8px;padding:6px 0 0">
      <select id="nme-pm-mentor-sel" style="flex:1;min-width:0;height:30px;padding:0 8px;border:1px solid var(--bdr);border-radius:6px;font-size:12px;font-family:inherit;background:var(--surf);color:var(--tx)">
        <option value="" disabled selected>Add a Peer Mentor...</option>
        ${availOpts}
      </select>
      <button class="btn btn-p" style="height:30px;font-size:11px" onclick="nmeAddMentor(document.getElementById('nme-pm-mentor-sel').value)"><i class="ti ti-plus"></i>Add</button>
    </div>`:'';
    mentorsEl.innerHTML=(rows||`<div style="color:var(--ht);font-size:12px;padding:8px 0">No Peer Mentors assigned yet.</div>`)+addRow;
  }

  const groupsEl=document.getElementById('nme-pm-groups');
  if(groupsEl){
    const byMentor={};
    mentorIds.forEach(id=>{byMentor[id]=[];});
    const unassigned=[];
    newMembers.forEach(m=>{
      const mentorId=pm.assignments[m.id];
      if(mentorId&&byMentor[mentorId])byMentor[mentorId].push(m);
      else unassigned.push(m);
    });
    const moveSelect=(memberId,currentMentorId)=>canEdit?`<select style="height:26px;width:100%;margin-top:5px;font-size:10.5px;padding:0 6px;border:1px solid var(--bdr);border-radius:6px;background:var(--surf);color:var(--tx);font-family:inherit" onchange="nmeMoveNewMember('${memberId}',this.value)" aria-label="Move ${esc(mB(memberId).name)} to a different group">
      <option value="" ${!currentMentorId?'selected':''}>— Unassigned</option>
      ${mentorIds.map(id=>`<option value="${id}" ${id===currentMentorId?'selected':''}>${esc(mB(id).name)}</option>`).join('')}
    </select>`:'';
    // One mentee = full name on its own line, then class · major · hometown beneath it (whatever
    // is on file), then the move control. Nothing truncated except an over-long meta line.
    const menteeRow=(m,mentorId)=>{
      const meta=[m.classYear,m.major,m.hometown].map(x=>(x||'').trim()).filter(Boolean).join('  ·  ');
      return`<div style="padding:8px 0;border-top:1px solid var(--bdr)">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div class="sh-av" style="width:22px;height:22px;font-size:8px;flex-shrink:0;margin-top:1px">${esc(m.initials)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px;font-weight:500;line-height:1.35">${esc(m.name)}</div>
            <div style="font-size:10.5px;color:var(--mt);line-height:1.35;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(meta)||'No profile details on file'}</div>
            ${moveSelect(m.id,mentorId)}
          </div>
        </div>
      </div>`;
    };
    if(!mentorIds.length){
      groupsEl.innerHTML=`<div style="color:var(--ht);font-size:12px;padding:8px 0">Add at least one Peer Mentor above to start forming groups.</div>`;
    }else{
      const mentorCards=mentorIds.map(id=>{
        const mentor=mB(id);
        const group=byMentor[id]||[];
        return`<div class="card" style="margin:0;padding:12px 14px 14px">
          <div style="display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:2px solid var(--bdr)">
            <div class="sh-av" style="width:26px;height:26px;font-size:9px;flex-shrink:0">${esc(mentor.initials)}</div>
            <div style="flex:1;min-width:0"><div style="font-size:9.5px;font-weight:600;color:var(--mt);text-transform:uppercase;letter-spacing:.06em">Mentor</div><div style="font-size:13px;font-weight:600;line-height:1.2">${esc(mentor.name)}</div></div>
            <span class="badge bm2" style="flex-shrink:0">${group.length} mentee${group.length!==1?'s':''}</span>
          </div>
          ${group.length?group.map(m=>menteeRow(m,id)).join(''):`<div style="color:var(--ht);font-size:11.5px;padding:10px 0 2px">No new members in this group yet.</div>`}
        </div>`;
      }).join('');
      const unassignedCard=unassigned.length?`<div class="card" style="margin:0;padding:12px 14px 14px;border-style:dashed">
        <div style="display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:2px solid var(--bdr)">
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--ht)">Unassigned</div></div>
          <span class="badge br2" style="flex-shrink:0">${unassigned.length}</span>
        </div>
        ${unassigned.map(m=>menteeRow(m,'')).join('')}
      </div>`:'';
      groupsEl.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px">${mentorCards}${unassignedCard}</div>`;
    }
  }

  const progEl=document.getElementById('nme-pm-program-table');
  if(progEl){
    const program=[...pm.program].sort((a,b)=>a.week-b.week);
    progEl.innerHTML=program.length?`<thead><tr><th>Week</th><th>Topic</th><th>Notes</th></tr></thead><tbody>${
      program.map(w=>`<tr><td style="font-weight:500">${w.week}</td><td>${esc(w.topic)}</td><td style="color:var(--mt)">${esc(w.notes)||'N/A'}</td></tr>`).join('')
    }</tbody>`:`<tbody><tr><td>${es('ti-list-check','blue','No program imported yet','Use Import Program to add the Peer Mentor Program curriculum.','')}</td></tr></tbody>`;
  }
}
async function nmeAddMentor(memberId){
  if(!canEditNewMemberEducation()){toast('Only officers with New Member Education access can manage Peer Mentors.','error');return;}
  if(!memberId)return;
  nmeEnsurePeerMentor();
  const pm=D.newMemberEducation.peerMentor;
  if(pm.mentorIds.includes(memberId))return;
  pm.mentorIds.push(memberId);
  try{
    await saveD('newMemberEducation');
    nmeRenderPeerMentor();
    toast('Peer Mentor added','success');
  }catch(e){
    pm.mentorIds=pm.mentorIds.filter(id=>id!==memberId);
    nmeRenderPeerMentor();
    toast('Failed to add Peer Mentor. Please try again.','error');
  }
}
async function nmeRemoveMentor(memberId){
  if(!canEditNewMemberEducation())return;
  nmeEnsurePeerMentor();
  const pm=D.newMemberEducation.peerMentor;
  const hadIdx=pm.mentorIds.indexOf(memberId);
  if(hadIdx<0)return;
  const prevAssignments={...pm.assignments};
  pm.mentorIds.splice(hadIdx,1);
  // Anyone assigned to the removed mentor becomes unassigned rather than silently orphaned in
  // saved state — nmeRenderPeerMentor()'s render-time filter would treat them as unassigned
  // regardless, but clearing the stored assignment keeps the saved data itself honest.
  Object.keys(pm.assignments).forEach(mid=>{ if(pm.assignments[mid]===memberId)delete pm.assignments[mid]; });
  try{
    await saveD('newMemberEducation');
    nmeRenderPeerMentor();
    toast('Peer Mentor removed','info');
  }catch(e){
    pm.mentorIds.splice(hadIdx,0,memberId);
    pm.assignments=prevAssignments;
    nmeRenderPeerMentor();
    toast('Failed to remove Peer Mentor. Please try again.','error');
  }
}
async function nmeMoveNewMember(newMemberId,mentorId){
  if(!canEditNewMemberEducation())return;
  nmeEnsurePeerMentor();
  const pm=D.newMemberEducation.peerMentor;
  const prev=pm.assignments[newMemberId];
  if(mentorId)pm.assignments[newMemberId]=mentorId;
  else delete pm.assignments[newMemberId];
  try{
    await saveD('newMemberEducation');
    nmeRenderPeerMentor();
  }catch(e){
    if(prev)pm.assignments[newMemberId]=prev;
    else delete pm.assignments[newMemberId];
    nmeRenderPeerMentor();
    toast('Failed to move member. Please try again.','error');
  }
}
async function nmePeerMentorRandomize(){
  if(!canEditNewMemberEducation()){toast('Only officers with New Member Education access can manage Peer Mentors.','error');return;}
  nmeEnsurePeerMentor();
  const pm=D.newMemberEducation.peerMentor;
  const mentorIds=pm.mentorIds.filter(id=>{const m=D.members.find(x=>x.id===id);return m&&(m.memberStatus||'Active')==='Active';});
  if(!mentorIds.length){toast('Add at least one Peer Mentor before randomizing groups.','error');return;}
  const newMembers=nmeGetClass();
  if(!newMembers.length){toast('No new members to assign yet.','error');return;}
  const ok=await confirmDialog('Randomize Groups',`Shuffle all ${newMembers.length} new member${newMembers.length!==1?'s':''} across the ${mentorIds.length} current Peer Mentor${mentorIds.length!==1?'s':''}? This replaces every existing group assignment.`,'Randomize',false);
  if(!ok)return;
  const prevAssignments={...pm.assignments};
  // Fisher-Yates shuffle of the NEW MEMBERS only — mentors stay exactly as configured. Round-
  // robin over the shuffled list keeps group sizes as even as possible (at most 1 apart).
  const shuffled=[...newMembers];
  for(let i=shuffled.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  const assignments={};
  shuffled.forEach((m,i)=>{ assignments[m.id]=mentorIds[i%mentorIds.length]; });
  pm.assignments=assignments;
  try{
    await saveD('newMemberEducation');
    nmeRenderPeerMentor();
    toast('Groups randomized','success');
  }catch(e){
    pm.assignments=prevAssignments;
    nmeRenderPeerMentor();
    toast('Failed to save randomized groups. Please try again.','error');
  }
}

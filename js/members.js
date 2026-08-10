// ── MEMBER CRUD ──
function canEditMembers(){
  return canEditPage('members');
}

async function addMem(){
  if(!canEditMembers()){toast('Only the President, Vice President, and Secretary can add members.','error');return;}
  const name=document.getElementById('nm-n').value.trim();
  if(!name){toast('Name is required','error');return;}
  const ini=name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  const member={id:uid(),name,year:+document.getElementById('nm-y').value,classYear:document.getElementById('nm-c').value,liveIn:document.getElementById('nm-l').value==='1',memberStatus:document.getElementById('nm-status').value,joinDate:document.getElementById('nm-join').value||'',role:document.getElementById('nm-r').value.trim()||'Member',major:document.getElementById('nm-maj').value.trim(),email:document.getElementById('nm-email').value.trim(),phone:document.getElementById('nm-phone').value.trim(),hometown:document.getElementById('nm-ht').value.trim(),initials:ini};
  D.members.push(member);
  try{
    await saveD('members');
    closeM(null,document.getElementById('m-addmember'));
    ['nm-n','nm-r','nm-maj','nm-email','nm-phone','nm-ht','nm-join'].forEach(id=>document.getElementById(id).value='');
    renderMembers();toast('Member added','success');
  }catch(e){
    D.members=D.members.filter(m=>m.id!==member.id);
    toast('Failed to add member. Please try again.','error');
  }
}
function openEditMember(id){
  if(!canEditMembers()){toast('Only the President, Vice President, and Secretary can edit members.','error');return;}
  const m=D.members.find(m=>m.id===id);if(!m)return;
  const el=document.getElementById('m-editmember');
  document.getElementById('em-id').value=id;
  document.getElementById('em-n').value=m.name;
  document.getElementById('em-y').value=m.year;
  document.getElementById('em-c').value=m.classYear;
  document.getElementById('em-l').value=m.liveIn?'1':'0';
  document.getElementById('em-status').value=m.memberStatus||'Active';
  document.getElementById('em-join').value=m.joinDate||'';
  const roleSel=document.getElementById('em-r');
  const roleOpts=['Member',...chapterPositionTitles()];
  // If this member's stored role doesn't match any real position (e.g. legacy free-text data
  // from before this was a dropdown), add it as a one-off extra option so opening Edit doesn't
  // silently switch them to a different value — the lead still sees exactly what's stored and
  // can correct it to a real position from the dropdown.
  const extra=(m.role&&!roleOpts.includes(m.role))?[m.role]:[];
  roleSel.innerHTML=[...roleOpts,...extra].map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  roleSel.value=m.role||'Member';
  document.getElementById('em-maj').value=m.major||'';
  document.getElementById('em-email').value=m.email||'';
  document.getElementById('em-phone').value=m.phone||'';
  document.getElementById('em-ht').value=m.hometown||'';
  el.classList.add('open');
}
async function saveMember(){
  if(!canEditMembers()){toast('Only the President, Vice President, and Secretary can edit members.','error');return;}
  const id=document.getElementById('em-id').value;
  const m=D.members.find(m=>m.id===id);if(!m)return;
  const name=document.getElementById('em-n').value.trim();
  if(!name){toast('Name is required','error');return;}
  const prev={name:m.name,year:m.year,classYear:m.classYear,liveIn:m.liveIn,memberStatus:m.memberStatus,joinDate:m.joinDate,role:m.role,initials:m.initials,major:m.major,email:m.email,phone:m.phone,hometown:m.hometown};
  m.name=name;m.year=+document.getElementById('em-y').value;
  m.classYear=document.getElementById('em-c').value;m.liveIn=document.getElementById('em-l').value==='1';
  m.memberStatus=document.getElementById('em-status').value;
  m.joinDate=document.getElementById('em-join').value||'';
  m.role=document.getElementById('em-r').value;
  m.major=document.getElementById('em-maj').value.trim();
  m.email=document.getElementById('em-email').value.trim();
  m.phone=document.getElementById('em-phone').value.trim();
  m.hometown=document.getElementById('em-ht').value.trim();
  m.initials=name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  try{
    await saveD('members');
    closeM(null,document.getElementById('m-editmember'));renderMembers();toast('Member saved','success');
  }catch(e){
    Object.assign(m,prev);
    toast('Failed to save member. Please try again.','error');
  }
}
async function deleteMember(id){
  if(!canEditMembers()){toast('Only the President, Vice President, and Secretary can remove members.','error');return;}
  const ok=await confirmDialog('Remove Member','Are you sure you want to remove this member? This cannot be undone.');
  if(!ok)return;

  // Snapshot everything this cascade touches so a failed save can roll back cleanly.
  const snapshot={
    members:[...D.members],
    dues:D.finance.dues[id],
    nationalDues:D.finance.nationalDues[id],
    attendance:JSON.parse(JSON.stringify(D.attendance)),
    committees:JSON.parse(JSON.stringify(D.committees)),
    committeeLeaders:[...D.committeeLeaders],
    recruitment:JSON.parse(JSON.stringify(D.recruitment)),
    kcrew:JSON.parse(JSON.stringify(D.kcrew)),
    shifts:JSON.parse(JSON.stringify(D.shifts)),
    newMemberEducation:JSON.parse(JSON.stringify(D.newMemberEducation)),
    gpas:D.academics.gpas?.[id],
    nmCheckins:D.academics.nmCheckins?.[id],
    nmeProgress:D.newMemberEducation.progress?.[id],
  };

  D.members=D.members.filter(m=>m.id!==id);

  // Cascade: clear live balance/assignment references to the removed member so they don't
  // become dangling ("ghost") entries — e.g. a permanent outstanding-dues balance, or a
  // committee chair that no longer exists. Historical transaction records (fines, payments,
  // payment plans) are intentionally left as-is: mB() already resolves a missing member id
  // to "Unknown" gracefully for display, and deleting real financial history on member
  // removal would destroy an audit trail for no real benefit.
  // Only the CURRENT semester's dues slot is cleared — dues is now semester-keyed
  // ({[semester]: {...}}), and past semesters' frozen entries are historical record just like
  // fines/payments, not a live balance that needs clearing.
  if(D.finance.dues[id])delete D.finance.dues[id][getSemester()];
  delete D.finance.nationalDues[id];
  Object.keys(D.attendance).forEach(evId=>{ delete D.attendance[evId][id]; });
  D.committees.forEach(c=>{
    if(c.chair===id)c.chair=null;
    c.roster=(c.roster||[]).filter(r=>r.memberId!==id);
    c.members=(c.members||[]).filter(m=>m!==id);
  });
  if(typeof coRecomputeLeaders==='function')coRecomputeLeaders();
  (D.recruitment.rushees||[]).forEach(r=>{ if(r.recruiter===id)r.recruiter=null; });
  (D.recruitment.events||[]).forEach(e=>{ e.recruiters=(e.recruiters||[]).filter(r=>r!==id); });
  ['lunch','dinner'].forEach(meal=>{
    const sched=D.kcrew.schedule?.[meal];
    if(sched)Object.keys(sched).forEach(day=>{ sched[day]=(sched[day]||[]).filter(m=>m!==id); });
  });
  (D.shifts.weekends||[]).forEach(w=>{
    Object.values(w.days||{}).forEach(day=>{
      if(day.memberIds)day.memberIds=day.memberIds.map(m=>m===id?null:m);
      if(day.pledgeIds)day.pledgeIds=(day.pledgeIds||[]).filter(m=>m!==id);
    });
  });
  // Same id-keyed-map shape as finance.dues/nationalDues above — cleared for consistency (was
  // previously left dangling, a quiet storage leak rather than a display bug since these are
  // only ever read per live roster member, not iterated independently).
  if(D.academics.gpas)delete D.academics.gpas[id];
  if(D.academics.nmCheckins)delete D.academics.nmCheckins[id];
  if(D.newMemberEducation.progress)delete D.newMemberEducation.progress[id];

  try{
    // saveD's writeBatch is atomic across every key passed to it — bundling all cascade keys
    // unconditionally meant this whole delete was denied for anyone without simultaneous edit
    // grants on attendance/committees/recruitment/kcrew/sober/newMemberEducation/academics, which
    // in practice is only a lead. A Secretary with just members:'edit' (the position this button
    // is meant for) could never actually delete a member. Each key is only included if this
    // caller's grant actually covers it (canEditPage() also passes for a lead bypass); skipped
    // keys leave that collection's in-memory cleanup un-persisted — the next realtime snapshot
    // just resyncs it from the server, so it's a transient, harmless no-op rather than a
    // rollback case. Tasks aren't touched by this cascade at all — task.assignedTo is a
    // delegating position, not a member id, so a deleted member never leaves a dangling
    // reference there.
    const keys=['members'];
    if(canEditPage('attendance'))keys.push('attendance');
    if(canEditPage('committees'))keys.push('committees','committeeLeaders');
    if(canEditPage('recruitment'))keys.push('recruitment');
    if(canEditPage('kcrew'))keys.push('kcrew');
    if(canEditPage('sober'))keys.push('shifts');
    if(canEditPage('newMemberEducation'))keys.push('newMemberEducation');
    if(canEditPage('academics'))keys.push('academics');

    // finance's two collections live outside FS_KEYS (see js/data.js) so they're saved
    // separately here — not part of the one atomic saveD() batch above. Same permission gate
    // as the cascade keys above: only attempted if this caller actually has a finance grant.
    // saveFinanceDues (not deleteFinanceDuesDoc) — the doc now holds every semester's history
    // for this member, only the current semester's slot was cleared above, so this UPDATES the
    // doc rather than deleting it outright.
    const financeCalls=canEditPage('finance')?[saveFinanceDues(id),saveFinanceLedger()]:[];

    await Promise.all([saveD(...keys), ...financeCalls]);
    // committeeRsvps lives outside D entirely (its own Firestore collection, see js/committees.js)
    // so it's cleaned up separately here rather than via the snapshot/rollback pattern above —
    // best-effort, never blocks or rolls back the member removal that already committed.
    if(typeof coDeleteRsvpsForMember==='function')coDeleteRsvpsForMember(id);
    closeM(null,document.getElementById('m-editmember'));renderMembers();toast('Member removed','info');
  }catch(e){
    D.members=snapshot.members;
    D.finance.dues[id]=snapshot.dues;
    D.finance.nationalDues[id]=snapshot.nationalDues;
    D.attendance=snapshot.attendance;
    D.committees=snapshot.committees;
    D.committeeLeaders=snapshot.committeeLeaders;
    D.recruitment=snapshot.recruitment;
    D.kcrew=snapshot.kcrew;
    D.shifts=snapshot.shifts;
    D.newMemberEducation=snapshot.newMemberEducation;
    if(snapshot.gpas!==undefined){if(!D.academics.gpas)D.academics.gpas={};D.academics.gpas[id]=snapshot.gpas;}
    if(snapshot.nmCheckins!==undefined){if(!D.academics.nmCheckins)D.academics.nmCheckins={};D.academics.nmCheckins[id]=snapshot.nmCheckins;}
    if(snapshot.nmeProgress!==undefined){if(!D.newMemberEducation.progress)D.newMemberEducation.progress={};D.newMemberEducation.progress[id]=snapshot.nmeProgress;}
    toast('Failed to remove member. Please try again.','error');
  }
}


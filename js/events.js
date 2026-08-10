// A committee's Chair can write events for their own committee even without Calendar page
// access (see firestore.rules' isCommitteeLeader) — canEditCommittee() is defined in
// js/committees.js, guarded here since load order only guarantees infra files load first.
function canEditEventForCommittee(committeeId){
  if(!committeeId)return false;
  if(typeof canEditCommittee!=='function')return false;
  const c=D.committees.find(c=>c.id===committeeId);
  return c?canEditCommittee(c):false;
}
// Committee events are edited/deleted through this generic, module-agnostic CRUD (also used by
// the un-partitioned main Calendar page) rather than a dedicated per-module wrapper — so the
// semester read-only lock has to reach in here instead. Scoped narrowly: only applies when the
// event belongs to the committee workspace CURRENTLY open in js/committees.js, so it can never
// affect the Calendar page or any other committee's events.
function coEventSemesterOk(ev){
  if(!ev?.committeeId)return true;
  if(typeof CO_CURRENT_ID==='undefined'||ev.committeeId!==CO_CURRENT_ID)return true;
  if(typeof isCurrentSemester!=='function'||typeof coSem!=='function')return true;
  return isCurrentSemester(coSem());
}

// ── EVENT CRUD ──
// Data-in core for CREATING an event, with no DOM reads — kept separate from the New Event
// modal's own DOM handling so the permission check and save/rollback logic live in one place.
// Edit is NOT covered here — addEv() below still owns that branch directly. Throws an Error with
// .code ('PERMISSION_DENIED'|'VALIDATION'|'SAVE_FAILED') so callers can distinguish failure kinds.
async function addEvCore({title, type='chapter', date, endDate=null, start='', endTime='', location='', mandatory=false, committeeId=null}){
  if(!canEditPage('calendar')&&!canEditEventForCommittee(committeeId)){
    const e=new Error("Only officers with Calendar access (or this committee's Chair) can add events.");e.code='PERMISSION_DENIED';throw e;
  }
  const trimmedTitle=(title||'').trim();
  if(!trimmedTitle){const e=new Error('Title is required');e.code='VALIDATION';throw e;}
  if(endDate&&date&&endDate<date){const e=new Error("End date can't be before the start date.");e.code='VALIDATION';throw e;}
  if(endTime&&start&&!endDate&&endTime<=start){const e=new Error('End time must be after the start time.');e.code='VALIDATION';throw e;}
  const ev={id:uid(),title:trimmedTitle,type,date,endDate:endDate||null,start,endTime:endTime||'',location,mandatory:!!mandatory,committeeId};
  D.events.push(ev);
  try{
    await saveD('events');
    renderCalendar();renderAttendance();renderDash();
    if(committeeId&&typeof coOnEventsChanged==='function')coOnEventsChanged(committeeId);
    return ev;
  }catch(e){
    D.events=D.events.filter(x=>x.id!==ev.id);
    e.code=e.code||'SAVE_FAILED';
    throw e;
  }
}

async function addEv(){
  const committeeId=document.getElementById('ne-committee-id')?.value||null;
  if(!canEditPage('calendar')&&!canEditEventForCommittee(committeeId)){toast('Only officers with Calendar access (or this committee\'s Chair) can add events.','error');return;}
  const title=document.getElementById('ne-t').value.trim();
  if(!title){toast('Title is required','error');return;}
  const date=document.getElementById('ne-d').value;
  const endDateRaw=document.getElementById('ne-ed')?.value||'';
  if(endDateRaw&&endDateRaw<date){toast('End date can\'t be before the start date.','error');return;}
  const endDate=endDateRaw&&endDateRaw>date?endDateRaw:null;
  const startRaw=document.getElementById('ne-st').value;
  const endTimeRaw=document.getElementById('ne-et').value;
  // Only comparable when the event doesn't already span multiple days — an end time on a later
  // calendar day can validly be "earlier" on the clock than the start time.
  if(endTimeRaw&&startRaw&&!endDate&&endTimeRaw<=startRaw){toast('End time must be after the start time.','error');return;}
  const editId=document.getElementById('ne-edit-id')?.value;
  if(editId){
    const ev=D.events.find(e=>e.id===editId);
    if(!ev){toast('Event not found.','error');return;}
    if(!canEditPage('calendar')&&!canEditEventForCommittee(ev.committeeId)){toast('You do not have permission to edit this event.','error');return;}
    if(!coEventSemesterOk(ev)){toast('This event is in a past semester and is read-only.','error');return;}
    const prev={title:ev.title,type:ev.type,date:ev.date,endDate:ev.endDate,start:ev.start,endTime:ev.endTime,location:ev.location,mandatory:ev.mandatory};
    ev.title=title;ev.type=document.getElementById('ne-tp').value;ev.date=date;ev.endDate=endDate;ev.start=document.getElementById('ne-st').value;ev.endTime=document.getElementById('ne-et').value;ev.location=document.getElementById('ne-l').value;ev.mandatory=document.getElementById('ne-m').value==='1';
    document.getElementById('ne-edit-id').value='';
    try{
      await saveD('events');
      closeM(null,document.getElementById('m-addevent'));renderCalendar();renderAttendance();renderDash();
      if(ev.committeeId&&typeof coOnEventsChanged==='function')coOnEventsChanged(ev.committeeId);
      toast('Event updated','success');
    }catch(e){
      Object.assign(ev,prev);document.getElementById('ne-edit-id').value=editId;
      toast('Failed to save event. Please try again.','error');
    }
    return;
  }
  try{
    await addEvCore({
      title, type:document.getElementById('ne-tp').value, date, endDate,
      start:document.getElementById('ne-st').value, endTime:document.getElementById('ne-et').value,
      location:document.getElementById('ne-l').value,
      mandatory:document.getElementById('ne-m').value==='1', committeeId,
    });
    closeM(null,document.getElementById('m-addevent'));document.getElementById('ne-t').value='';
    toast('Event created','success');
  }catch(e){
    toast(e.code==='PERMISSION_DENIED'||e.code==='VALIDATION' ? e.message : 'Failed to create event: '+(e.code||e.message||'unknown'),'error',8000);
  }
}
function openEditEvent(id){
  const ev=D.events.find(e=>e.id===id);if(!ev)return;
  if(!canEditPage('calendar')&&!canEditEventForCommittee(ev.committeeId)){toast('You do not have permission to edit this event.','error');return;}
  if(!coEventSemesterOk(ev)){toast('This event is in a past semester and is read-only.','error');return;}
  const m=document.getElementById('m-addevent');
  m.querySelector('.md-t').childNodes[0].textContent='Edit Event';
  document.getElementById('ne-t').value=ev.title;
  document.getElementById('ne-tp').value=ev.type||'chapter';
  document.getElementById('ne-d').value=ev.date;
  if(document.getElementById('ne-ed'))document.getElementById('ne-ed').value=ev.endDate||'';
  document.getElementById('ne-st').value=ev.start||'';
  if(document.getElementById('ne-et'))document.getElementById('ne-et').value=ev.endTime||'';
  document.getElementById('ne-l').value=ev.location||'';
  document.getElementById('ne-m').value=ev.mandatory?'1':'0';
  if(document.getElementById('ne-edit-id'))document.getElementById('ne-edit-id').value=id;
  if(document.getElementById('ne-committee-id'))document.getElementById('ne-committee-id').value=ev.committeeId||'';
  m.classList.add('open');
}
async function deleteEvent(id){
  const ev=D.events.find(e=>e.id===id);
  if(!canEditPage('calendar')&&!canEditEventForCommittee(ev?.committeeId)){toast('You do not have permission to delete this event.','error');return;}
  if(!coEventSemesterOk(ev)){toast('This event is in a past semester and is read-only.','error');return;}
  const attNote=canEditPage('attendance')?' Attendance records for it will also be removed.':'';
  const ok=await confirmDialog('Delete Event','Delete this event?'+attNote);
  if(!ok)return;
  const removed=D.events.find(e=>e.id===id);
  const removedAtt=D.attendance[id];
  // Social planning (venue/vendor/budget) is a per-event working document, not a historical
  // record like a fundraising log or hours entry — with no event left to plan for, it's just
  // dead weight sitting in the whole-document social blob forever, so it's cleared here too.
  const removedPlanning=D.social?.planning?.[id];
  // A Bible Study session's linked calendar event (bscSyncScheduleEvent, js/biblestudy.js) can be
  // deleted straight from the Calendar rather than through the Bible Study Hub, which has no
  // "unschedule" action of its own — without this, the curriculum chapter is left pointing at a
  // scheduledEventId that no longer exists and keeps showing as "Scheduled" for a date that's no
  // longer on the calendar.
  let bscChapterToUnschedule=null,bscPrev=null;
  if(removed?.type==='faith'&&removed.faithCategory==='bible_study'&&typeof bscChapters==='function'){
    bscChapterToUnschedule=bscChapters().find(c=>c.scheduledEventId===id)||null;
    if(bscChapterToUnschedule){
      bscPrev={status:bscChapterToUnschedule.status,scheduledAt:bscChapterToUnschedule.scheduledAt,scheduledEventId:bscChapterToUnschedule.scheduledEventId};
    }
  }
  D.events=D.events.filter(e=>e.id!==id);
  delete D.attendance[id];
  if(D.social?.planning)delete D.social.planning[id];
  const canUnscheduleBibleStudy=bscChapterToUnschedule&&(isLeadUser()||canEditPage('ritual'));
  if(canUnscheduleBibleStudy){
    if(bscChapterToUnschedule.status==='scheduled')bscChapterToUnschedule.status='not_started';
    bscChapterToUnschedule.scheduledAt=null;
    bscChapterToUnschedule.scheduledEventId=null;
  }
  // Only bundle 'attendance'/'social'/'bibleStudyCurriculum' into the same batch if this user's
  // grant actually covers them — saveD's writeBatch is atomic, so including a key the caller
  // can't write (e.g. Chaplain, who has calendar:'edit' but not attendance:'edit') makes
  // Firestore deny the WHOLE batch, including the 'events' delete they were actually authorized
  // to do.
  const keys=['events'];
  if(canEditPage('attendance'))keys.push('attendance');
  if(canEditPage('social'))keys.push('social');
  if(canUnscheduleBibleStudy)keys.push('bibleStudyCurriculum');
  try{
    await saveD(...keys);
    if(typeof coDeleteRsvpsForEvent==='function')coDeleteRsvpsForEvent(id);
    document.getElementById('cal-detail').style.display='none';
    renderCalendar();renderAttendance();renderDash();
    if(removed?.committeeId&&typeof coOnEventsChanged==='function')coOnEventsChanged(removed.committeeId);
    toast('Event deleted','info');
  }catch(e){
    if(removed)D.events.push(removed);
    if(removedAtt)D.attendance[id]=removedAtt;
    if(removedPlanning&&D.social?.planning)D.social.planning[id]=removedPlanning;
    if(canUnscheduleBibleStudy&&bscPrev)Object.assign(bscChapterToUnschedule,bscPrev);
    toast('Failed to delete event. Please try again.','error');
  }
}

// A committee's Chair can write tasks for their own committee even without Tasks page access
// (see firestore.rules' isCommitteeLeader) — mirrors canEditEventForCommittee above.
function canEditTaskForCommittee(committeeId){
  if(!committeeId)return false;
  if(typeof canEditCommittee!=='function')return false;
  const c=D.committees.find(c=>c.id===committeeId);
  return c?canEditCommittee(c):false;
}

// ── TASK CRUD ──
// Data-in core for creating a task, no DOM reads — kept separate from the New Task modal's own
// DOM handling so the permission check and save/rollback logic live in one place. "Assigned By"
// is never a caller-supplied choice — it's always whichever position the confirming officer's own
// account holds. Throws an Error with .code ('PERMISSION_DENIED'|'VALIDATION'|'SAVE_FAILED') so
// callers can distinguish failure kinds.
// status defaults to 'todo' — the Kanban board's column ids are todo/in_progress/done/
// cant_complete (same vocabulary the manual New Task modal's Status <select> uses); anything else
// renders in none of the board's columns even though the task exists in the data.
async function addTaskCore({title, positionTitle=null, priority, status='todo', dueDate, desc='', committeeId=null}){
  if(!canEditPage('tasks')&&!canEditTaskForCommittee(committeeId)){
    const e=new Error('You do not have permission to add tasks.');e.code='PERMISSION_DENIED';throw e;
  }
  const trimmedTitle=(title||'').trim();
  if(!trimmedTitle){const e=new Error('Title is required');e.code='VALIDATION';throw e;}
  const assignedTo=CURRENT_USER?.title||null;
  // positionTitle is optional on this core function, but canSeePositionGroup() treats a null
  // position as lead-only visible — so an unresolved position would silently make a task
  // invisible to the very officer who just created it. Default to the confirming officer's own
  // position so this invariant (every task has a real position) holds for every caller.
  const resolvedPositionTitle=positionTitle||assignedTo;
  const task={id:uid(),title:trimmedTitle,assignedTo,positionTitle:resolvedPositionTitle,priority,status,dueDate,desc,committeeId,semester:getSemester()};
  D.tasks.push(task);
  try{
    await saveD('tasks');
    renderTasks();renderDash();
    if(committeeId&&typeof coOnTasksChanged==='function')coOnTasksChanged(committeeId);
    return task;
  }catch(e){
    D.tasks=D.tasks.filter(t=>t.id!==task.id);
    e.code=e.code||'SAVE_FAILED';
    throw e;
  }
}

async function addTask(){
  const committeeId=document.getElementById('nt-committee-id')?.value||null;
  try{
    await addTaskCore({
      title:document.getElementById('nt-t').value,
      positionTitle:document.getElementById('nt-position')?.value||null,
      priority:document.getElementById('nt-p').value,
      status:document.getElementById('nt-s').value,
      dueDate:document.getElementById('nt-d').value,
      desc:document.getElementById('nt-ds').value,
      committeeId,
    });
    closeM(null,document.getElementById('m-addtask'));document.getElementById('nt-t').value='';
    toast('Task created','success');
  }catch(e){
    toast(e.code==='PERMISSION_DENIED'||e.code==='VALIDATION' ? e.message : 'Failed to create task. Please try again.','error');
  }
}
async function addGoal(){
  if(!canEditPage('tasks')){toast('You do not have permission to add goals.','error');return;}
  const title=document.getElementById('ng-t').value.trim();
  if(!title){toast('Title is required','error');return;}
  const positionTitle=document.getElementById('ng-position')?.value||null;
  if(!isLeadUser()&&!myPositionTitles().includes(positionTitle)){
    toast('You can only add goals under your own position.','error');return;
  }
  const goal={id:uid(),title,positionTitle,target:+document.getElementById('ng-tg').value,current:+document.getElementById('ng-cu').value,unit:document.getElementById('ng-u').value,semester:getSemester()};
  D.goals.push(goal);
  try{
    await saveD('goals');
    closeM(null,document.getElementById('m-addgoal'));document.getElementById('ng-t').value='';renderTasks();toast('Goal added','success');
  }catch(e){
    D.goals=D.goals.filter(g=>g.id!==goal.id);
    toast('Failed to add goal. Please try again.','error');
  }
}
// Full control (edit details, delete) belongs to whoever created/delegated the task — the
// position recorded as "Assigned By" — or a lead, or (for committee tasks) the committee's own
// editor channel. The position the task is actually "Assigned To" can view it and still update
// its status (toggle/drag), but can no longer edit its details or delete it.
function taskFullControl(t){
  return (canEditPage('tasks')||canEditTaskForCommittee(t.committeeId))&&ownsPositionRecord(t.assignedTo);
}
function taskCanViewOrStatus(t){
  return taskFullControl(t)||((canEditPage('tasks')||canEditTaskForCommittee(t.committeeId))&&ownsPositionRecord(t.positionTitle));
}
function toggleTask(id){
  const t=D.tasks.find(t=>t.id===id);if(!t)return;
  if(!taskCanViewOrStatus(t)){toast('You do not have permission to update tasks.','error');return;}
  if(t.semester&&!isCurrentSemester(t.semester)){toast('This task is in a past semester and is read-only.','error');return;}
  t.status=t.status==='done'?'todo':'done';saveD('tasks');renderDash();renderTasks();
  if(t.committeeId&&typeof coOnTasksChanged==='function')coOnTasksChanged(t.committeeId);
}

// ── Task board drag-and-drop — used by the Tasks & Goals board (js/calendar.js renderTasks()),
// same permission rules as toggleTask()/openEditTask() above so dragging can't do anything a
// click couldn't.
let TASK_DRAG_ID=null;
function canDragTask(t){
  if(!taskCanViewOrStatus(t))return false;
  if(t.semester&&!isCurrentSemester(t.semester))return false;
  return true;
}
function taskDragStart(id){TASK_DRAG_ID=id;}
function taskDrop(event,status){
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const id=TASK_DRAG_ID;TASK_DRAG_ID=null;
  if(!id)return;
  const t=D.tasks.find(t=>t.id===id);if(!t)return;
  if(!canDragTask(t)){toast('You do not have permission to move this task.','error');return;}
  if(t.status===status)return;
  t.status=status;saveD('tasks');renderDash();renderTasks();
  if(t.committeeId&&typeof coOnTasksChanged==='function')coOnTasksChanged(t.committeeId);
}
function openEditTask(id){
  const t=D.tasks.find(t=>t.id===id);if(!t)return;
  if(!taskCanViewOrStatus(t)){toast('You do not have permission to view this task.','error');return;}
  if(t.semester&&!isCurrentSemester(t.semester)){toast('This task is in a past semester and is read-only.','error');return;}
  const canFullEdit=taskFullControl(t);
  const el=document.getElementById('m-edittask');
  const posSel=document.getElementById('et-position');
  if(posSel){
    const posOpts=(isLeadUser()?chapterPositionTitles():myPositionTitles()).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
    posSel.innerHTML=isLeadUser()?('<option value="">— Unassigned —</option>'+posOpts):posOpts;
  }
  document.getElementById('et-id').value=id;
  document.getElementById('et-t').value=t.title;
  document.getElementById('et-a').value=t.assignedTo||'';
  if(posSel)posSel.value=t.positionTitle||'';
  document.getElementById('et-p').value=t.priority;
  document.getElementById('et-d').value=t.dueDate||'';
  document.getElementById('et-s').value=t.status;
  document.getElementById('et-ds').value=t.desc||'';
  // View-only for whoever the task is Assigned To (but isn't also the creator/lead) — they can
  // see everything here but can't change details or delete; status updates still go through the
  // board's checkbox/drag, not this modal, so nothing here needs a partial-save exception.
  ['et-t','et-position','et-p','et-d','et-s','et-ds'].forEach(fid=>{
    const f=document.getElementById(fid); if(f)f.disabled=!canFullEdit;
  });
  const saveBtn=document.getElementById('et-save-btn'); if(saveBtn)saveBtn.style.display=canFullEdit?'':'none';
  const delBtn=document.getElementById('et-delete-btn'); if(delBtn)delBtn.style.display=canFullEdit?'':'none';
  const note=document.getElementById('et-view-only-note'); if(note)note.style.display=canFullEdit?'none':'';
  el.classList.add('open');
}
async function saveTask(){
  const id=document.getElementById('et-id').value;
  const t=D.tasks.find(t=>t.id===id);if(!t)return;
  if(!taskFullControl(t)){toast('You do not have permission to edit tasks.','error');return;}
  if(t.semester&&!isCurrentSemester(t.semester)){toast('This task is in a past semester and is read-only.','error');return;}
  const title=document.getElementById('et-t').value.trim();
  if(!title){toast('Title is required','error');return;}
  const newPositionTitle=document.getElementById('et-position')?.value||null;
  // assignedTo ("Assigned By") is never touched here — it's an immutable record of who created
  // the task, stamped once by addTask(), same as semester.
  const prev={title:t.title,positionTitle:t.positionTitle,priority:t.priority,dueDate:t.dueDate,status:t.status,desc:t.desc};
  t.title=title;
  t.positionTitle=newPositionTitle;
  t.priority=document.getElementById('et-p').value;t.dueDate=document.getElementById('et-d').value;
  t.status=document.getElementById('et-s').value;t.desc=document.getElementById('et-ds').value;
  try{
    await saveD('tasks');
    closeM(null,document.getElementById('m-edittask'));renderTasks();renderDash();
    if(t.committeeId&&typeof coOnTasksChanged==='function')coOnTasksChanged(t.committeeId);
    toast('Task saved','success');
  }catch(e){
    Object.assign(t,prev);
    toast('Failed to save task. Please try again.','error');
  }
}
async function deleteTask(id){
  const existing=D.tasks.find(t=>t.id===id);
  if(!existing||!taskFullControl(existing)){toast('You do not have permission to delete tasks.','error');return;}
  if(existing?.semester&&!isCurrentSemester(existing.semester)){toast('This task is in a past semester and is read-only.','error');return;}
  const ok=await confirmDialog('Delete Task','Are you sure you want to delete this task? This cannot be undone.');
  if(!ok)return;
  const removed=D.tasks.find(t=>t.id===id);
  D.tasks=D.tasks.filter(t=>t.id!==id);
  try{
    await saveD('tasks');
    closeM(null,document.getElementById('m-edittask'));renderTasks();renderDash();
    if(removed?.committeeId&&typeof coOnTasksChanged==='function')coOnTasksChanged(removed.committeeId);
    toast('Task deleted','info');
  }catch(e){
    if(removed)D.tasks.push(removed);
    toast('Failed to delete task. Please try again.','error');
  }
}

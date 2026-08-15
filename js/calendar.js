// ── CALENDAR STATE ──
let CAL_YEAR=new Date().getFullYear(), CAL_MONTH=new Date().getMonth();
let CAL_FILTER='all';

// Multi-day events (e.g. a 2-day Formal) stay ONE event record with date/endDate — this
// expands that range into each "YYYY-MM-DD" day it spans, inclusive, so the calendar grid
// and day-detail panel can show the same event on every day it covers instead of requiring
// a separate event per day.
function evDateRangeDays(start,end){
  const days=[];
  let cur=new Date(start+'T12:00:00');
  const last=new Date((end||start)+'T12:00:00');
  while(cur<=last){
    days.push(localDateStr(cur));
    cur=new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()+1);
  }
  return days;
}
function evSpansDate(e,dateStr){
  if(!e.date)return false;
  return dateStr>=e.date&&dateStr<=(e.endDate||e.date);
}

function calPrev(){CAL_MONTH--;if(CAL_MONTH<0){CAL_MONTH=11;CAL_YEAR--;}renderCalendar();}
function calNext(){CAL_MONTH++;if(CAL_MONTH>11){CAL_MONTH=0;CAL_YEAR++;}renderCalendar();}
function calToday(){CAL_YEAR=new Date().getFullYear();CAL_MONTH=new Date().getMonth();renderCalendar();}

function renderCalendar(){
  const calBtn=document.getElementById('cal-new-event-btn');
  if(calBtn)calBtn.style.display=canEditPage('calendar')?'':'none';
  const now=new Date();
  const firstDay=new Date(CAL_YEAR,CAL_MONTH,1);
  const lastDay=new Date(CAL_YEAR,CAL_MONTH+1,0);
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-month-label').textContent=monthNames[CAL_MONTH]+' '+CAL_YEAR;

  // Filter — a single select rather than 15 simultaneous buttons (was a 15-option decision
  // point crammed into one row; a native select collapses that to one visible control and
  // gets keyboard/screen-reader support for free, matching every other filter in the app).
  const types=['all','chapter','exec','committee','brotherhood','faith','philanthropy','social','alumni','pledge','service','dues','isu','homecoming','recruitment'];
  const typeLabels={all:'All Events',chapter:'Chapter Event',exec:'Exec Event',committee:'Committee Meeting',brotherhood:'Brotherhood Event',faith:'Faith Event',philanthropy:'Philanthropy',social:'Social Event',alumni:'Alumni/Parent',pledge:'Pledge Event',service:'Community Service',dues:'Dues Deadlines',isu:'ISU Event',homecoming:'Homecoming',recruitment:'Recruitment'};
  document.getElementById('cal-filt').innerHTML=`<select onchange="calSetFilter(this.value)" aria-label="Filter events by type" style="height:29px;padding:0 9px;border:1px solid var(--bdr);border-radius:7px;font-size:12px;font-family:inherit;background:var(--surf);color:var(--tx)">${types.map(t=>`<option value="${t}"${CAL_FILTER===t?' selected':''}>${typeLabels[t]}</option>`).join('')}</select>`;

  // Build grid
  const startDow=firstDay.getDay(); // 0=Sun
  const totalDays=lastDay.getDate();
  const cells=[];

  // Prev month padding
  const prevLast=new Date(CAL_YEAR,CAL_MONTH,0).getDate();
  for(let i=startDow-1;i>=0;i--){
    cells.push({day:prevLast-i,cur:false,date:null});
  }
  // Current month
  for(let d=1;d<=totalDays;d++){
    const dateStr=`${CAL_YEAR}-${String(CAL_MONTH+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({day:d,cur:true,date:dateStr});
  }
  // Next month padding
  let next=1;
  while(cells.length%7!==0)cells.push({day:next++,cur:false,date:null});

  // Get events and tasks for this month
  const monthCellDates=new Set(cells.filter(c=>c.date).map(c=>c.date));
  const eventsInView=D.events.filter(e=>{
    if(!e.date)return false;
    // A multi-day event only needs to overlap the visible grid, not start inside it — a Fri/Sat
    // Formal starting the last day of the prior month must still show on this month's cells.
    return evDateRangeDays(e.date,e.endDate||e.date).some(d=>monthCellDates.has(d));
  }).filter(e=>CAL_FILTER==='all'||e.type===CAL_FILTER);

  const tasksForMonth=D.tasks.filter(t=>{
    if(!t.dueDate||t.status==='done')return false;
    const d=new Date(t.dueDate+'T12:00:00');
    return d.getFullYear()===CAL_YEAR&&d.getMonth()===CAL_MONTH;
  });

  // Group by date — a ranged event is registered under every day it spans, not just its start.
  const evByDate={};
  eventsInView.forEach(e=>{
    evDateRangeDays(e.date,e.endDate||e.date).forEach(d=>{
      if(!monthCellDates.has(d))return;
      if(!evByDate[d])evByDate[d]=[];
      evByDate[d].push(e);
    });
  });
  const tkByDate={};
  tasksForMonth.forEach(t=>{if(!tkByDate[t.dueDate])tkByDate[t.dueDate]=[];tkByDate[t.dueDate].push(t);});

  const todayStr=localDateStr(now);

  document.getElementById('cal-grid').innerHTML=cells.map(cell=>{
    const isToday=cell.date===todayStr;
    const isOther=!cell.cur;
    const evs=cell.date?evByDate[cell.date]||[]:[];
    const tks=cell.date?tkByDate[cell.date]||[]:[];
    const maxShow=3;
    const allItems=[...evs.map(e=>({kind:'ev',e})),...tks.map(t=>({kind:'tk',t}))];
    const shown=allItems.slice(0,maxShow);
    const more=allItems.length-maxShow;
    const pips=shown.map(item=>{
      if(item.kind==='ev'){
        const e=item.e;
        const rangeTitle=e.endDate&&e.endDate!==e.date?' ('+fds(e.date)+'–'+fds(e.endDate)+')':'';
        return`<div class="cal-pip ${e.type||'chapter'}" title="${esc(e.title)}${rangeTitle}${e.start?' · '+to12h(e.start)+(e.endTime?'–'+to12h(e.endTime):''):''}">${esc(e.title)}</div>`;
      } else {
        const t=item.t;
        return`<div class="cal-pip task" title="Task: ${esc(t.title)}">${esc(t.title)}</div>`;
      }
    }).join('');
    const moreHtml=more>0?`<div class="cal-more" tabindex="0" role="button" onclick="calShowDay('${cell.date}',event)">+${more} more</div>`:'';
    return`<div class="cal-cell${isOther?' other-month':''}${isToday?' today':''}" onclick="calShowDay('${cell.date||''}',event)">
      <div class="cal-day-num">${cell.day}</div>
      ${pips}${moreHtml}
    </div>`;
  }).join('');
}

function calSetFilter(f){CAL_FILTER=f;renderCalendar();}

function calShowDay(dateStr,e){
  if(!dateStr)return;
  e.stopPropagation();
  const evs=D.events.filter(ev=>evSpansDate(ev,dateStr));
  const tks=D.tasks.filter(t=>t.dueDate===dateStr&&t.status!=='done');
  const detail=document.getElementById('cal-detail');
  const body=document.getElementById('cal-detail-body');
  const title=document.getElementById('cal-detail-title');
  if(!evs.length&&!tks.length){detail.style.display='none';return;}
  const d=new Date(dateStr+'T12:00:00');
  title.textContent=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  const pcl={urgent:'br2',high:'br2',medium:'ba2',low:'bm2'};
  body.innerHTML=(evs.length?'<div style="font-size:10px;font-weight:500;color:var(--mt);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Events</div>'+evs.map(ev=>{
    const isRanged=ev.endDate&&ev.endDate!==ev.date;
    const rangeNote=isRanged?' · '+fds(ev.date)+'–'+fds(ev.endDate):'';
    const canEdit=canEditPage('calendar')||canEditEventForCommittee(ev.committeeId);
    const timeRange=(to12h(ev.start)||'TBD')+(ev.endTime?'–'+to12h(ev.endTime):'');
    return`<div class="ev-row"><div class="ev-dt"><div class="ev-day">${dom(dateStr)}</div><div class="ev-mo">${mos(dateStr)}</div></div><div style="flex:1"><div style="font-size:12.5px;font-weight:500">${esc(ev.title)}</div><div style="font-size:10.5px;color:var(--mt)">${timeRange} · ${esc(ev.location)||'N/A'}${rangeNote}</div></div><span class="badge" style="${evCS(ev.type)}">${esc(ev.type)}</span>${ev.mandatory?'<span class="badge br2" style="margin-left:4px">Req</span>':''}${canEdit?`<div style="display:flex;gap:3px;margin-left:6px;flex-shrink:0"><button class="btn" style="height:22px;font-size:10px;padding:0 6px" aria-label="Edit ${esc(ev.title)}" onclick="openEditEvent('${ev.id}')"><i class="ti ti-pencil"></i></button><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" aria-label="Delete ${esc(ev.title)}" onclick="deleteEvent('${ev.id}')"><i class="ti ti-trash"></i></button></div>`:''}</div>`;
  }).join(''):'')
  +(tks.length?'<div style="font-size:10px;font-weight:500;color:var(--mt);text-transform:uppercase;letter-spacing:.06em;margin:11px 0 7px">Tasks Due</div>'+tks.map(t=>`<div class="tk-row" tabindex="0" role="button" aria-label="Edit ${esc(t.title)}" onclick="openEditTask('${t.id}')"><div class="tc ${t.status==='done'?'done':''}" tabindex="0" role="button" aria-label="Toggle ${esc(t.title)} done" onclick="event.stopPropagation();toggleTask('${t.id}')">${t.status==='done'?'<i class="ti ti-check" style="font-size:9px"></i>':''}</div><div style="flex:1"><div style="font-size:11.5px">${esc(t.title)}</div><div style="font-size:10px;color:var(--ht)">${esc(t.positionTitle||'Unassigned')}</div></div><span class="badge ${pcl[t.priority]||'bm2'}" style="font-size:9px">${esc(t.priority)}</span></div>`).join(''):'');
  detail.style.display='block';
  detail.scrollIntoView({behavior:'smooth',block:'nearest'});
}


let TASKS_SELECTED_SEM=null;
function tasksKnownSemesters(){
  return unionKnownSemesters([...D.tasks.map(t=>t.semester),...D.goals.map(g=>g.semester)].filter(Boolean));
}
function tasksSemesterChanged(){
  TASKS_SELECTED_SEM=document.getElementById('tasks-semester-select').value;
  renderTasks();
}
function renderTasks(){
  const lead=isLeadUser();
  if(!TASKS_SELECTED_SEM)TASKS_SELECTED_SEM=getSemester();
  initSemesterSelect('tasks-semester-select',tasksKnownSemesters(),tasksSemesterChanged,TASKS_SELECTED_SEM);
  const sem=TASKS_SELECTED_SEM;
  const canEdit=canEditPage('tasks')&&isCurrentSemester(sem);
  const taskBtn=document.getElementById('tasks-new-task-btn');
  if(taskBtn)taskBtn.style.display=canEdit?'':'none';
  const goalBtn=document.getElementById('tasks-add-goal-btn');
  if(goalBtn)goalBtn.style.display=canEdit?'':'none';
  // Goal Sheet CSV import can create goals for ANY position by column value — restricted to
  // leads only (see js/import.js's openImportModal), same tier as the Bylaws import, so it can't
  // be used to bulk-create goals outside your own position.
  const impBtn=document.getElementById('tasks-import-btn');
  if(impBtn)impBtn.style.display=(canEdit&&lead)?'':'none';

  // ── Visible scope: leads see every position's tasks/goals unfiltered, same as before. Everyone
  // else only sees their own position(s)' records (myPositionTitles(), primary+secondary).
  // Unassigned/orphaned-position records are lead-only, not a shared bucket, per
  // canSeePositionGroup(). A further semester stage narrows to the selected semester — records
  // with no .semester (pre-migration legacy data) stay visible rather than vanishing.
  const posGoals=lead?D.goals:D.goals.filter(g=>canSeePositionGroup(g.positionTitle));
  const posTasks=lead?D.tasks:D.tasks.filter(t=>canSeePositionGroup(t.positionTitle));
  const visibleGoals=posGoals.filter(g=>!g.semester||g.semester===sem);
  const visibleTasks=posTasks.filter(t=>!t.semester||t.semester===sem);

  const dn=visibleTasks.filter(t=>t.status==='done').length;const ov=visibleTasks.filter(t=>isOv(t.dueDate)&&t.status!=='done').length;
  const tot=visibleTasks.length;
  document.getElementById('t-kpi').innerHTML=statStrip(lead?'Total tasks':'My tasks',tot,sem,'neutral')+statStrip('Complete',dn,(tot?Math.round(dn/tot*100):0)+'% rate',dn>0?'up':'neutral')+statStrip('In progress',visibleTasks.filter(t=>t.status==='in_progress').length,'Active','neutral')+statStrip('Overdue',ov,ov>0?'Action needed':'None',ov>0?'down':'neutral');

  // ── Semester Goals — defined outcomes, not progress trackers. Grouped by the position
  // responsible for each one; goals created before this redesign (or with no position set) fall
  // into an "Unassigned" group rather than vanishing. Legacy records may still carry
  // target/current/unit from the old progress-tracker shape — deliberately never read again here;
  // g.title alone is the full goal statement now, for both old and new records.
  const goalHeading=document.getElementById('tasks-goals-heading');
  if(goalHeading)goalHeading.textContent=lead?'Semester Goals':'My Semester Goals';
  const goalSub=document.getElementById('t-goals-sub');
  if(goalSub){
    const myPos=myPositionTitles().filter(_positionStillExists);
    if(!lead&&myPos.length){goalSub.style.display='';goalSub.textContent=myPos.join(' & ');}
    else goalSub.style.display='none';
  }
  const posSort=(a,b)=>a==='Unassigned'?1:b==='Unassigned'?-1:a.localeCompare(b);
  const goalGroups={};
  visibleGoals.forEach(g=>{const p=g.positionTitle||'Unassigned';(goalGroups[p]=goalGroups[p]||[]).push(g);});
  const goalPositions=Object.keys(goalGroups).sort(posSort);
  const sgpRow=g=>`<li class="sgp-row"><i class="ti ti-target sgp-ico" aria-hidden="true"></i><span class="sgp-text">${esc(g.title)}</span>${canEdit&&ownsPositionRecord(g.positionTitle)?`<button class="ib sgp-del" onclick="deleteGoal('${g.id}')" aria-label="Delete goal ${esc(g.title)}" title="Delete goal"><i class="ti ti-x"></i></button>`:''}</li>`;
  const tGoalsEl=document.getElementById('t-goals');
  if(!goalPositions.length){
    tGoalsEl.innerHTML=lead
      ?es('ti-target','amber','No goals yet','Set semester goals for each position to track your chapter\'s priorities.',canEdit?`<button class="btn" onclick="openM('m-addgoal')"><i class="ti ti-plus"></i>Add Goal</button>`:'')
      :`<div class="sgp-standard"><div class="sgp-empty-msg">No semester goals have been assigned to your position yet.</div></div>`;
  }else if(lead){
    // President/VP: one card per position, up to 3 per row on wide desktop (.sgp-grid).
    tGoalsEl.innerHTML=`<div class="sgp-grid">${goalPositions.map(pos=>`<div class="sgp-card"><div class="sgp-card-hd"><h4 class="sgp-pos" style="margin:0">${esc(pos)}</h4><span class="sgp-count">${goalGroups[pos].length} Goal${goalGroups[pos].length!==1?'s':''}</span></div><ul class="sgp-list">${goalGroups[pos].map(sgpRow).join('')}</ul></div>`).join('')}</div>`;
  }else{
    // Standard officer: one full-width card, grouped by position only when they hold more than
    // one (a single-position officer already sees their position named in #t-goals-sub above).
    const showLabel=goalPositions.length>1;
    tGoalsEl.innerHTML=`<div class="sgp-standard">${goalPositions.map(pos=>`<div class="sgp-group">${showLabel?`<h4 class="sgp-pos" style="margin:0 0 8px">${esc(pos)}</h4>`:''}<ul class="sgp-list">${goalGroups[pos].map(sgpRow).join('')}</ul></div>`).join('')}</div>`;
  }

  // ── Task Board — one mini status-board per position, instead of one board mixing everyone's
  // tasks together. A position only gets a section once it has at least one task, so delegating
  // the FIRST task to a position (via the New Task modal's Position field) is what creates its
  // section — there's no wall of empty boards for positions nobody's assigned anything to yet.
  const pcl={urgent:'br2',high:'br2',medium:'ba2',low:'bm2'};const pln={urgent:'Urgent',high:'High',medium:'Med',low:'Low'};
  const cols=[{id:'todo',l:'To Do',k:'k1'},{id:'in_progress',l:'In Progress',k:'k2'},{id:'done',l:'Done',k:'k4'},{id:'cant_complete',l:"Couldn't Complete",k:'k3'}];
  // No due date is a deliberate state (an open-ended task, due date addable later via Edit), not
  // a missing field — labeled explicitly so it doesn't read as though the card just forgot to show
  // a date.
  const cardHtml=t=>`<div class="tk-card" draggable="${canDragTask(t)}" tabindex="0" role="button" aria-label="Edit ${esc(t.title)}" ondragstart="taskDragStart('${t.id}')" ondragend="document.querySelectorAll('.kb2').forEach(c=>c.classList.remove('drag-over'))" onclick="openEditTask('${t.id}')"><div class="tk-ct">${esc(t.title)}</div><div class="tk-cm"><span class="badge ${pcl[t.priority]||'bm2'}">${pln[t.priority]||esc(t.priority)}</span>${t.dueDate?`<span style="font-size:9.5px;color:${isOv(t.dueDate)&&t.status!=='done'?'var(--rd)':'var(--ht)'}">${fds(t.dueDate)}</span>`:'<span style="font-size:9.5px;color:var(--ht);font-style:italic">No due date</span>'}</div>${taskAssignedByLabel(t)?`<div style="margin-top:5px;font-size:10px;color:var(--ht)">${esc(taskAssignedByLabel(t))}</div>`:''}</div>`;
  const taskGroups={};
  visibleTasks.forEach(t=>{const p=t.positionTitle||'Unassigned';(taskGroups[p]=taskGroups[p]||[]).push(t);});
  const taskPositions=Object.keys(taskGroups).sort(posSort);
  document.getElementById('t-kb').innerHTML=taskPositions.length?taskPositions.map(pos=>{
    const posTasks=taskGroups[pos];
    const posDone=posTasks.filter(t=>t.status==='done').length;
    return`<div class="card" style="margin-bottom:13px">
      <div class="card-hd"><span class="card-t">${esc(pos)}</span><span style="font-size:10.5px;color:var(--mt)">${posDone} / ${posTasks.length} done</span></div>
      <div class="kb">${cols.map(col=>{const items=posTasks.filter(t=>t.status===col.id);return`<div class="kc"><div class="kh ${col.k}"><span style="font-size:12px;font-weight:500">${col.l}</span><span class="badge bm2">${items.length}</span></div><div class="kb2" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="taskDrop(event,'${col.id}')">${items.map(cardHtml).join('')||'<div style="font-size:11px;color:var(--ht);text-align:center;padding:18px 0">Empty</div>'}</div></div>`;}).join('')}</div>
    </div>`;
  }).join(''):es('ti-checkbox','blue','No tasks yet','Create a task and assign it to a position to get started.',canEditPage('tasks')?`<button class="btn btn-p" onclick="openM('m-addtask')"><i class="ti ti-plus"></i>New Task</button>`:'');
}

function renderNotes(){
  const tc={chapter:'bb2',exec:'bm2',judicial:'br2',retreat:'bg2'};
  const tn={chapter:'Chapter',exec:'Executive',judicial:'Judicial',retreat:'Retreat'};
  initSemesterSelect('notes-semester-select',mnKnownSemesters(),mnSemesterChanged,MN_SELECTED_SEM||getSemester());
  const notes=mnVisibleNotes();
  const canEdit=canEditNotes()&&isCurrentSemester(mnSem());
  const addBtn=document.getElementById('notes-add-btn');
  if(addBtn)addBtn.style.display=canEdit?'':'none';
  if(!notes.length){
    document.getElementById('notes-g').innerHTML=`<div style="grid-column:1/-1">${es('ti-notes','blue','No meeting notes yet','Record your first chapter or exec meeting to get started.',canEdit?`<button class="btn btn-p" onclick="openAddNote()"><i class="ti ti-plus"></i>New Note</button>`:'')}</div>`;
    return;
  }
  document.getElementById('notes-g').innerHTML=notes.map(n=>{
    const hasStructure=n.officerReports&&n.officerReports.length;
    const highlights=[];
    if(n.ooh)highlights.push({icon:'ti-trophy',label:'OOH',val:n.ooh});
    if(n.botw)highlights.push({icon:'ti-star',label:'Brother',val:n.botw});
    if(n.buffon)highlights.push({icon:'ti-mood-smile',label:'Buffon',val:n.buffon});
    return`<div class="card note-card" style="position:relative">
      ${canEdit?`<div style="position:absolute;top:8px;right:8px;display:flex;gap:3px">
        <button class="ib" style="width:22px;height:22px;font-size:11px;color:var(--mt)" aria-label="Edit ${esc(n.title)}" onclick="event.stopPropagation();openEditNote('${n.id}')" title="Edit note"><i class="ti ti-pencil"></i></button>
        <button class="ib" style="width:22px;height:22px;font-size:11px;color:var(--rd)" aria-label="Delete ${esc(n.title)}" onclick="event.stopPropagation();deleteNote('${n.id}')" title="Delete note"><i class="ti ti-trash"></i></button>
      </div>`:''}
      <div style="cursor:pointer" tabindex="0" role="button" aria-label="Open ${esc(n.title)}" onclick="openNoteDetail('${n.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <span class="badge ${tc[n.type]||'bm2'}">${tn[n.type]||esc(n.type)}</span>
        <span style="font-size:10.5px;color:var(--ht);${canEdit?'margin-right:44px':''}">${fds(n.date)}</span>
      </div>
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;line-height:1.3">${esc(n.title)}</div>
      ${n.chapter?`<div style="font-size:10.5px;color:var(--mt);margin-bottom:9px">${esc(n.chapter)}</div>`:''}
      ${hasStructure?`<div style="font-size:10.5px;color:var(--mt);margin-bottom:8px;display:flex;align-items:center;gap:5px"><i class="ti ti-users" style="font-size:11px"></i>${n.officerReports.length} officer reports</div>`:''}
      ${highlights.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:9px">${highlights.map(h=>`<div style="background:var(--surf2);border-radius:6px;padding:3px 8px;font-size:10.5px;display:flex;align-items:center;gap:4px"><i class="ti ${h.icon}" style="font-size:11px;color:var(--gold-tx)"></i><span style="color:var(--mt)">${h.label}:</span> <span style="font-weight:500">${esc(h.val)}</span></div>`).join('')}</div>`:''}
      ${n.announcements?`<div style="font-size:11px;color:var(--mt);line-height:1.5;margin-bottom:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(n.announcements)}</div>`:''}
      <div style="font-size:10px;color:var(--ht);border-top:1px solid var(--bdr);padding-top:7px;display:flex;justify-content:space-between;align-items:center">
        <span>${esc(mB(n.author).name)}</span>
        <span>${n.actions&&n.actions.length?n.actions.length+' action item'+(n.actions.length!==1?'s':''):''}</span>
      </div>
      </div>
    </div>`;
  }).join('');
}

async function deleteNote(id){
  if(!canEditNotes()){toast('Only the President, Vice President, and Secretary can delete notes.','error');return;}
  const n=D.notes.find(x=>x.id===id);
  if(n&&!isCurrentSemester(semesterLabelForDate(n.date))){toast('This meeting note is in a past semester and is read-only.','error');return;}
  const ok=await confirmDialog('Delete Note','Delete this meeting note? This cannot be undone.');
  if(!ok)return;
  const removed=D.notes.find(n=>n.id===id);
  D.notes=D.notes.filter(n=>n.id!==id);
  try{await saveD('notes');renderNotes();toast('Note deleted','info');}
  catch(e){if(removed)D.notes.unshift(removed);toast('Failed to delete note. Please try again.','error');}
}
async function deleteGoal(id){
  const g=D.goals.find(g=>g.id===id);
  if(!canEditPage('tasks')||!ownsPositionRecord(g?.positionTitle)){toast('You do not have permission to delete this goal.','error');return;}
  if(g?.semester&&!isCurrentSemester(g.semester)){toast('This goal is in a past semester and is read-only.','error');return;}
  const ok=await confirmDialog('Delete Goal','Remove this goal?');
  if(!ok)return;
  D.goals=D.goals.filter(x=>x.id!==id);
  try{await saveD('goals');renderTasks();toast('Goal removed','info');}
  catch(e){if(g)D.goals.push(g);toast('Failed to remove goal. Please try again.','error');}
}
// Weekend deletion now lives in js/sober.js (sbDeleteWeekend) — the old per-shift deleteShift()
// had no other callers once renderSober() moved there.
async function deleteCase(id){
  if(!isLeadUser()){toast('Only a chapter lead can delete judicial cases.','error');return;}
  const c=D.cases.find(x=>x.id===id);
  if(c?.semester&&!isCurrentSemester(c.semester)){toast('This case is in a past semester and is read-only.','error');return;}
  const ok=await confirmDialog('Delete Case','Permanently delete this judicial case?');
  if(!ok)return;
  const removed=D.cases.find(c=>c.id===id);
  D.cases=D.cases.filter(c=>c.id!==id);
  try{await deleteJudicialCaseDoc(id);renderJudicialContent();updateBadges();toast('Case deleted','info');}
  catch(e){if(removed)D.cases.push(removed);toast('Failed to delete case. Please try again.','error');}
}
async function deleteAlumni(id){
  if(!canEditPage('alumni')){toast('Only officers with Alumni Relations access can remove alumni.','error');return;}
  const ok=await confirmDialog('Remove Alumni','Remove this alumni from the directory?');
  if(!ok)return;
  const removed=D.alumni.contacts.find(a=>a.id===id);
  D.alumni.contacts=D.alumni.contacts.filter(a=>a.id!==id);
  try{await saveD('alumni');renderAlumni();toast('Alumni removed','info');}
  catch(e){if(removed)D.alumni.contacts.push(removed);toast('Failed to remove alumni. Please try again.','error');}
}
async function deleteRushee(id){
  if(!canEditPage('recruitment')){toast('Only officers with Recruitment access can remove rushees.','error');return;}
  const target=D.recruitment.rushees.find(r=>r.id===id);
  if(target?.semester&&!isCurrentSemester(target.semester)){toast('This semester is read-only.','error');return;}
  const ok=await confirmDialog('Remove Rushee','Remove this rushee from the CRM?');
  if(!ok)return;
  const removed=D.recruitment.rushees.find(r=>r.id===id);
  D.recruitment.rushees=D.recruitment.rushees.filter(r=>r.id!==id);
  try{await saveD('recruitment');renderRecruitment();toast('Rushee removed','info');}
  catch(e){if(removed)D.recruitment.rushees.push(removed);toast('Failed to remove rushee. Please try again.','error');}
}
async function deletePhEvent(id){
  if(!canEditPhilanthropy()){toast('Only officers with Philanthropy access can delete events.','error');return;}
  const ev=D.events.find(e=>e.id===id);
  if(ev&&!isCurrentSemester(semesterLabelForDate(ev.date))){toast('This event is in a past semester and is read-only.','error');return;}
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
    renderPhilanthropy();
    if(typeof renderCalendar==='function')renderCalendar();
    toast('Event deleted','info');
  }catch(e){
    if(removed)D.events.push(removed);
    if(removedAtt)D.attendance[id]=removedAtt;
    if(removedPlanning&&D.social?.planning)D.social.planning[id]=removedPlanning;
    toast('Failed to delete event. Please try again.','error');
  }
}
async function deletePhFunds(id){
  if(!canEditPhilanthropy()){toast('Only officers with Philanthropy access can delete fundraising entries.','error');return;}
  const f=(D.philanthropy.fundraisingLogs||[]).find(x=>x.id===id);
  if(f&&!isCurrentSemester(semesterLabelForDate(f.date))){toast('This entry is in a past semester and is read-only.','error');return;}
  const ok=await confirmDialog('Delete Entry','Remove this fundraising entry?');
  if(!ok)return;
  const removed=(D.philanthropy.fundraisingLogs||[]).find(f=>f.id===id);
  D.philanthropy.fundraisingLogs=(D.philanthropy.fundraisingLogs||[]).filter(f=>f.id!==id);
  try{await saveD('philanthropy');renderPhilanthropy();toast('Entry removed','info');}
  catch(e){if(removed){if(!D.philanthropy.fundraisingLogs)D.philanthropy.fundraisingLogs=[];D.philanthropy.fundraisingLogs.push(removed);}toast('Failed to remove entry. Please try again.','error');}
}
async function deleteFineFn(id){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can delete fines.','error');return;}
  if(!isCurrentSemester(finSem())){toast('This semester is read-only.','error');return;}
  const ok=await confirmDialog('Delete Fine','Remove this fine record?');
  if(!ok)return;
  const fine=D.finance.fines.find(f=>f.id===id);
  const duesRec=fine?finDuesRec(fine.memberId,getSemester()):null;
  const prevCount=duesRec?duesRec.fineCount:null;
  if(duesRec)duesRec.fineCount=Math.max(0,(duesRec.fineCount||1)-1);
  D.finance.fines=D.finance.fines.filter(f=>f.id!==id);
  try{
    await Promise.all([saveFinanceLedger(), duesRec?saveFinanceDues(fine.memberId):Promise.resolve()]);
    finRenderFines();toast('Fine deleted','info');
  }catch(e){
    if(fine)D.finance.fines.unshift(fine);
    if(duesRec&&prevCount!==null)duesRec.fineCount=prevCount;
    toast('Failed to delete fine. Please try again.','error');
  }
}
async function deleteExpense(id){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can delete expenses.','error');return;}
  if(!isCurrentSemester(finSem())){toast('This semester is read-only.','error');return;}
  const ok=await confirmDialog('Delete Expense','Remove this expense from the log?');
  if(!ok)return;
  const removed=D.finance.expenses.find(e=>e.id===id);
  D.finance.expenses=D.finance.expenses.filter(e=>e.id!==id);
  try{await saveFinanceLedger();finRenderBudget();finRenderOverview();toast('Expense deleted','info');}
  catch(e){if(removed)D.finance.expenses.unshift(removed);toast('Failed to delete expense. Please try again.','error');}
}
async function deletePlan(id){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can delete payment plans.','error');return;}
  if(!isCurrentSemester(finSem())){toast('This semester is read-only.','error');return;}
  const ok=await confirmDialog('Delete Plan','Remove this payment plan?');
  if(!ok)return;
  const removed=D.finance.plans.find(p=>p.id===id);
  D.finance.plans=D.finance.plans.filter(p=>p.id!==id);
  try{await saveFinanceLedger();finRenderPlans();toast('Plan deleted','info');}
  catch(e){if(removed)D.finance.plans.push(removed);toast('Failed to delete plan. Please try again.','error');}
}

function openNoteDetail(id){
  window._activeNoteId=id;
  const n=D.notes.find(x=>x.id===id);
  const tc={chapter:'bb2',exec:'bm2',judicial:'br2',retreat:'bg2'};
  const tn={chapter:'Chapter',exec:'Executive',judicial:'Judicial',retreat:'Retreat'};
  const el=document.getElementById('m-notedetail');
  const body=document.getElementById('nd-body');
  const editBtn=document.getElementById('nd-edit-btn');
  if(editBtn)editBtn.style.display=(canEditNotes()&&n&&isCurrentSemester(semesterLabelForDate(n.date)))?'':'none';

  function sec(title,content){
    if(!content)return'';
    const lines=content.split('\n').filter(Boolean);
    return`<div class="nd-section">
      <div class="nd-sec-title">${title}</div>
      <div class="nd-sec-body">${lines.map(l=>`<div class="nd-bullet">${l.startsWith('•')||l.startsWith('-')?esc(l):'• '+esc(l)}</div>`).join('')}</div>
    </div>`;
  }

  let html=`
    <!-- Header -->
    <div class="nd-header">
      <div style="font-size:11px;color:var(--mt);margin-bottom:4px">${esc(n.chapter)||esc(D.settings?.chapterName||CURRENT_USER?.chapterName||'')}</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">${esc(n.title)}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="badge ${tc[n.type]||'bm2'}">${tn[n.type]||esc(n.type)}</span>
        <span style="font-size:11px;color:var(--mt)">${fd(n.date)}</span>
        <span style="font-size:11px;color:var(--mt)">Recorded by ${esc(mB(n.author).name)}</span>
      </div>
    </div>`;

  // Officer Reports
  if(n.officerReports&&n.officerReports.length){
    html+=`<div class="nd-section">
      <div class="nd-sec-title">Officer Reports</div>
      <div style="display:flex;flex-direction:column;gap:7px">
        ${n.officerReports.filter(r=>r.notes).map(r=>`<div style="display:flex;gap:10px;align-items:flex-start">
          <div style="min-width:155px;max-width:155px;flex-shrink:0">
            <div style="font-size:11.5px;font-weight:600">${esc(r.role)}</div>
          </div>
          <div style="flex:1;font-size:11.5px;color:var(--tx);line-height:1.6">${r.notes.split('\n').map(l=>`<div>${l.startsWith('•')||l.startsWith('-')?esc(l):'• '+esc(l)}</div>`).join('')}</div>
        </div>`).join('')||'<div style="font-size:11.5px;color:var(--ht);font-style:italic">No officer reports recorded.</div>'}
      </div>
    </div>`;
  }

  html+=sec('Announcements',n.announcements);
  html+=sec('Old Business',n.oldBusiness);
  html+=sec('New Business',n.newBusiness);

  // Weekly Honors
  const honors=[];
  if(n.ooh)honors.push({icon:'ti-trophy',label:'OOH of the Week',val:n.ooh});
  if(n.botw)honors.push({icon:'ti-star',label:'Brother of the Week',val:n.botw});
  if(n.buffon)honors.push({icon:'ti-mood-smile',label:'Buffon of the Week',val:n.buffon});
  if(honors.length){
    html+=`<div class="nd-section">
      <div class="nd-sec-title">Weekly Honors</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        ${honors.map(h=>`<div style="background:var(--surf2);border-radius:8px;padding:11px;text-align:center">
          <div style="width:36px;height:36px;border-radius:9px;background:var(--gold-bg);color:var(--gold-tx);display:flex;align-items:center;justify-content:center;margin:0 auto 7px"><i class="ti ${h.icon}" style="font-size:17px"></i></div>
          <div style="font-size:10px;font-weight:500;color:var(--mt);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">${h.label}</div>
          <div style="font-size:13px;font-weight:600">${esc(h.val)}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  // Action Items
  if(n.actions&&n.actions.length){
    html+=`<div class="nd-section">
      <div class="nd-sec-title">Action Items</div>
      <div style="display:flex;flex-direction:column;gap:5px">
        ${n.actions.map((a,i)=>`<div style="display:flex;align-items:flex-start;gap:8px">
          <div style="width:18px;height:18px;border:1.5px solid var(--bdr);border-radius:4px;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--mt)">${i+1}</div>
          <div style="font-size:12px;line-height:1.5">${esc(a)}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  body.innerHTML=html;
  el.classList.add('open');
}


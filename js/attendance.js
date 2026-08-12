// ── ATTENDANCE THRESHOLDS ──
const ATT_TARGET  = 85; // % — good standing target (shown as dashed line on chart)
const ATT_WARN    = 75; // % — amber warning zone below this
const ATT_LOW     = 65; // % — red zone threshold for per-member color coding

// ── ATTENDANCE ACCESS ──
function canEditAttendance(){
  return canEditPage('attendance');
}

// The old anDrawLine/anDrawHealth/anDrawDonut/anDrawGpa/anDrawOfficers functions that used to
// live here (powering the main Analytics page's charts) have moved to js/analytics.js, which is
// where the render function that calls them (renderAnalytics()) actually lives. anDrawHealth in
// particular was dead code — it computed a 5-dimension health score and then discarded the
// result, per its own trailing comment. computeHealthDims() in js/healthscore.js is the one
// real Chapter Health Score implementation.

// ── ATTENDANCE CRUD ──
let _attTmp={};
let ATT_SELECTED_SEM=null;
// Attendance has no stored "semester" field on events/attendance records — every event already
// carries a real date, so known semesters are derived by bucketing each event's date via
// semesterLabelForDate() rather than reading a field that doesn't exist here.
function attKnownSemesters(){
  return unionKnownSemesters(D.events.map(e=>semesterLabelForDate(e.date)).filter(Boolean));
}
function attSemesterChanged(){
  ATT_SELECTED_SEM=document.getElementById('att-semester-select').value;
  renderAttendance();
}
function _attUpdateToolbar(){
  if(!ATT_SELECTED_SEM)ATT_SELECTED_SEM=getSemester();
  initSemesterSelect('att-semester-select',attKnownSemesters(),attSemesterChanged,ATT_SELECTED_SEM);
  const canEdit=canEditAttendance()&&isCurrentSemester(ATT_SELECTED_SEM);
  const newEv=document.getElementById('att-new-event-btn');
  const markBtn=document.getElementById('att-mark-btn');
  if(newEv)newEv.style.display=canEdit?'':'none';
  if(markBtn)markBtn.style.display=canEdit?'':'none';
}

function openMarkAttEv(evId){
  if(!canEditAttendance()){toast('Only the President, Vice President, and Secretary can mark attendance.','error');return;}
  const ev=D.events.find(e=>e.id===evId);if(!ev)return;
  if(!isCurrentSemester(semesterLabelForDate(ev.date))){toast('This event is in a past semester and is read-only.','error');return;}
  document.getElementById('ma-evid').value=evId;
  document.getElementById('ma-title').textContent='Mark Attendance: '+ev.title+' ('+fds(ev.date)+')';
  _attTmp={...(D.attendance[evId]||{})};
  renderAttList();
  openM('m-markatt');
}
function openMarkAtt(){
  if(!canEditAttendance()){toast('Only the President, Vice President, and Secretary can mark attendance.','error');return;}
  const mandatory=D.events.filter(e=>e.mandatory);
  if(!mandatory.length){toast('No mandatory events to mark attendance for','info');return;}
  // Attendance can be marked for a mandatory event any time, before or after it happens — this
  // shortcut still defaults to the most recent past one (the common case: a meeting just ended),
  // but falls back to the soonest upcoming one instead of giving up when nothing's happened yet.
  const past=mandatory.filter(e=>!isUp(e.date)).sort((a,b)=>b.date.localeCompare(a.date));
  const upcoming=mandatory.filter(e=>isUp(e.date)).sort((a,b)=>a.date.localeCompare(b.date));
  openMarkAttEv((past[0]||upcoming[0]).id);
}
// Status labels, matched to the chip glyph: Present / Excused Miss / Unexcused Miss. An
// Unexcused Miss auto-prompts for a fine amount on save — see _attCheckForFines() below.
const ATT_STATUS_LABEL={present:'Present',excused:'Excused Miss',absent:'Unexcused Miss'};
function renderAttList(){
  document.getElementById('ma-list').innerHTML=sortedMembers().map(m=>{
    const st=_attTmp[m.id]||'';
    const cls=st==='present'?'att-check present':st==='absent'?'att-check absent':st==='excused'?'att-check excused':'att-check';
    const lbl=st==='present'?'✓':st==='absent'?'U':st==='excused'?'E':'';
    return`<div style="display:flex;align-items:center;gap:7px;padding:4px 0;cursor:pointer" tabindex="0" role="button" aria-label="${esc(m.name)}: ${ATT_STATUS_LABEL[st]||'Unmarked'}, click to change" onclick="cycleAtt('${m.id}')">
      <div class="${cls}" id="ac-${m.id}" title="${ATT_STATUS_LABEL[st]||'Unmarked'}">${lbl}</div>
      <span style="font-size:12px">${esc(m.name)}</span>
    </div>`;
  }).join('');
}
function cycleAtt(mid){
  const cur=_attTmp[mid]||'';
  const next=cur===''?'present':cur==='present'?'absent':cur==='absent'?'excused':'';
  if(next==='')delete _attTmp[mid];else _attTmp[mid]=next;
  const el=document.getElementById('ac-'+mid);
  if(el){
    el.className=next==='present'?'att-check present':next==='absent'?'att-check absent':next==='excused'?'att-check excused':'att-check';
    el.textContent=next==='present'?'✓':next==='absent'?'U':next==='excused'?'E':'';
    el.title=ATT_STATUS_LABEL[next]||'Unmarked';
    const row=el.closest('[role="button"]');
    if(row){const m=D.members.find(x=>x.id===mid);if(m)row.setAttribute('aria-label',esc(m.name)+': '+(ATT_STATUS_LABEL[next]||'Unmarked')+', click to change');}
  }
}
function saveAttendance(){
  if(!canEditAttendance()){toast('Only the President, Vice President, and Secretary can mark attendance.','error');return;}
  const evId=document.getElementById('ma-evid').value;
  if(!evId){toast('No event selected.','error');return;}
  const ev=D.events.find(e=>e.id===evId);
  if(!isCurrentSemester(semesterLabelForDate(ev?.date))){toast('This event is in a past semester and is read-only.','error');return;}
  if(!D.attendance)D.attendance={};
  D.attendance[evId]=_attTmp;
  saveD('attendance');closeM(null,document.getElementById('m-markatt'));renderAttendance();renderDash();
  toast('Attendance saved','success');
  _attCheckForFines(evId);
}

// ── UNEXCUSED-MISS FINES ──
// After saving, anyone left as an Unexcused Miss who doesn't already have an Attendance fine for
// this specific event gets offered one — the Secretary types the amount right there, per member.
let _attFineEvId=null, _attFineMembers=[];
function _attCheckForFines(evId){
  const ev=D.events.find(e=>e.id===evId);
  const needsFine=Object.entries(_attTmp)
    .filter(([mid,st])=>st==='absent'&&!finHasAttendanceFine(mid,evId))
    .map(([mid])=>mB(mid));
  if(!needsFine.length)return;
  _attFineEvId=evId;
  _attFineMembers=needsFine;
  document.getElementById('af-title').textContent='Unexcused Miss Fines: '+(ev?ev.title:'Event');
  document.getElementById('af-list').innerHTML=needsFine.map(m=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0">
    <span style="flex:1;font-size:12.5px">${esc(m.name)}</span>
    <input type="number" min="0" step="0.01" placeholder="Amount" id="af-amt-${m.id}" style="width:100px;height:30px;padding:0 8px;border:1px solid var(--bdr);border-radius:6px;font-size:12px">
  </div>`).join('');
  openM('m-att-fines');
}
async function attSaveFines(){
  const evId=_attFineEvId;
  const ev=D.events.find(e=>e.id===evId);
  const eventTitle=ev?ev.title:'Event';
  let issued=0, skipped=0;
  for(const m of _attFineMembers){
    const input=document.getElementById('af-amt-'+m.id);
    const amount=parseFloat(input?.value);
    if(isNaN(amount)||amount<=0){skipped++;continue;}
    if(finHasAttendanceFine(m.id,evId))continue; // defensive re-check
    try{ await finAddAttendanceFine(m.id,evId,eventTitle,amount); issued++; }
    catch(e){ toast('Failed to fine '+m.name.split(' ')[0]+', please try again from Finance.','error'); }
  }
  closeM(null,document.getElementById('m-att-fines'));
  _attFineEvId=null; _attFineMembers=[];
  if(FIN_ACTIVE_TAB==='fin-fines')finRenderFines();
  if(issued)toast(issued+' fine'+(issued>1?'s':'')+' issued'+(skipped?', '+skipped+' skipped (no amount entered)':''),'success');
  else if(skipped)toast('No fines issued: no amounts entered.','info');
}


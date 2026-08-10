// ══════════════════════════════════════════════
// HOUSE LIFE — rooms, parking, preference points
// ══════════════════════════════════════════════
// Editable by Secretary/President/Vice President only; view-only for every other position and
// General Members. President/VP get edit via canEditPage()'s permLevel:'lead' bypass; Secretary
// has an explicit 'houseLife':'edit' grant in js/auth.js's DEFAULT_POSITIONS. Deliberately its own
// page key (not folded into 'kcrew') since House Manager/Assistant already edit kcrew and must
// NOT automatically get edit rights here too.

function canEditHouseLife(){
  return canEditPage('houseLife');
}
function hlDenied(){
  toast('Only the Secretary, President, and Vice President can edit House Life.','error');
}

// Rooms and parking only ever concern members who actually live in the house (the "Live-in"
// field on the Members tab) — non-live-in members have no room or house parking spot to assign.
// `existingIds` (already-assigned occupants/a spot's current member) are unioned in even if not
// live-in, so re-opening an existing assignment never silently drops it off the list — e.g. a
// member who moved out after being assigned still shows up (marked) until someone changes it.
function hlEligibleMembers(existingIds){
  const liveIn=sortedMembers().filter(m=>m.liveIn);
  const ids=new Set(liveIn.map(m=>m.id));
  const extra=(existingIds||[]).map(id=>D.members.find(m=>m.id===id)).filter(m=>m&&!ids.has(m.id));
  return [...liveIn,...extra];
}
function hlMemberOptionsHtml(members,selectedIds){
  selectedIds=selectedIds||[];
  return members.map(m=>`<option value="${m.id}"${selectedIds.includes(m.id)?' selected':''}>${esc(m.name)}${m.liveIn?'':' (not live-in)'}</option>`).join('');
}

// The chapter's preference-points rubric — seeded once on first load, chapter-editable after via
// the Preference Points tab (add/edit/delete). Verbatim from the chapter's real point sheet. Kept
// as a manual per-member checklist, tracked per semester (see hlOpenScoreEditor below) rather
// than auto-derived from
// other app data — most rows (Yell Like Hell, Greek Week roles, Dean's List, club membership,
// etc.) have no equivalent anywhere else in this app, and auto-deriving only the few that do
// (GPA, position, community service hours) while leaving the rest manual would be an inconsistent,
// confusing half-measure.
const HL_DEFAULT_CRITERIA=[
  ['President',100],['Vice President',90],['Treasurer',80],['Made Grades Last Semester',75],
  ['Lived In-House This Semester',75],['Chaplain',70],['Membership Educator',60],
  ['Recruitment Chair',50],['Secretary',50],['Social Chair',40],['Scholarship Chair',40],
  ['Philanthropy Chair',40],['Risk Management Officer',40],['Public Relations Officer',40],
  ['Alumni Relations Officer/Historian',40],['Community Service Chair',40],['House Man',30],
  ['Homecoming General Co-Chair',25],['Greek Week General Co-Chair',25],['Greek Week Central',25],
  ['Homecoming Central',25],['Yell Like Hell Co-Chair',20],['Lip Sync Co-Chair',20],
  ['Lawn Display Co-Chair',20],['On-Campus Exec Position',20],['4.0 GPA',20],
  ['Assistant House Man',15],['Parents Weekend Co-Chair',15],['On-Campus Committee Position',15],
  ['Greek Week Crew',15],['Cy-Squad',15],['Became Activated This Semester',15],
  ['Merchandise Chair',10],['Assistant M.E.',10],['Hungry gATOr Award',10],['Active of the Year',10],
  ['Pledge of the Year',10],['Most Involved on Campus Award',10],['Yell Like Hell Participant',10],
  ['Lip-Sync Participant',10],['Lawn Display Participant',10],['Dance Marathon Participant',10],
  ['Two or more Clubs',10],['Committee Member',10],['Deans List',10],['J-Board Member',5],
  ['IFC Representative',5],['One Club',5],['3 Hours of Community Service',5],
  // Per-unit criterion — points here means "per hour", not a flat one-time award. See
  // perUnit/unitLabel below and hlComputeScore()'s quantities handling.
  ['Every Extra Hour of Community Service',0.5,{perUnit:true,unitLabel:'hours'}],
];

// ── Migration / defaults — called from dDefaults() (js/data.js) whenever D loads ──
function hlEnsureDefaults(){
  if(!D.houseLife)D.houseLife={rooms:[],parking:[],prefCriteria:[],prefScores:{}};
  if(!D.houseLife.rooms)D.houseLife.rooms=[];
  if(!D.houseLife.parking)D.houseLife.parking=[];
  if(!D.houseLife.prefCriteria)D.houseLife.prefCriteria=[];
  if(!D.houseLife.prefScores)D.houseLife.prefScores={};
  // Migrate the original flat, semester-less shape (prefScores[memberId] = {checkedCriteria,
  // adjustment, adjustmentNote}) into the current semester's slot — preference points are
  // tracked per-semester now (prefScores[memberId][semesterLabel] = {...}), with an all-time
  // total computed by summing across every semester a member has one.
  Object.keys(D.houseLife.prefScores).forEach(mid=>{
    const rec=D.houseLife.prefScores[mid];
    if(rec&&Array.isArray(rec.checkedCriteria)){
      D.houseLife.prefScores[mid]={ [getSemester()]: { checkedCriteria:rec.checkedCriteria, adjustment:rec.adjustment||0, adjustmentNote:rec.adjustmentNote||'' } };
    }
  });
  if(!D.houseLife.prefCriteria.length){
    D.houseLife.prefCriteria=HL_DEFAULT_CRITERIA.map(([label,points,extra],i)=>({id:uid(),label,points,order:i,...(extra||{})}));
  }
  // Retrofit the per-unit flag onto chapters that already seeded the rubric before per-unit
  // criteria existed — matched by label since it predates this field.
  const hourly=D.houseLife.prefCriteria.find(c=>c.label==='Every Extra Hour of Community Service');
  if(hourly&&!hourly.perUnit){ hourly.perUnit=true; hourly.unitLabel='hours'; }
}

// ── Tab switching ──
let HL_ACTIVE_TAB='hl-pane-rooms';
function hlTab(btn,paneId){
  document.querySelectorAll('.hl-tab').forEach(t=>t.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('#page-houseLife > div[id^="hl-pane-"]').forEach(d=>{d.style.display='none';});
  const el=document.getElementById(paneId);if(el)el.style.display='block';
  HL_ACTIVE_TAB=paneId;
  if(paneId==='hl-pane-rooms')hlRenderRooms();
  else if(paneId==='hl-pane-parking')hlRenderParking();
  else if(paneId==='hl-pane-priority')hlRenderPriority();
}

// ── Top-level render (R.houseLife) ──
function renderHouseLife(){
  hlEnsureDefaults();
  const canEdit=canEditHouseLife();
  const roBar=document.getElementById('hl-ro-bar');if(roBar)roBar.style.display=canEdit?'none':'';
  const addRoomBtn=document.getElementById('hl-room-add-btn');if(addRoomBtn)addRoomBtn.style.display=canEdit?'':'none';
  const addSpotBtn=document.getElementById('hl-parking-add-btn');if(addSpotBtn)addSpotBtn.style.display=canEdit?'':'none';
  const addCritBtn=document.getElementById('hl-criterion-add-btn');if(addCritBtn)addCritBtn.style.display=canEdit?'':'none';
  hlTab(document.querySelector(`.hl-tab[data-tab="${HL_ACTIVE_TAB}"]`),HL_ACTIVE_TAB);
}

// ══════════════════════════════════════════════
// ROOMS
// ══════════════════════════════════════════════
function hlRenderRooms(){
  hlEnsureDefaults();
  const canEdit=canEditHouseLife();
  const el=document.getElementById('hl-rooms-list');if(!el)return;
  const rooms=[...D.houseLife.rooms];
  if(!rooms.length){
    el.innerHTML=es('ti-bed','blue','No rooms added yet','Add rooms to start tracking who lives where.',canEdit?'<button class="btn btn-p" onclick="hlOpenAddRoom()">Add Room</button>':'');
    return;
  }
  const floors=[...new Set(rooms.map(r=>r.floor||'Unassigned'))];
  el.innerHTML=floors.map(floor=>{
    const floorRooms=rooms.filter(r=>(r.floor||'Unassigned')===floor).sort((a,b)=>(a.order||0)-(b.order||0));
    return `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:600;color:var(--mt);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${esc(floor)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        ${floorRooms.map(r=>hlRoomCard(r,canEdit)).join('')}
      </div>
    </div>`;
  }).join('');
}
function hlRoomCard(r,canEdit){
  const occNames=(r.occupantIds||[]).map(id=>esc(mB(id).name));
  const vacant=Math.max(0,(r.capacity||2)-(r.occupantIds||[]).length);
  return `<div class="card" style="padding:11px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px">
      <span style="font-size:12.5px;font-weight:600">${esc(r.label)||'Room'}</span>
      ${canEdit?`<div style="display:flex;gap:3px;flex-shrink:0"><button class="btn" style="height:22px;font-size:10px;padding:0 6px" onclick="hlOpenEditRoom('${r.id}')" aria-label="Edit room"><i class="ti ti-edit"></i></button><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="hlDeleteRoom('${r.id}')" aria-label="Delete room"><i class="ti ti-trash"></i></button></div>`:''}
    </div>
    ${occNames.length?occNames.map(n=>`<div style="font-size:12px;padding:2px 0">${n}</div>`).join(''):'<div style="font-size:11.5px;color:var(--ht)">Vacant</div>'}
    ${vacant>0&&occNames.length?`<div style="font-size:10.5px;color:var(--ht);margin-top:3px">${vacant} open bed${vacant!==1?'s':''}</div>`:''}
  </div>`;
}
function hlOpenAddRoom(){
  if(!canEditHouseLife()){hlDenied();return;}
  document.getElementById('hl-room-id').value='';
  document.getElementById('hl-room-floor').value='';
  document.getElementById('hl-room-label').value='';
  document.getElementById('hl-room-capacity').value='2';
  const floorList=document.getElementById('hl-floor-list');
  if(floorList)floorList.innerHTML=[...new Set(D.houseLife.rooms.map(r=>r.floor).filter(Boolean))].map(f=>`<option value="${esc(f)}">`).join('');
  const sel=document.getElementById('hl-room-occupants');
  if(sel)sel.innerHTML=hlMemberOptionsHtml(hlEligibleMembers([]),[]);
  openM('m-hl-room');
}
function hlOpenEditRoom(id){
  if(!canEditHouseLife()){hlDenied();return;}
  const r=D.houseLife.rooms.find(x=>x.id===id);if(!r)return;
  document.getElementById('hl-room-id').value=r.id;
  document.getElementById('hl-room-floor').value=r.floor||'';
  document.getElementById('hl-room-label').value=r.label||'';
  document.getElementById('hl-room-capacity').value=r.capacity||2;
  const floorList=document.getElementById('hl-floor-list');
  if(floorList)floorList.innerHTML=[...new Set(D.houseLife.rooms.map(x=>x.floor).filter(Boolean))].map(f=>`<option value="${esc(f)}">`).join('');
  const sel=document.getElementById('hl-room-occupants');
  if(sel)sel.innerHTML=hlMemberOptionsHtml(hlEligibleMembers(r.occupantIds),r.occupantIds||[]);
  openM('m-hl-room');
}
async function hlSaveRoom(){
  if(!canEditHouseLife()){hlDenied();return;}
  const id=document.getElementById('hl-room-id').value;
  const floor=document.getElementById('hl-room-floor').value.trim();
  if(!floor){toast('Floor is required','error');return;}
  const label=document.getElementById('hl-room-label').value.trim();
  let capacity=parseInt(document.getElementById('hl-room-capacity').value,10);
  if(isNaN(capacity)||capacity<1)capacity=1;
  const occupantIds=[...document.getElementById('hl-room-occupants').selectedOptions].map(o=>o.value);
  if(occupantIds.length>capacity){toast("Selected more occupants than the room's capacity",'error');return;}
  let prev=null;
  if(id){
    const r=D.houseLife.rooms.find(x=>x.id===id);
    if(!r)return;
    prev={...r};
    Object.assign(r,{floor,label,capacity,occupantIds});
  }else{
    const order=D.houseLife.rooms.filter(x=>x.floor===floor).length;
    D.houseLife.rooms.push({id:uid(),floor,label,capacity,occupantIds,order});
  }
  try{
    await saveD('houseLife');
    closeM(null,document.getElementById('m-hl-room'));
    hlRenderRooms();
    toast(id?'Room updated':'Room added','success');
  }catch(e){
    if(id&&prev){const r=D.houseLife.rooms.find(x=>x.id===id);if(r)Object.assign(r,prev);}
    else{D.houseLife.rooms=D.houseLife.rooms.filter(x=>!(x.floor===floor&&x.label===label&&x.capacity===capacity));}
    toast('Failed to save room. Please try again.','error');
  }
}
async function hlDeleteRoom(id){
  if(!canEditHouseLife()){hlDenied();return;}
  const ok=await confirmDialog('Delete Room','Delete this room and unassign its occupants?');
  if(!ok)return;
  const idx=D.houseLife.rooms.findIndex(x=>x.id===id);
  const removed=idx>=0?D.houseLife.rooms[idx]:null;
  D.houseLife.rooms=D.houseLife.rooms.filter(x=>x.id!==id);
  try{
    await saveD('houseLife');
    hlRenderRooms();
    toast('Room removed','info');
  }catch(e){
    if(removed)D.houseLife.rooms.splice(idx,0,removed);
    toast('Failed to remove room. Please try again.','error');
  }
}

// ══════════════════════════════════════════════
// PARKING
// ══════════════════════════════════════════════
function hlRenderParking(){
  hlEnsureDefaults();
  const canEdit=canEditHouseLife();
  const el=document.getElementById('hl-parking-list');if(!el)return;
  const spots=[...D.houseLife.parking];
  if(!spots.length){
    el.innerHTML=es('ti-car','blue','No parking spots added yet','Add spots to start tracking assignments.',canEdit?'<button class="btn btn-p" onclick="hlOpenAddSpot()">Add Spot</button>':'');
    return;
  }
  const sorted=[...spots].sort((a,b)=>(a.order||0)-(b.order||0));
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">
    ${sorted.map(s=>hlSpotCard(s,canEdit)).join('')}
  </div>`;
}
function hlSpotCard(s,canEdit){
  const name=s.assignedMemberId?esc(mB(s.assignedMemberId).name):(s.assignedLabel?esc(s.assignedLabel):'');
  const carLine=[esc(s.carModel||''),esc(s.licensePlate||'')].filter(Boolean).join(' · ');
  return `<div class="card" style="padding:11px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <span style="font-size:12.5px;font-weight:600">${esc(s.label)}</span>
      ${canEdit?`<div style="display:flex;gap:3px;flex-shrink:0"><button class="btn" style="height:22px;font-size:10px;padding:0 6px" onclick="hlOpenEditSpot('${s.id}')" aria-label="Edit spot"><i class="ti ti-edit"></i></button><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="hlDeleteSpot('${s.id}')" aria-label="Delete spot"><i class="ti ti-trash"></i></button></div>`:''}
    </div>
    <div style="font-size:12.5px;font-weight:500;margin-bottom:2px">${name||'<span style="color:var(--ht);font-weight:400">Vacant</span>'}</div>
    ${carLine?`<div style="font-size:10.5px;color:var(--mt)">${carLine}</div>`:''}
    ${s.notes?`<div style="font-size:10.5px;color:var(--ht);margin-top:3px">${esc(s.notes)}</div>`:''}
  </div>`;
}
function hlOpenAddSpot(){
  if(!canEditHouseLife()){hlDenied();return;}
  document.getElementById('hl-parking-id').value='';
  document.getElementById('hl-parking-label').value='';
  document.getElementById('hl-parking-customname').value='';
  document.getElementById('hl-parking-carmodel').value='';
  document.getElementById('hl-parking-plate').value='';
  document.getElementById('hl-parking-notes').value='';
  const sel=document.getElementById('hl-parking-member');
  if(sel)sel.innerHTML='<option value="">— None / see custom name below —</option>'+hlMemberOptionsHtml(hlEligibleMembers([]),[]);
  openM('m-hl-parking');
}
function hlOpenEditSpot(id){
  if(!canEditHouseLife()){hlDenied();return;}
  const s=D.houseLife.parking.find(x=>x.id===id);if(!s)return;
  document.getElementById('hl-parking-id').value=s.id;
  document.getElementById('hl-parking-label').value=s.label||'';
  document.getElementById('hl-parking-customname').value=s.assignedLabel||'';
  document.getElementById('hl-parking-carmodel').value=s.carModel||'';
  document.getElementById('hl-parking-plate').value=s.licensePlate||'';
  document.getElementById('hl-parking-notes').value=s.notes||'';
  const sel=document.getElementById('hl-parking-member');
  const existing=s.assignedMemberId?[s.assignedMemberId]:[];
  if(sel){sel.innerHTML='<option value="">— None / see custom name below —</option>'+hlMemberOptionsHtml(hlEligibleMembers(existing),existing);sel.value=s.assignedMemberId||'';}
  openM('m-hl-parking');
}
async function hlSaveSpot(){
  if(!canEditHouseLife()){hlDenied();return;}
  const id=document.getElementById('hl-parking-id').value;
  const label=document.getElementById('hl-parking-label').value.trim();
  if(!label){toast('Spot label is required','error');return;}
  const assignedMemberId=document.getElementById('hl-parking-member').value||null;
  const assignedLabel=assignedMemberId?'':document.getElementById('hl-parking-customname').value.trim();
  const carModel=document.getElementById('hl-parking-carmodel').value.trim();
  const licensePlate=document.getElementById('hl-parking-plate').value.trim();
  const notes=document.getElementById('hl-parking-notes').value.trim();
  let prev=null;
  if(id){
    const s=D.houseLife.parking.find(x=>x.id===id);
    if(!s)return;
    prev={...s};
    Object.assign(s,{label,assignedMemberId,assignedLabel,carModel,licensePlate,notes});
  }else{
    const order=D.houseLife.parking.length;
    D.houseLife.parking.push({id:uid(),label,isReserved:false,assignedMemberId,assignedLabel,carModel,licensePlate,notes,order});
  }
  try{
    await saveD('houseLife');
    closeM(null,document.getElementById('m-hl-parking'));
    hlRenderParking();
    toast(id?'Spot updated':'Spot added','success');
  }catch(e){
    if(id&&prev){const s=D.houseLife.parking.find(x=>x.id===id);if(s)Object.assign(s,prev);}
    else{D.houseLife.parking=D.houseLife.parking.filter(x=>x.label!==label);}
    toast('Failed to save spot. Please try again.','error');
  }
}
async function hlDeleteSpot(id){
  if(!canEditHouseLife()){hlDenied();return;}
  const ok=await confirmDialog('Delete Spot','Delete this parking spot?');
  if(!ok)return;
  const idx=D.houseLife.parking.findIndex(x=>x.id===id);
  const removed=idx>=0?D.houseLife.parking[idx]:null;
  D.houseLife.parking=D.houseLife.parking.filter(x=>x.id!==id);
  try{
    await saveD('houseLife');
    hlRenderParking();
    toast('Spot removed','info');
  }catch(e){
    if(removed)D.houseLife.parking.splice(idx,0,removed);
    toast('Failed to remove spot. Please try again.','error');
  }
}

// ══════════════════════════════════════════════
// PREFERENCE POINTS
// ══════════════════════════════════════════════
// A member's total is computed at render time (never stored) so editing a criterion's point
// value immediately reflects in everyone's rank, instead of every existing member's total
// silently going stale until someone re-saves their checklist. Points are tracked per semester
// (prefScores[memberId][semesterLabel]) since who qualifies for what changes every semester —
// hlAllTimeScore sums across every semester a member has one, for the informational all-time
// total alongside the current semester's ranking.
function hlComputeScore(memberId,semester){
  const rec=(D.houseLife.prefScores[memberId]||{})[semester];
  if(!rec)return 0;
  const checked=rec.checkedCriteria||[];
  const quantities=rec.quantities||{};
  let sum=0;
  D.houseLife.prefCriteria.forEach(c=>{
    if(c.perUnit){
      // 'points' is a per-unit rate here (e.g. 0.5/hour), not a flat one-time award.
      sum+=(quantities[c.id]||0)*(c.points||0);
    }else if(checked.includes(c.id)){
      sum+=(c.points||0);
    }
  });
  return sum+(rec.adjustment||0);
}
// allTimeBase is a manually-entered starting total — for points accumulated before this system
// existed, or a straight correction — added on top of whatever the tracked semesters sum to.
function hlAllTimeScore(memberId){
  const rec=D.houseLife.prefScores[memberId]||{};
  const base=rec.allTimeBase||0;
  const semesterTotal=Object.keys(rec).filter(k=>k!=='allTimeBase').reduce((total,sem)=>total+hlComputeScore(memberId,sem),0);
  return base+semesterTotal;
}
// "Spring 2026"/"Fall 2026" style labels (see getSemester()) sorted chronologically — Fall
// sorts after Spring of the same year.
// Alias of the shared semesterSortKey() (js/auth.js) — same logic, kept as its own name since
// every existing call site in this file already uses it.
function hlSemesterSortKey(s){ return semesterSortKey(s); }
// Every semester that has data for any member, plus the current semester (always offered even
// before anyone's logged anything for it yet) — most recent first.
function hlKnownSemesters(){
  const set=new Set([getSemester()]);
  Object.values(D.houseLife.prefScores).forEach(rec=>{
    Object.keys(rec||{}).filter(k=>k!=='allTimeBase').forEach(s=>set.add(s));
  });
  return [...set].sort((a,b)=>hlSemesterSortKey(b)-hlSemesterSortKey(a));
}
function hlRenderPriority(){
  hlEnsureDefaults();
  hlRenderRanking();
  hlRenderCriteria();
}
// These three positions always take the top 3 spots, in this order, regardless of their point
// totals — matched against the roster's free-text Role field (Members tab), not the login/
// permission title system. Everyone else is ranked below them by their All-Time total (not just
// the current semester's points), since priority is meant to reflect a member's full history,
// not just what they've logged since the semester rolled over.
const HL_PINNED_ROLES=['President','Vice President','Treasurer'];
function hlRenderRanking(){
  const el=document.getElementById('hl-rank-table');if(!el)return;
  const canEdit=canEditHouseLife();
  const sem=getSemester();
  // Preference points only concern live-in members (same eligibility as Rooms/Parking) — pull
  // straight from the Members tab's Live-in flag.
  const eligible=sortedMembers().filter(m=>m.liveIn).map(m=>({m,score:hlComputeScore(m.id,sem),allTime:hlAllTimeScore(m.id)}));
  const pinned=HL_PINNED_ROLES.map(role=>eligible.find(r=>r.m.role===role)).filter(Boolean);
  const pinnedIds=new Set(pinned.map(r=>r.m.id));
  const rest=eligible.filter(r=>!pinnedIds.has(r.m.id)).sort((a,b)=>b.allTime-a.allTime);
  const ranked=[...pinned,...rest];
  el.innerHTML=`<thead><tr><th style="width:44px">#</th><th>Member</th><th style="text-align:right">${esc(sem)}</th><th style="text-align:right">All-Time</th><th></th></tr></thead><tbody>${
    ranked.length?ranked.map((r,i)=>`<tr>
      <td style="color:var(--mt)">${i+1}</td>
      <td style="font-weight:500">${esc(r.m.name)}${pinnedIds.has(r.m.id)?` <span class="badge bb2" style="font-size:9px">${esc(r.m.role)}</span>`:''}</td>
      <td style="text-align:right;color:var(--mt)">${r.score}</td>
      <td style="text-align:right;font-weight:600">${r.allTime}</td>
      <td style="white-space:nowrap"><button class="btn" style="height:22px;font-size:10px;padding:0 8px" onclick="hlOpenScoreEditor('${r.m.id}')">${canEdit?'Edit':'View'}</button></td>
    </tr>`).join(''):`<tr><td colspan="5" style="text-align:center;color:var(--mt);padding:18px">No live-in members yet.</td></tr>`
  }</tbody>`;
}
function hlRenderCriteria(){
  const el=document.getElementById('hl-criteria-table');if(!el)return;
  const canEdit=canEditHouseLife();
  const criteria=[...D.houseLife.prefCriteria].sort((a,b)=>(b.points||0)-(a.points||0));
  el.innerHTML=`<thead><tr><th>Criterion</th><th style="width:80px;text-align:right">Points</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    criteria.map(c=>`<tr>
      <td>${esc(c.label)}${c.perUnit?` <span style="font-size:9.5px;color:var(--ht)">(per ${esc(c.unitLabel||'unit')})</span>`:''}</td>
      <td style="text-align:right;font-weight:600">${c.points}${c.perUnit?`<span style="font-weight:400;color:var(--mt)">/${esc(c.unitLabel||'unit')}</span>`:''}</td>
      ${canEdit?`<td style="white-space:nowrap"><button class="btn" style="height:22px;font-size:10px;padding:0 6px" onclick="hlOpenEditCriterion('${c.id}')" aria-label="Edit criterion"><i class="ti ti-edit"></i></button> <button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="hlDeleteCriterion('${c.id}')" aria-label="Delete criterion"><i class="ti ti-trash"></i></button></td>`:''}
    </tr>`).join('')
  }</tbody>`;
}
function hlToggleCritPerUnit(){
  const on=document.getElementById('hl-crit-perunit').checked;
  const row=document.getElementById('hl-crit-unitlabel-row');
  if(row)row.style.display=on?'':'none';
  const lbl=document.getElementById('hl-crit-points-label');
  if(lbl)lbl.textContent=on?'Points per unit *':'Points *';
}
function hlOpenAddCriterion(){
  if(!canEditHouseLife()){hlDenied();return;}
  document.getElementById('hl-crit-id').value='';
  document.getElementById('hl-crit-label').value='';
  document.getElementById('hl-crit-points').value='';
  document.getElementById('hl-crit-perunit').checked=false;
  document.getElementById('hl-crit-unitlabel').value='';
  hlToggleCritPerUnit();
  openM('m-hl-criterion');
}
function hlOpenEditCriterion(id){
  if(!canEditHouseLife()){hlDenied();return;}
  const c=D.houseLife.prefCriteria.find(x=>x.id===id);if(!c)return;
  document.getElementById('hl-crit-id').value=c.id;
  document.getElementById('hl-crit-label').value=c.label;
  document.getElementById('hl-crit-points').value=c.points;
  document.getElementById('hl-crit-perunit').checked=!!c.perUnit;
  document.getElementById('hl-crit-unitlabel').value=c.unitLabel||'';
  hlToggleCritPerUnit();
  openM('m-hl-criterion');
}
async function hlSaveCriterion(){
  if(!canEditHouseLife()){hlDenied();return;}
  const id=document.getElementById('hl-crit-id').value;
  const label=document.getElementById('hl-crit-label').value.trim();
  const points=parseFloat(document.getElementById('hl-crit-points').value);
  const perUnit=document.getElementById('hl-crit-perunit').checked;
  const unitLabel=document.getElementById('hl-crit-unitlabel').value.trim()||'units';
  if(!label){toast('Label is required','error');return;}
  if(isNaN(points)||points<0){toast('Points must be a non-negative number','error');return;}
  let prev=null;
  if(id){
    const c=D.houseLife.prefCriteria.find(x=>x.id===id);
    if(!c)return;
    prev={...c};
    Object.assign(c,{label,points,perUnit,unitLabel:perUnit?unitLabel:undefined});
    if(!perUnit)delete c.unitLabel;
  }else{
    D.houseLife.prefCriteria.push({id:uid(),label,points,order:D.houseLife.prefCriteria.length,perUnit,...(perUnit?{unitLabel}:{})});
  }
  try{
    await saveD('houseLife');
    closeM(null,document.getElementById('m-hl-criterion'));
    hlRenderCriteria();
    hlRenderRanking();
    toast(id?'Criterion updated':'Criterion added','success');
  }catch(e){
    if(id&&prev){const c=D.houseLife.prefCriteria.find(x=>x.id===id);if(c)Object.assign(c,prev);}
    else{D.houseLife.prefCriteria=D.houseLife.prefCriteria.filter(x=>!(x.label===label&&x.points===points));}
    toast('Failed to save criterion. Please try again.','error');
  }
}
async function hlDeleteCriterion(id){
  if(!canEditHouseLife()){hlDenied();return;}
  const ok=await confirmDialog('Delete Criterion','Remove this from the rubric? Any member currently checked for it will lose those points.');
  if(!ok)return;
  const idx=D.houseLife.prefCriteria.findIndex(x=>x.id===id);
  const removed=idx>=0?D.houseLife.prefCriteria[idx]:null;
  D.houseLife.prefCriteria=D.houseLife.prefCriteria.filter(x=>x.id!==id);
  // Strip the removed criterion out of every member's checked list (every semester) so a score
  // never silently references a criterion that no longer exists. allTimeBase is a plain number,
  // not a semester record — skipped explicitly rather than relying on it having no
  // .checkedCriteria property.
  Object.values(D.houseLife.prefScores).forEach(memberRec=>{
    Object.entries(memberRec||{}).forEach(([key,rec])=>{
      if(key==='allTimeBase')return;
      if(rec&&rec.checkedCriteria)rec.checkedCriteria=rec.checkedCriteria.filter(cid=>cid!==id);
    });
  });
  try{
    await saveD('houseLife');
    hlRenderCriteria();
    hlRenderRanking();
    toast('Criterion removed','info');
  }catch(e){
    if(removed)D.houseLife.prefCriteria.splice(idx,0,removed);
    toast('Failed to remove criterion. Please try again.','error');
  }
}

// Per-member score editor — always openable (everyone can see the breakdown behind a member's
// rank), but checkboxes/adjustment/semester fields are disabled and the Save button hidden for
// viewers. Points are tracked per semester, so this includes a semester picker (defaulting to
// the current one) that re-renders the checklist for whichever semester is selected.
function hlOpenScoreEditor(memberId){
  const m=mB(memberId);
  const canEdit=canEditHouseLife();
  document.getElementById('hl-score-memberid').value=memberId;
  const titleEl=document.getElementById('hl-scoreedit-title');
  if(titleEl&&titleEl.childNodes[0])titleEl.childNodes[0].textContent=m.name+"'s Preference Points";
  const semSel=document.getElementById('hl-score-semester');
  const semesters=hlKnownSemesters();
  semSel.innerHTML=semesters.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  semSel.value=getSemester();
  semSel.disabled=!canEdit;
  const baseInp=document.getElementById('hl-score-alltimebase');
  baseInp.value=(D.houseLife.prefScores[memberId]||{}).allTimeBase||0;
  baseInp.disabled=!canEdit;
  const actions=document.getElementById('hl-scoreedit-actions');
  if(actions)actions.style.display=canEdit?'':'none';
  hlRenderScoreEditorBody(memberId,semSel.value,canEdit);
  openM('m-hl-scoreedit');
}
function hlScoreEditorSemesterChanged(){
  const memberId=document.getElementById('hl-score-memberid').value;
  const semester=document.getElementById('hl-score-semester').value;
  hlRenderScoreEditorBody(memberId,semester,canEditHouseLife());
}
function hlRenderScoreEditorBody(memberId,semester,canEdit){
  const rec=(D.houseLife.prefScores[memberId]||{})[semester]||{checkedCriteria:[],quantities:{},adjustment:0,adjustmentNote:''};
  const quantities=rec.quantities||{};
  const criteria=[...D.houseLife.prefCriteria].sort((a,b)=>(b.points||0)-(a.points||0));
  const checksEl=document.getElementById('hl-score-checks');
  checksEl.innerHTML=criteria.length?criteria.map(c=>{
    if(c.perUnit){
      return `<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:12px">
        <span>${esc(c.label)}</span>
        <span style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <input type="number" min="0" step="1" class="hl-score-qty" data-crit="${c.id}" value="${quantities[c.id]||0}" style="width:60px;padding:3px 6px;border:1px solid var(--bdr);border-radius:5px;font-size:11.5px;background:var(--bg);color:var(--tx)" ${canEdit?'oninput="hlUpdateScoreTotal()"':'disabled'}>
          <span style="color:var(--mt);font-size:10.5px;white-space:nowrap">${esc(c.unitLabel||'units')} × ${c.points}</span>
        </span>
      </label>`;
    }
    return `<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:12px;${canEdit?'cursor:pointer':''}">
    <span style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="hl-score-check" value="${c.id}" ${(rec.checkedCriteria||[]).includes(c.id)?'checked':''} ${canEdit?'onchange="hlUpdateScoreTotal()"':'disabled'}> ${esc(c.label)}</span>
    <span style="color:var(--mt)">${c.points}</span>
  </label>`;
  }).join(''):'<div style="font-size:11.5px;color:var(--ht);padding:8px 0">No criteria defined yet.</div>';
  const adj=document.getElementById('hl-score-adjustment');
  adj.value=rec.adjustment||0;
  adj.disabled=!canEdit;
  const note=document.getElementById('hl-score-adjustmentnote');
  note.value=rec.adjustmentNote||'';
  note.disabled=!canEdit;
  hlUpdateScoreTotal();
}
function hlUpdateScoreTotal(){
  const memberId=document.getElementById('hl-score-memberid').value;
  const semester=document.getElementById('hl-score-semester').value;
  const checked=[...document.querySelectorAll('.hl-score-check:checked')].map(c=>c.value);
  const adjustment=parseFloat(document.getElementById('hl-score-adjustment').value)||0;
  let sum=checked.reduce((total,cid)=>{
    const c=D.houseLife.prefCriteria.find(x=>x.id===cid);
    return total+(c?c.points:0);
  },0);
  document.querySelectorAll('.hl-score-qty').forEach(inp=>{
    const c=D.houseLife.prefCriteria.find(x=>x.id===inp.dataset.crit);
    sum+=(parseFloat(inp.value)||0)*(c?c.points:0);
  });
  const thisSemesterTotal=sum+adjustment;
  document.getElementById('hl-score-total').textContent=thisSemesterTotal;

  // All-time preview: the starting-points input, plus every OTHER already-saved semester's
  // stored total, plus this semester's live (unsaved) total shown above.
  const base=parseFloat(document.getElementById('hl-score-alltimebase').value)||0;
  const rec=D.houseLife.prefScores[memberId]||{};
  const otherSemestersTotal=Object.keys(rec).filter(k=>k!=='allTimeBase'&&k!==semester).reduce((t,s)=>t+hlComputeScore(memberId,s),0);
  const allTimeEl=document.getElementById('hl-score-alltime-total');
  if(allTimeEl)allTimeEl.textContent=(base+otherSemestersTotal+thisSemesterTotal);
}
async function hlSaveScore(){
  if(!canEditHouseLife()){hlDenied();return;}
  const memberId=document.getElementById('hl-score-memberid').value;
  if(!memberId)return;
  const semester=document.getElementById('hl-score-semester').value;
  if(!semester)return;
  const checkedCriteria=[...document.querySelectorAll('.hl-score-check:checked')].map(c=>c.value);
  const quantities={};
  document.querySelectorAll('.hl-score-qty').forEach(inp=>{
    const qty=parseFloat(inp.value)||0;
    if(qty>0)quantities[inp.dataset.crit]=qty;
  });
  const adjustment=parseFloat(document.getElementById('hl-score-adjustment').value)||0;
  const adjustmentNote=document.getElementById('hl-score-adjustmentnote').value.trim();
  const allTimeBase=parseFloat(document.getElementById('hl-score-alltimebase').value)||0;
  if(!D.houseLife.prefScores[memberId])D.houseLife.prefScores[memberId]={};
  const prevSemesterRec=D.houseLife.prefScores[memberId][semester]?{...D.houseLife.prefScores[memberId][semester]}:null;
  const prevBase=D.houseLife.prefScores[memberId].allTimeBase;
  D.houseLife.prefScores[memberId][semester]={checkedCriteria,quantities,adjustment,adjustmentNote};
  D.houseLife.prefScores[memberId].allTimeBase=allTimeBase;
  try{
    await saveD('houseLife');
    closeM(null,document.getElementById('m-hl-scoreedit'));
    hlRenderRanking();
    toast('Preference points saved','success');
  }catch(e){
    if(prevSemesterRec)D.houseLife.prefScores[memberId][semester]=prevSemesterRec;
    else delete D.houseLife.prefScores[memberId][semester];
    D.houseLife.prefScores[memberId].allTimeBase=prevBase;
    toast('Failed to save. Please try again.','error');
  }
}

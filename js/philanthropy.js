// ── PHILANTHROPY (fundraising) ──
function canEditPhilanthropy(){
  return canEditPage('philanthropy');
}
// Events live in the shared D.events calendar (type:'philanthropy') so Philanthropy's
// event list always matches what's on the Calendar page, not a separate copy.
function phEvents(){
  return (D.events||[]).filter(e=>e.type==='philanthropy');
}

// ── Semester scoping — fundraising logs and events already carry a real `date` field (date-range
// filter, no stamp needed); goals restructure to {[semesterLabel]:{events,funds}}, same pattern as
// Finance's budget. Organizations/vendors are pure reference data (no dates) and stay unpartitioned,
// same category as Community Service's locations[].
let PH_SELECTED_SEM=null;
function phSem(){ return PH_SELECTED_SEM||getSemester(); }
function phKnownSemesters(){
  return unionKnownSemesters([
    ...(D.philanthropy.fundraisingLogs||[]).map(f=>semesterLabelForDate(f.date)),
    ...phEvents().map(e=>semesterLabelForDate(e.date)),
    ...Object.keys(D.philanthropy.goals||{}),
  ].filter(Boolean));
}
function phVisibleLogs(){
  return (D.philanthropy.fundraisingLogs||[]).filter(f=>semesterLabelForDate(f.date)===phSem());
}
function phVisibleEvents(){
  return phEvents().filter(e=>semesterLabelForDate(e.date)===phSem());
}
function phEnsureGoalsMigrated(){
  if(!D.philanthropy.goals)D.philanthropy.goals={};
  const isLegacyFlat=('events' in D.philanthropy.goals)||('funds' in D.philanthropy.goals);
  if(isLegacyFlat){ D.philanthropy.goals={[getSemester()]:D.philanthropy.goals}; }
}
function phGoalForSemester(sem){
  return (D.philanthropy.goals||{})[sem||phSem()]||{events:4,funds:2000};
}
function phSemesterChanged(){
  PH_SELECTED_SEM=document.getElementById('ph-semester-select').value;
  renderPhilanthropy();
}

function renderPhilanthropy(){
  phEnsureGoalsMigrated();
  initSemesterSelect('ph-semester-select',phKnownSemesters(),phSemesterChanged,phSem());
  const canEditNow=canEditPhilanthropy()&&isCurrentSemester(phSem());
  const logBtn=document.getElementById('ph-log-funds-btn');if(logBtn)logBtn.style.display=canEditNow?'':'none';
  const addEvBtn=document.getElementById('ph-add-event-btn');if(addEvBtn)addEvBtn.style.display=canEditNow?'':'none';
  const events=phVisibleEvents();
  const logs=phVisibleLogs();
  const totalRaised=Math.round(logs.reduce((s,f)=>s+(f.amount||0),0)*100)/100;
  const avgPerEvent=events.length?Math.round(totalRaised/events.length*100)/100:0;
  const goal=phGoalForSemester();
  const goalProgress=pc(totalRaised,goal.funds);

  document.getElementById('ph-kpi').innerHTML=
    statStrip('Total Funds Raised','$'+totalRaised.toLocaleString(),phSem(),'neutral')+
    statStrip('Philanthropy Events',events.length,events.length>=goal.events?'Goal met':'Toward '+goal.events+' events',events.length>=goal.events?'up':'neutral')+
    statStrip('Avg Raised / Event','$'+avgPerEvent.toLocaleString(),'Per event','neutral')+
    statStrip('Goal Progress',goalProgress+'%','Toward $'+goal.funds.toLocaleString(),goalProgress>=75?'up':'neutral');

  phRenderGoalBars();
  phRenderChart();
  phRenderEventRank();
  phRenderEvents();
  phRenderFundsLog();
  phRenderOrgs();
  phRenderVendors();
}

function phRenderGoalBars(){
  const goal=phGoalForSemester();
  const totalRaised=phVisibleLogs().reduce((s,f)=>s+(f.amount||0),0);
  const eventsCount=phVisibleEvents().length;
  const btn=document.getElementById('ph-goal-edit-btn');
  if(btn)btn.style.display=(canEditPhilanthropy()&&isCurrentSemester(phSem()))?'':'none';
  const bars=[
    {title:'Funds Raised',cur:Math.round(totalRaised),tgt:goal.funds,prefix:'$'},
    {title:'Events',cur:eventsCount,tgt:goal.events,prefix:''},
  ];
  document.getElementById('ph-goal-bars').innerHTML=bars.map(b=>{
    const p=Math.min(pc(b.cur,b.tgt),100);
    return `<div class="pr"><span class="pl">${b.title} (${b.prefix}${b.cur.toLocaleString()}/${b.prefix}${b.tgt.toLocaleString()})</span><div class="pb"><div class="pf" style="width:${p}%;background:${pgc(p)}"></div></div><span class="pv">${p}%</span></div>`;
  }).join('');
}

function phRenderChart(){
  const logs=phVisibleLogs();
  const chartEl=document.getElementById('ph-chart');
  const labEl=document.getElementById('ph-chart-labels');
  if(!chartEl)return;
  if(!logs.length){
    chartEl.innerHTML=`<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--ht)">No funds logged yet</div>`;
    if(labEl)labEl.innerHTML='';
    return;
  }
  const byWeek={};
  logs.forEach(f=>{
    if(!f.date)return;
    const d=new Date(f.date+'T12:00:00');
    const weekStart=new Date(d);weekStart.setDate(d.getDate()-d.getDay());
    const key=localDateStr(weekStart);
    byWeek[key]=(byWeek[key]||0)+(f.amount||0);
  });
  const weeks=Object.keys(byWeek).sort().slice(-8);
  const data=weeks.map(w=>byWeek[w]);
  const labels=weeks.map(w=>mos(w)+' '+dom(w));
  const mx=Math.max(...data,1);
  chartEl.innerHTML=data.map((v,i)=>`<div class="mb" style="flex:1;height:${Math.round(v/mx*100)}%;background:${i===data.length-1?'var(--gn)':'var(--gn-bg)'};border-radius:3px 3px 0 0" title="${labels[i]}: $${v.toLocaleString()}"></div>`).join('');
  if(labEl)labEl.innerHTML=labels.map(l=>`<span>${l}</span>`).join('');
}

function phRenderEventRank(){
  const events=phVisibleEvents();
  const logs=phVisibleLogs();
  const el=document.getElementById('ph-event-rank');
  if(!el)return;
  const totals=events.map(e=>({e,total:logs.filter(f=>f.eventId===e.id).reduce((s,f)=>s+(f.amount||0),0)})).sort((a,b)=>b.total-a.total).slice(0,6);
  if(!totals.length){ el.innerHTML=es('ti-trophy','slate','No events yet','Add an event and log funds to see rankings.',''); return; }
  const mx=Math.max(...totals.map(t=>t.total),1);
  el.innerHTML=totals.map(({e,total})=>`
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px"><span style="font-weight:500">${esc(e.title)}</span><span style="color:var(--mt)">$${total.toLocaleString()}</span></div>
      <div class="pb"><div class="pf" style="width:${Math.round(total/mx*100)}%;background:var(--gn)"></div></div>
    </div>`).join('');
}

function phRenderEvents(){
  const events=phVisibleEvents();
  const canEdit=canEditPhilanthropy()&&isCurrentSemester(phSem());
  const el=document.getElementById('ph-events-table');
  if(!el)return;
  const mobEl=document.getElementById('ph-events-mobile-cards');
  if(!events.length){
    el.innerHTML=`<tbody><tr><td>${es('ti-heart','slate','No philanthropy events','Add an event to get started.',canEdit?`<button class="btn btn-p" onclick="phOpenAddEvent()">Add Event</button>`:'')}</td></tr></tbody>`;
    if(mobEl)mobEl.innerHTML=`<div style="grid-column:1/-1">${es('ti-heart','slate','No philanthropy events','Add an event to get started.',canEdit?`<button class="btn btn-p" onclick="phOpenAddEvent()">Add Event</button>`:'')}</div>`;
    return;
  }
  const sorted=[...events].sort((a,b)=>b.date.localeCompare(a.date));
  el.innerHTML=`<thead><tr><th>Event</th><th>Date</th><th>Org</th><th>Fund Goal</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    sorted.map(e=>`<tr><td style="font-weight:500">${esc(e.title)}</td><td>${fds(e.date)}</td><td style="color:var(--mt)">${esc(e.org)||'N/A'}</td><td>${e.fundGoal?'$'+e.fundGoal.toLocaleString():'N/A'}</td>${canEdit?`<td><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="deletePhEvent('${e.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`).join('')
  }</tbody>`;
  if(mobEl)mobEl.innerHTML=sorted.map(e=>`<div class="mob-card card">
    <div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(e.title)}</div>
    <div style="font-size:11px;color:var(--mt);margin-bottom:8px">${fds(e.date)}${e.org?' · '+esc(e.org):''}</div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:12px;color:var(--mt)">${e.fundGoal?'Goal: $'+e.fundGoal.toLocaleString():'No fund goal set'}</span>
      ${canEdit?`<button class="btn btn-d" style="height:24px;font-size:10.5px;padding:0 8px" onclick="deletePhEvent('${e.id}')" aria-label="Delete ${esc(e.title)}"><i class="ti ti-trash"></i></button>`:''}
    </div>
  </div>`).join('');
}

function phRenderFundsLog(){
  const logs=phVisibleLogs();
  const canEdit=canEditPhilanthropy()&&isCurrentSemester(phSem());
  const el=document.getElementById('ph-funds-log');
  if(!el)return;
  if(!logs.length){ el.innerHTML=es('ti-coin','slate','No funds logged','Log money raised to track fundraising progress.',''); return; }
  el.innerHTML=[...logs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(f=>{
    const donor=f.memberId?mB(f.memberId).name:'External / Chapter';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr)">
      <div><div style="font-size:12px;font-weight:500">${esc(donor)}</div><div style="font-size:10.5px;color:var(--ht)">${fds(f.date)}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;font-weight:600;color:var(--gn)">+$${(f.amount||0).toLocaleString()}</span>
        ${canEdit?`<button class="btn btn-d" style="height:20px;font-size:9px;padding:0 5px" onclick="deletePhFunds('${f.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`:''}
      </div>
    </div>`;
  }).join('');
}

function phRenderOrgs(){
  const orgs=D.philanthropy.organizations||[];
  const canEdit=canEditPhilanthropy();
  const el=document.getElementById('ph-orgs-table');
  if(!el)return;
  if(!orgs.length){ el.innerHTML=`<tbody><tr><td>${es('ti-building-community','slate','No organizations yet','Add the causes/organizations this chapter supports.','')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Organization</th><th>Contact</th><th>Notes</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    orgs.map(o=>`<tr><td style="font-weight:500">${esc(o.name)}</td><td style="color:var(--mt)">${esc(o.contact)||'N/A'}</td><td style="color:var(--mt)">${esc(o.notes)||'N/A'}</td>${canEdit?`<td><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="phDeleteOrg('${o.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`).join('')
  }</tbody>`;
}

// ── ACTIONS ──
function phOpenAddEvent(){
  if(!canEditPhilanthropy()){toast('Only officers with Philanthropy access can add events.','error');return;}
  if(!isCurrentSemester(phSem())){toast('This semester is read-only.','error');return;}
  ['ph-ev-title','ph-ev-date','ph-ev-goal','ph-ev-org','ph-ev-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openM('m-ph-addevent');
}
async function phAddEvent(){
  if(!canEditPhilanthropy()||!isCurrentSemester(phSem()))return;
  const title=document.getElementById('ph-ev-title').value.trim();
  if(!title){toast('Event name is required','error');return;}
  const event={id:uid(),title,type:'philanthropy',date:document.getElementById('ph-ev-date').value||localDateStr(),fundGoal:parseFloat(document.getElementById('ph-ev-goal').value)||0,org:document.getElementById('ph-ev-org').value.trim(),notes:document.getElementById('ph-ev-notes').value.trim()};
  D.events.push(event);
  try{
    await saveD('events');
    closeM(null,document.getElementById('m-ph-addevent'));
    renderPhilanthropy();
    if(typeof renderCalendar==='function')renderCalendar();
    toast('Event added','success');
  }catch(e){
    D.events=D.events.filter(x=>x.id!==event.id);
    toast('Failed to add event. Please try again.','error');
  }
}
function phOpenLogFunds(){
  if(!canEditPhilanthropy()){toast('Only officers with Philanthropy access can log funds.','error');return;}
  if(!isCurrentSemester(phSem())){toast('This semester is read-only.','error');return;}
  const memberSel=document.getElementById('pf-member');
  memberSel.innerHTML='<option value="">Chapter / External</option>'+mOpts();
  const eventSel=document.getElementById('pf-event');
  eventSel.innerHTML='<option value="">-- General --</option>'+phVisibleEvents().map(e=>`<option value="${e.id}">${esc(e.title)}</option>`).join('');
  document.getElementById('pf-amount').value='';
  document.getElementById('pf-date').value=localDateStr();
  document.getElementById('pf-notes').value='';
  openM('m-ph-logfunds');
}
async function phLogFunds(){
  if(!canEditPhilanthropy()||!isCurrentSemester(phSem()))return;
  const amount=parseFloat(document.getElementById('pf-amount').value);
  if(!amount||amount<=0){toast('Enter a valid amount','error');return;}
  const log={id:uid(),amount,memberId:document.getElementById('pf-member').value||null,date:document.getElementById('pf-date').value||localDateStr(),eventId:document.getElementById('pf-event').value||null,notes:document.getElementById('pf-notes').value.trim()};
  D.philanthropy.fundraisingLogs.push(log);
  try{
    await saveD('philanthropy');
    closeM(null,document.getElementById('m-ph-logfunds'));
    renderPhilanthropy();
    toast('$'+amount.toLocaleString()+' logged','success');
  }catch(e){
    D.philanthropy.fundraisingLogs=D.philanthropy.fundraisingLogs.filter(x=>x.id!==log.id);
    toast('Failed to log funds. Please try again.','error');
  }
}
function phOpenAddOrg(){
  if(!canEditPhilanthropy()){toast('Only officers with Philanthropy access can add organizations.','error');return;}
  ['ph-org-name','ph-org-contact','ph-org-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openM('m-ph-addorg');
}
async function phAddOrg(){
  if(!canEditPhilanthropy())return;
  const name=document.getElementById('ph-org-name').value.trim();
  if(!name){toast('Organization name is required','error');return;}
  const org={id:uid(),name,contact:document.getElementById('ph-org-contact').value.trim(),notes:document.getElementById('ph-org-notes').value.trim()};
  D.philanthropy.organizations.push(org);
  try{
    await saveD('philanthropy');
    closeM(null,document.getElementById('m-ph-addorg'));
    renderPhilanthropy();
    toast('Organization added','success');
  }catch(e){
    D.philanthropy.organizations=D.philanthropy.organizations.filter(x=>x.id!==org.id);
    toast('Failed to add organization. Please try again.','error');
  }
}
async function phDeleteOrg(id){
  if(!canEditPhilanthropy())return;
  const ok=await confirmDialog('Remove Organization','Remove this organization?');
  if(!ok)return;
  const removed=D.philanthropy.organizations.find(o=>o.id===id);
  D.philanthropy.organizations=D.philanthropy.organizations.filter(o=>o.id!==id);
  try{await saveD('philanthropy');renderPhilanthropy();toast('Organization removed','info');}
  catch(e){if(removed)D.philanthropy.organizations.push(removed);toast('Failed to remove organization. Please try again.','error');}
}

function phRenderVendors(){
  const vendors=D.philanthropy.vendors||[];
  const canEdit=canEditPhilanthropy();
  const el=document.getElementById('ph-vendors-table');
  if(!el)return;
  if(!vendors.length){ el.innerHTML=`<tbody><tr><td>${es('ti-truck-delivery','slate','No vendors or donors yet','Track who is donating or providing what for your events.','')}</td></tr></tbody>`; return; }
  el.innerHTML=`<thead><tr><th>Name</th><th>Contact</th><th>Contribution</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${
    vendors.map(v=>`<tr><td style="font-weight:500">${esc(v.name)}</td><td style="color:var(--mt)">${esc(v.contact)||'N/A'}</td><td style="color:var(--mt)">${esc(v.contribution)||'N/A'}</td>${canEdit?`<td><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="phDeleteVendor('${v.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></td>`:''}</tr>`).join('')
  }</tbody>`;
}
function phOpenAddVendor(){
  if(!canEditPhilanthropy()){toast('Only officers with Philanthropy access can add vendors.','error');return;}
  ['ph-vd-name','ph-vd-contact','ph-vd-contribution','ph-vd-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openM('m-ph-addvendor');
}
async function phAddVendor(){
  if(!canEditPhilanthropy())return;
  const name=document.getElementById('ph-vd-name').value.trim();
  if(!name){toast('Vendor/donor name is required','error');return;}
  const vendor={id:uid(),name,contact:document.getElementById('ph-vd-contact').value.trim(),contribution:document.getElementById('ph-vd-contribution').value.trim(),notes:document.getElementById('ph-vd-notes').value.trim()};
  D.philanthropy.vendors.push(vendor);
  try{
    await saveD('philanthropy');
    closeM(null,document.getElementById('m-ph-addvendor'));
    renderPhilanthropy();
    toast('Vendor added','success');
  }catch(e){
    D.philanthropy.vendors=D.philanthropy.vendors.filter(x=>x.id!==vendor.id);
    toast('Failed to add vendor. Please try again.','error');
  }
}
async function phDeleteVendor(id){
  if(!canEditPhilanthropy())return;
  const ok=await confirmDialog('Remove Vendor','Remove this vendor/donor?');
  if(!ok)return;
  const removed=D.philanthropy.vendors.find(v=>v.id===id);
  D.philanthropy.vendors=D.philanthropy.vendors.filter(v=>v.id!==id);
  try{await saveD('philanthropy');renderPhilanthropy();toast('Vendor removed','info');}
  catch(e){if(removed)D.philanthropy.vendors.push(removed);toast('Failed to remove vendor. Please try again.','error');}
}

function phOpenGoalEdit(){
  if(!canEditPhilanthropy()){toast('Only officers with Philanthropy access can edit goals.','error');return;}
  if(!isCurrentSemester(phSem())){toast('This semester is read-only.','error');return;}
  const goal=phGoalForSemester();
  document.getElementById('phg-funds').value=goal.funds||'';
  document.getElementById('phg-events').value=goal.events||'';
  openM('m-ph-goal');
}
async function phSaveGoal(){
  if(!canEditPhilanthropy()||!isCurrentSemester(phSem()))return;
  const funds=parseFloat(document.getElementById('phg-funds').value)||0;
  const events=parseFloat(document.getElementById('phg-events').value)||0;
  const sem=phSem();
  const prev=D.philanthropy.goals[sem];
  D.philanthropy.goals[sem]={funds,events};
  try{
    await saveD('philanthropy');
    closeM(null,document.getElementById('m-ph-goal'));
    renderPhilanthropy();
    toast('Goals updated','success');
  }catch(e){
    D.philanthropy.goals[sem]=prev;
    toast('Failed to update goals. Please try again.','error');
  }
}

function phExport(){
  const logs=phVisibleLogs();
  const events=phVisibleEvents();
  let csv='Donor,Amount,Event,Date,Notes\n';
  logs.forEach(f=>{
    const ev=events.find(e=>e.id===f.eventId);
    const donor=f.memberId?mB(f.memberId).name:'External / Chapter';
    csv+=`${csvSafe(donor)},${f.amount},${csvSafe(ev?ev.title:'General')},${f.date},${csvSafe((f.notes||'').replace(/,/g,';'))}\n`;
  });
  downloadCSV(`philanthropy_fundraising_${phSem().replace(/\s+/g,'_')}.csv`,csv);
}

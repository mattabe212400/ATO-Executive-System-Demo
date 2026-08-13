// ═══════════════════════════════════════════
// FINANCE & DUES MANAGEMENT
// ═══════════════════════════════════════════

const FIN_SEMESTER_DUES_DEFAULT = 0;    // No default — must be set by Treasurer
const BUDGET_ALERT_THRESHOLD    = 0.85; // Warn when spending exceeds 85% of budget

// Default categories — used as fallback when chapter has not customized yet.
// Stored in D.settings.budgetCategories as [{name, color, icon, flexible}] for full
// customization. `flexible` distinguishes fixed/required costs (rent, utilities, national dues —
// can't realistically be cut mid-semester) from discretionary spending (events, scholarship —
// where the exec board actually has room to adjust). Missing/undefined on an older chapter's
// already-saved categories reads as flexible (see getCatFlexible()) — a safe default that never
// mislabels a legacy category as a hard commitment it was never marked as.
// Example category set for demo purposes — not any specific chapter's real budget.
const FIN_DEFAULT_CATS = [
  {name:'Housing Rent',          color:'var(--navy)', icon:'ti-home',       flexible:false},
  {name:'Housing Maintenance',   color:'var(--navy)', icon:'ti-home',       flexible:false},
  {name:'Housing Miscellaneous', color:'var(--navy)', icon:'ti-home',       flexible:false},
  {name:'Utilities Electric',    color:'var(--am)',   icon:'ti-bolt',       flexible:false},
  {name:'Utilities Water & Trash',color:'var(--am)',  icon:'ti-recycle',    flexible:false},
  {name:'Administrative IFC Dues',  color:'var(--mt)', icon:'ti-building', flexible:false},
  {name:'Administrative Insurance', color:'var(--mt)', icon:'ti-shield',   flexible:false},
  {name:'Events Recruitment',    color:'var(--bl)',   icon:'ti-user-plus', flexible:true},
  {name:'Events Social',         color:'var(--bl)',   icon:'ti-confetti',  flexible:true},
  {name:'Events Philanthropy',   color:'var(--rd)',   icon:'ti-heart',     flexible:true},
  {name:'Events Brotherhood',    color:'var(--bl)',   icon:'ti-users',     flexible:true},
  {name:'Events Alumni',         color:'var(--bl)',   icon:'ti-users-group',flexible:true},
  {name:'Scholarship',           color:'var(--gn)',   icon:'ti-school',    flexible:true},
  {name:'Risk Management',       color:'var(--rd)',   icon:'ti-shield-check',flexible:true},
  {name:'Miscellaneous',         color:'var(--ht)',   icon:'ti-dots',      flexible:true},
];
function getBudgetCats(){
  const custom=D?.settings?.budgetCategories;
  return (custom&&custom.length)?custom:FIN_DEFAULT_CATS;
}
function getCatNames(){ return getBudgetCats().map(c=>c.name); }
function getCatColor(name){ return getBudgetCats().find(c=>c.name===name)?.color||'var(--navy)'; }
function getCatIcon(name){  return getBudgetCats().find(c=>c.name===name)?.icon||'ti-cash'; }
// A category with no `flexible` field at all (saved before this feature existed) defaults to
// flexible — only an explicit false marks it Non-Flexible.
function getCatFlexible(name){ return getBudgetCats().find(c=>c.name===name)?.flexible!==false; }
let FIN_ACTIVE_TAB = 'fin-overview';
let FIN_CAN_EDIT = false;
let FIN_SELECTED_SEM=null;

// ── SEMESTER-KEYED DUES/BUDGET (per-member dues and the chapter budget both live under
// {[semesterLabel]: {...}} now, mirroring House Life's prefScores pattern — a fresh ledger each
// semester, with past semesters frozen and viewable via the selector). ──
function finSem(){ return FIN_SELECTED_SEM||getSemester(); }
// One-time migration: a chapter's existing dues/budget were flat (not semester-keyed) before this
// feature shipped — wrap the legacy flat object into the current semester's slot the first time
// it's encountered, so existing balances aren't lost. Detected by the presence of a top-level
// 'paid'/'status' field (the old shape) instead of semester-label keys (the new shape).
function finEnsureDuesMigrated(){
  if(!D.finance.dues)D.finance.dues={};
  Object.keys(D.finance.dues).forEach(mid=>{
    const rec=D.finance.dues[mid];
    if(rec&&(('paid' in rec)||('status' in rec))){
      D.finance.dues[mid]={[getSemester()]:rec};
    }
  });
}
function finEnsureBudgetMigrated(){
  if(!D.finance.budget)D.finance.budget={};
  const isLegacyFlat=Object.values(D.finance.budget).some(v=>typeof v==='number');
  if(isLegacyFlat){
    D.finance.budget={[getSemester()]:D.finance.budget};
  }
}
// Read-only accessor for one member's dues record in a given (or current-viewed) semester.
function finDuesRec(memberId,semester){
  return (D.finance.dues?.[memberId]||{})[semester||finSem()]||null;
}
// Map of memberId -> dues record for the given semester — lets every existing render function
// keep its familiar `dues[m.id]` access pattern by just swapping what `dues` itself points to.
function finDuesMapForSemester(semester){
  const sem=semester||finSem();
  const out={};
  Object.keys(D.finance.dues||{}).forEach(mid=>{ out[mid]=D.finance.dues[mid][sem]||null; });
  return out;
}
// Creates a member's dues record for a semester with defaults if it doesn't exist yet — used by
// every mutating function (record payment, add fine, etc.), always against the CURRENT semester
// since past semesters are read-only and these mutation entry points are already hidden/blocked
// when viewing one.
function finEnsureDuesRec(memberId,semester){
  const sem=semester||getSemester();
  if(!D.finance.dues)D.finance.dues={};
  if(!D.finance.dues[memberId])D.finance.dues[memberId]={};
  if(!D.finance.dues[memberId][sem])D.finance.dues[memberId][sem]={semesterDues:getSemDues(memberId,sem),paid:0,status:'Partial',lastPayment:'',fineCount:0,notes:'',restriction:'None'};
  return D.finance.dues[memberId][sem];
}
function finBudgetForSemester(semester){
  return (D.finance.budget||{})[semester||finSem()]||{};
}
function finKnownSemesters(){
  const duesSems=Object.values(D.finance.dues||{}).flatMap(rec=>Object.keys(rec||{}));
  const budgetSems=Object.keys(D.finance.budget||{});
  return unionKnownSemesters([...duesSems,...budgetSems]);
}
function finSemesterChanged(){
  FIN_SELECTED_SEM=document.getElementById('fin-semester-select').value;
  finTab(document.querySelector('.fin-tab[data-tab="'+FIN_ACTIVE_TAB+'"]'),FIN_ACTIVE_TAB);
}

// Dynamic dues — reads from D.settings based on member type (New Member / inHouse / outOfHouse).
// Member type comes from the explicit m.memberStatus field (Active/New Member), NOT class
// year — a Freshman can already be an initiated active brother, and a Sophomore/Junior can be
// a brand-new member (transfer, spring bid, etc.), so class year can never stand in for status.
function getSemDues(memberId,semester){
  const m = memberId ? D.members.find(x=>x.id===memberId) : null;
  const s = D.settings||{};
  // Per-member override takes priority (now semester-scoped, same as the rest of the dues record)
  const override = finDuesRec(memberId,semester)?.customDues;
  if(override) return override;
  // Determine type: New Member = explicit memberStatus, inHouse = liveIn, outOfHouse = !liveIn
  if(m) {
    if((m.memberStatus||'Active')==='New Member') return s.duesPledge||0;
    if(m.liveIn) return s.duesInHouse||0;
    return s.duesOutOfHouse||0;
  }
  // Fallback for overview: use in-house as representative
  return s.duesInHouse||s.duesOutOfHouse||s.duesPledge||0;
}
// Label for which dues tier actually produced a member's rate — lets the Treasurer see why a
// number is what it is, rather than just the resulting dollar amount.
function finDuesTierLabel(memberId,semester){
  const m = D.members.find(x=>x.id===memberId);
  if(!m) return 'N/A';
  if(finDuesRec(memberId,semester)?.customDues) return 'Custom';
  if((m.memberStatus||'Active')==='New Member') return 'New Member';
  return m.liveIn?'In-House':'Out-of-House';
}

// ── PERMISSION CHECK ──
function finCheckPerms(){
  return canEditPage('finance');
}

// Finance uses real data only — no seeded demo content

// ── TAB SWITCHER ──
function finTab(btn,tabId){
  document.querySelectorAll('.fin-tab').forEach(t=>{t.classList.remove('active');});
  if(btn){btn.classList.add('active');}
  // "Manage" select groups the 4 least-frequent tabs — mirror the active tab into its displayed
  // value/highlight so it reads as a real tab even though it's not a row of individual buttons.
  const manageSel=document.getElementById('fin-manage-select');
  if(manageSel){
    const managedTabs=['fin-national','fin-budget','fin-plans','fin-settings'];
    if(managedTabs.includes(tabId)){manageSel.value=tabId;manageSel.classList.add('active');}
    else{manageSel.value='';manageSel.classList.remove('active');}
  }
  document.querySelectorAll('#page-finance > div[id^="fin-"]').forEach(d=>{
    if(d.id==='fin-tabs-bar')return; // never hide the tab bar
    d.style.display='none';
  });
  const el=document.getElementById(tabId);if(el)el.style.display='block';
  FIN_ACTIVE_TAB=tabId;
  if(!FIN_SELECTED_SEM)FIN_SELECTED_SEM=getSemester();
  initSemesterSelect('fin-semester-select',finKnownSemesters(),finSemesterChanged,FIN_SELECTED_SEM);
  const map={
    'fin-overview':finRenderOverview,
    'fin-dues':finRenderDues,
    'fin-national':finRenderNational,
    'fin-fines':finRenderFines,
    'fin-budget':finRenderBudget,
    'fin-plans':finRenderPlans,
    'fin-settings':finRenderSettings,
  };
  if(map[tabId])map[tabId]();
  // Show/hide edit controls based on permission AND whether the selected semester is the
  // current one — past semesters are frozen read-only for everyone, leads included.
  const canEditNow=finCheckPerms()&&isCurrentSemester(FIN_SELECTED_SEM);
  ['fin-add-payment-btn','fin-add-fine-btn','fin-add-expense-btn','fin-add-plan-btn'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.style.display=canEditNow?'':'none';
  });
  // Settings tab sets dues amounts and the whole chapter budget — hide it for non-editors
  const settingsTabBtn=document.querySelector('.fin-tab[data-tab="fin-settings"]');
  if(settingsTabBtn)settingsTabBtn.style.display=finCheckPerms()?'':'none';
  if(tabId==='fin-settings'&&!finCheckPerms()){
    toast('Only Treasurer, President, or VP can access Finance Settings.','error');
    finTab(document.querySelector('.fin-tab[data-tab="fin-overview"]'),'fin-overview');
  }
}

// ── VIEWER: own dues balance only ──
let FIN_OWN_SELECTED_SEM=null;
function finOwnSemesterChanged(){
  FIN_OWN_SELECTED_SEM=document.getElementById('fin-my-semester-select').value;
  finRenderOwnOnly();
}
function finRenderOwnOnly(){
  const tabsBar=document.getElementById('fin-tabs-bar');if(tabsBar)tabsBar.style.display='none';
  document.querySelectorAll('#page-finance > div[id^="fin-"]').forEach(d=>{if(d.id!=='fin-tabs-bar')d.style.display='none';});
  let myCard=document.getElementById('fin-my-dues');
  if(!myCard){
    myCard=document.createElement('div');
    myCard.id='fin-my-dues';
    const pg=document.getElementById('page-finance');if(pg)pg.appendChild(myCard);
  }
  myCard.style.display='block';
  const me=(typeof _myMemberRecord==='function')?_myMemberRecord():null;
  if(!me){
    myCard.innerHTML='<div class="card" style="padding:18px;color:var(--mt);font-size:12px">No dues record linked to your account yet. Contact the Treasurer.</div>';
    return;
  }
  if(!FIN_OWN_SELECTED_SEM)FIN_OWN_SELECTED_SEM=getSemester();
  const sem=FIN_OWN_SELECTED_SEM;
  const d=finDuesRec(me.id,sem)||{};
  const semDues=d.semesterDues||getSemDues(me.id,sem);
  const paid=d.paid||0;
  const bal=semDues-paid;
  const range=semesterDateRange(sem);
  const myFines=(D.finance.fines||[]).filter(f=>f.memberId===me.id&&(!range||(f.date>=range.start&&f.date<=range.end)));
  const unpaidFinesTotal=myFines.filter(f=>f.status==='Unpaid').reduce((s,f)=>s+f.amount,0);
  const unpaidFinesCount=myFines.filter(f=>f.status==='Unpaid').length;
  myCard.innerHTML=`
    <div style="display:flex;justify-content:flex-end;margin-bottom:9px">
      <select id="fin-my-semester-select" style="height:30px;padding:0 8px;border:1px solid var(--bdr);border-radius:var(--r);font-size:12px;font-family:inherit;background:var(--surf);color:var(--tx)"></select>
    </div>
    <div class="d2-stats" style="margin-bottom:13px">
      ${statStrip('Semester Dues','$'+semDues.toLocaleString(),sem,'neutral')}
      ${statStrip('Amount Paid','$'+paid.toLocaleString(),d.lastPayment?'Last: '+fds(d.lastPayment):'No payments yet','neutral')}
      ${statStrip('Balance Remaining','$'+bal.toLocaleString(),bal>0?'Still owed':'Paid in full',bal>0?'down':'up')}
      ${statStrip('Outstanding Fines','$'+unpaidFinesTotal.toLocaleString(),unpaidFinesCount+' unpaid',unpaidFinesTotal>0?'down':'neutral')}
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-t">My Fines</span></div>
      <div>${myFines.length?myFines.map(f=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bdr);font-size:12px"><span>${esc(f.type||'Fine')}, ${esc(f.reason||'')}</span><span style="font-weight:600;color:${f.status==='Unpaid'?'var(--rd)':'var(--gn)'}">$${f.amount.toLocaleString()} · ${f.status}</span></div>`).join(''):'<div style="padding:10px 0;color:var(--mt);font-size:12px">No fines on record.</div>'}</div>
    </div>`;
  initSemesterSelect('fin-my-semester-select',unionKnownSemesters(Object.keys(D.finance.dues?.[me.id]||{})),finOwnSemesterChanged,sem);
}

// ── MAIN RENDER ──
function renderFinance(){
  // Initialize empty collections — no seeded fake data
  if(!D.finance.dues)D.finance.dues={};
  if(!D.finance.fines)D.finance.fines=[];
  if(!D.finance.expenses)D.finance.expenses=[];
  if(!D.finance.payments)D.finance.payments=[];
  if(!D.finance.plans)D.finance.plans=[];
  if(!D.finance.budget)D.finance.budget={};
  finEnsureDuesMigrated();
  finEnsureBudgetMigrated();
  if(!FIN_SELECTED_SEM)FIN_SELECTED_SEM=getSemester();
  if(CURRENT_USER&&CURRENT_USER.role==='viewer'){finRenderOwnOnly();return;}
  // Reset tabs
  document.querySelectorAll('.fin-tab').forEach((t,i)=>{t.classList.toggle('active',i===0);});
  document.querySelectorAll('#page-finance > div[id^="fin-"]').forEach(d=>{if(d.id==='fin-tabs-bar')return;d.style.display=d.id==='fin-overview'?'block':'none';});
  FIN_ACTIVE_TAB='fin-overview';
  initSemesterSelect('fin-semester-select',finKnownSemesters(),finSemesterChanged,FIN_SELECTED_SEM);
  const settingsTabBtn=document.querySelector('.fin-tab[data-tab="fin-settings"]');
  if(settingsTabBtn)settingsTabBtn.style.display=finCheckPerms()?'':'none';
  finRenderOverview();
}

// ── OVERVIEW ──
function finRenderOverview(){
  const sem=finSem();
  const dues=finDuesMapForSemester(sem);
  const budget=finBudgetForSemester(sem);
  const range=semesterDateRange(sem);
  const expenses=(D.finance.expenses||[]).filter(e=>!range||(e.date>=range.start&&e.date<=range.end));
  const members=D.members;
  const totalOwe=members.reduce((s,m)=>s+((dues[m.id]?.semesterDues||getSemDues(m.id,sem))-(dues[m.id]?.paid||0)),0);
  const paidCount=members.filter(m=>(dues[m.id]?.status||'Partial')==='Paid').length;
  const paidPct=members.length?Math.round(paidCount/members.length*100):0;
  const totalFines=(D.finance.fines||[]).filter(f=>f.status==='Unpaid').reduce((s,f)=>s+f.amount,0);
  const totalCollected=members.reduce((s,m)=>s+(dues[m.id]?.paid||0),0);
  const budgetSpent=expenses.reduce((s,e)=>s+e.amount,0);
  const totalBudget=Object.values(budget).reduce((a,b)=>a+b,0);
  const cashFlow=totalCollected-budgetSpent;

  document.getElementById('fin-kpi').innerHTML=
    statStrip('Outstanding Dues','$'+totalOwe.toLocaleString(),members.length-paidCount+' members unpaid',totalOwe>2000?'down':'neutral')+
    statStrip('Collection Rate',paidPct+'%',paidCount+' / '+members.length+' paid',paidPct>=85?'up':paidPct>=70?'neutral':'down')+
    statStrip('Chapter Cash Flow','$'+cashFlow.toLocaleString(),'Collected minus spent',cashFlow>=0?'up':'down')+
    statStrip('Outstanding Fines','$'+totalFines.toLocaleString(),(D.finance.fines||[]).filter(f=>f.status==='Unpaid').length+' unpaid fines',totalFines>200?'down':'neutral');

  // Health — a rollup line, styled and positioned like an alert row (see below) rather than its
  // own tinted/bordered box, so it reads as "the headline item in Status," not a second surface.
  const healthEl=document.getElementById('fin-health');
  const health=paidPct>=80&&totalFines<500?{bg:'background:var(--gn-bg)',ic:'color:var(--gn-tx)',icon:'ti-circle-check',label:'Healthy',desc:`${paidPct}% dues collected · Fines under control`}:paidPct>=60?{bg:'background:var(--am-bg)',ic:'color:var(--am-tx)',icon:'ti-alert-triangle',label:'Warning',desc:`${100-paidPct}% of members still owe dues · Monitor closely`}:{bg:'background:var(--rd-bg)',ic:'color:var(--rd-tx)',icon:'ti-alert-circle',label:'Critical',desc:`Low collection rate · Immediate action required`};
  healthEl.innerHTML=`<div class="d-alert-row"><div class="d-alert-icon" style="${health.bg}"><i class="ti ${health.icon}" style="${health.ic}"></i></div><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600">${health.label}</div><div style="font-size:11px;color:var(--mt);margin-top:1px">${health.desc}</div></div></div>`;

  // Alerts
  const alertsEl=document.getElementById('fin-alerts');
  const alerts=[];
  const overdue=members.filter(m=>dues[m.id]?.status==='Overdue');
  if(overdue.length)alerts.push({icon:'ti-alert-circle',bg:'background:var(--rd-bg)',ic:'color:var(--rd-tx)',title:`${overdue.length} member${overdue.length>1?'s':''} overdue on dues`,body:overdue.slice(0,2).map(m=>m.name.split(' ')[0]).join(', ')+(overdue.length>2?` +${overdue.length-2} more`:'')});
  const unpaidFines=(D.finance.fines||[]).filter(f=>f.status==='Unpaid');
  if(unpaidFines.length)alerts.push({icon:'ti-gavel',bg:'background:var(--am-bg)',ic:'color:var(--am-tx)',title:`$${unpaidFines.reduce((s,f)=>s+f.amount,0).toLocaleString()} in unpaid fines`,body:`${unpaidFines.length} fine${unpaidFines.length>1?'s':''} outstanding`});
  const nearLimit=getCatNames().filter(cat=>{const sp=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);const bud=budget[cat]||0;return bud>0&&sp/bud>BUDGET_ALERT_THRESHOLD;});
  if(nearLimit.length)alerts.push({icon:'ti-chart-pie',bg:'background:var(--bl-bg)',ic:'color:var(--bl-tx)',title:`${nearLimit.join(', ')} budget${nearLimit.length>1?'s':''} near limit`,body:'Over 85% of budget spent'});
  const finAlertsDot=document.getElementById('fin-alerts-dot');
  if(finAlertsDot){
    finAlertsDot.style.background=alerts.length?'var(--rd)':'var(--gn)';
    finAlertsDot.classList.toggle('active',!!alerts.length);
  }
  alertsEl.innerHTML=alerts.length?alerts.map(a=>`<div class="d-alert-row"><div class="d-alert-icon" style="${a.bg}"><i class="ti ${a.icon}" style="${a.ic}"></i></div><div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:500">${esc(a.title)}</div><div style="font-size:10.5px;color:var(--mt);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.body)}</div></div></div>`).join(''):`<div style="padding:14px;text-align:center;color:var(--mt);font-size:11.5px"><i class="ti ti-circle-check" style="color:var(--gn);font-size:17px;display:block;margin:0 auto 4px"></i>Finances in good shape</div>`;

  // Budget overview — only show categories with budget set or expenses recorded
  const budEl=document.getElementById('fin-budget-overview');
  const activeCats=getCatNames().filter(cat=>{
    const spent=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);
    return (budget[cat]||0)>0||spent>0;
  });
  budEl.innerHTML=activeCats.length?activeCats.map(cat=>{
    const spent=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);
    const bud=budget[cat]||0;
    const pct=bud?Math.min(100,Math.round(spent/bud*100)):0;
    const col=pct>=90?'var(--rd)':pct>=70?'var(--am)':getCatColor(cat);
    return`<div class="pr"><span class="pl" style="width:110px"><i class="ti ${getCatIcon(cat)} " style="font-size:11px;color:var(--ht);margin-right:4px"></i>${cat}</span><div class="pb"><div class="pf" style="width:${pct}%;background:${col}"></div></div><span style="font-size:10.5px;color:var(--mt);width:90px;text-align:right;flex-shrink:0">$${spent.toLocaleString()} / $${bud.toLocaleString()}</span></div>`;
  }).join(''):`<div style="color:var(--ht);font-size:11.5px;padding:10px 0">No budget allocated yet. Set amounts in the Budget tab.</div>`;

  // Recent payments feed
  const feedEl=document.getElementById('fin-feed');
  const payments=[...(D.finance.payments||[])].filter(p=>!range||(p.date>=range.start&&p.date<=range.end)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  feedEl.innerHTML=payments.length?payments.map(p=>`<div class="fin-pay-row"><div class="fin-pay-icon" style="background:var(--gn-bg)"><i class="ti ti-cash" style="color:var(--gn)"></i></div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500">${mB(p.memberId).name.split(' ')[0]} paid $${p.amount.toLocaleString()} <span style="font-weight:400;color:var(--mt)">(${p.type})</span></div><div style="font-size:10px;color:var(--ht)">${fds(p.date)} · via ${p.method}</div></div><span style="font-size:11px;font-weight:600;color:var(--gn)">+$${p.amount.toLocaleString()}</span></div>`).join(''):`<div style="color:var(--ht);font-size:11.5px;padding:10px 0">No payments recorded yet.</div>`;

  // Deadlines — pulled from finance settings
  const dlEl=document.getElementById('fin-deadlines');
  const deadlines=(D.finance.deadlines||[]).filter(d=>d.date>=localDateStr()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
  dlEl.innerHTML=deadlines.length?deadlines.map(d=>{
    const days=Math.max(0,Math.round((new Date(d.date+'T12:00:00')-new Date())/86400000));
    const cls=days===0?'urgent':days<=3?'soon':'';
    return`<div class="ev-row"><div class="ev-dt"><div class="ev-day">${dom(d.date)}</div><div class="ev-mo">${mos(d.date)}</div></div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500">${esc(d.label)}</div><div style="font-size:10.5px;color:var(--mt)">${fd(d.date)}</div></div><span class="d-countdown ${cls}"><i class="ti ti-clock" style="font-size:9px"></i>${days===0?'Today':days+'d'}</span></div>`;
  }).join(''):`<div style="color:var(--ht);font-size:11.5px;padding:10px 0">No upcoming deadlines.</div>`;

  // Who Owes What — quick view
  const whoOwesEl=document.getElementById('fin-who-owes');
  if(whoOwesEl){
    const unpaid=members.filter(m=>(dues[m.id]?.status||'Partial')!=='Paid').sort(mNameCompare);
    if(!unpaid.length){whoOwesEl.innerHTML=`<div style="padding:14px;text-align:center;font-size:11.5px;color:var(--mt)"><i class="ti ti-circle-check" style="color:var(--gn);font-size:17px;display:block;margin:0 auto 4px"></i>All dues collected!</div>`;return;}
    whoOwesEl.innerHTML=unpaid.slice(0,12).map(m=>{
      const d=dues[m.id]||{};
      const owed=(d.semesterDues||getSemDues(m.id,sem))-(d.paid||0);
      const pct=Math.round((d.paid||0)/(d.semesterDues||getSemDues(m.id,sem))*100);
      const stat=d.status||'Partial';
      const sc={Overdue:'var(--rd)',Partial:'var(--am)',Paid:'var(--gn)','Payment Plan':'var(--bl)'}[stat]||'var(--mt)';
      return`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr)">
        <div class="sh-av" style="width:23px;height:23px;font-size:8px">${esc(m.initials)}</div>
        <div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div></div>
        <div style="width:50px;height:4px;background:#F1F3F6;border-radius:99px;overflow:hidden;flex-shrink:0"><div style="height:100%;width:${pct}%;background:${sc};border-radius:99px"></div></div>
        <span style="font-size:11px;font-weight:700;color:${sc};width:44px;text-align:right;flex-shrink:0">$${owed.toLocaleString()}</span>
        <button class="btn" style="height:22px;font-size:10px;padding:0 7px;flex-shrink:0" aria-label="Open ${esc(m.name)}'s finance profile" onclick="finOpenProfile('${m.id}')"><i class="ti ti-edit"></i></button>
      </div>`;
    }).join('')+(unpaid.length>12?`<div style="font-size:11px;color:var(--mt);text-align:center;padding:7px 0;cursor:pointer" tabindex="0" role="button" onclick="finTab(document.querySelector('[data-tab=fin-dues]'),'fin-dues')">+${unpaid.length-12} more → View all dues</div>`:'');
  }
}

// ── MEMBER DUES TABLE ──
function finRenderDues(){
  const sem=finSem();
  const dues=finDuesMapForSemester(sem);
  const paid=D.members.filter(m=>(dues[m.id]?.status||'Partial')==='Paid').length;
  const ov=D.members.filter(m=>dues[m.id]?.status==='Overdue').length;
  const total=D.members.reduce((s,m)=>s+(dues[m.id]?.paid||0),0);
  document.getElementById('fin-dues-kpi').innerHTML=
    statStrip('Collected','$'+total.toLocaleString(),paid+' fully paid','neutral')+
    statStrip('Outstanding','$'+D.members.reduce((s,m)=>s+((dues[m.id]?.semesterDues||getSemDues(m.id,sem))-(dues[m.id]?.paid||0)),0).toLocaleString(),'Still owed','neutral')+
    statStrip('Overdue',ov,'Past deadline',ov?'down':'neutral')+
    statStrip('On Payment Plan',(D.finance.plans||[]).filter(p=>p.status!=='Completed').length,'Active plans','neutral');
  finFilterDues();
}

function finFilterDues(){
  const sem=finSem();
  const q=(document.getElementById('fin-search')||{value:''}).value.toLowerCase();
  const st=(document.getElementById('fin-filter-pay')||{value:''}).value;
  const dues=finDuesMapForSemester(sem);
  const statusBadge={Paid:'bg2',Partial:'ba2',Overdue:'br2','Payment Plan':'bb2'};
  let rows=sortedMembers().filter(m=>{
    if(q&&!m.name.toLowerCase().includes(q))return false;
    if(st&&(dues[m.id]?.status||'Partial')!==st)return false;
    return true;
  });
  const tbl=document.getElementById('fin-dues-table');
  if(!tbl)return;
  // Column order leads with what a Treasurer scans for — status, balance, fines — before
  // reference detail (type/class/last payment). The whole row already opens the profile
  // (fin-member-row below), so there's no separate trailing view button duplicating that.
  tbl.innerHTML=`<thead><tr><th>Member</th><th>Status</th><th>Balance</th><th>Fines</th><th>Paid</th><th>Semester Dues</th><th>Type</th><th>Class</th><th>Last Payment</th></tr></thead><tbody>${rows.map(m=>{
    const d=dues[m.id]||{semesterDues:getSemDues(m.id,sem),paid:0,status:'Partial',lastPayment:'',fineCount:0};
    const bal=d.semesterDues-d.paid;
    const st=d.status||'Partial';
    return`<tr class="fin-member-row" tabindex="0" role="button" aria-label="Open ${esc(m.name)}'s finance profile" onclick="finOpenProfile('${m.id}')">
      <td><div style="display:flex;align-items:center;gap:7px"><div class="sh-av" style="width:24px;height:24px;font-size:8.5px">${esc(m.initials)}</div><span style="font-weight:500">${esc(m.name)}</span></div></td>
      <td><span class="badge ${statusBadge[st]||'bm2'}">${st}</span></td>
      <td style="color:${bal>0?'var(--rd)':'var(--gn)'};font-weight:600">$${bal.toLocaleString()}</td>
      <td style="text-align:center">${d.fineCount>0?`<span class="badge br2">${d.fineCount}</span>`:'N/A'}</td>
      <td style="color:var(--gn);font-weight:500">$${d.paid.toLocaleString()}</td>
      <td style="color:var(--mt)">$${d.semesterDues.toLocaleString()}</td>
      <td><span class="badge ${finDuesTierLabel(m.id,sem)==='New Member'?'bb2':'bm2'}">${finDuesTierLabel(m.id,sem)}</span></td>
      <td style="color:var(--mt)">${esc(m.classYear)}</td>
      <td style="color:var(--mt)">${d.lastPayment?fds(d.lastPayment):'Never'}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="9" style="text-align:center;padding:22px;color:var(--mt)">No members found</td></tr>'}</tbody>`;
  document.getElementById('fin-dues-mobile-cards').innerHTML=rows.map(m=>{
    const d=dues[m.id]||{semesterDues:getSemDues(m.id,sem),paid:0,status:'Partial',lastPayment:'',fineCount:0};
    const bal=d.semesterDues-d.paid;
    const st=d.status||'Partial';
    return`<div class="mob-card card clickable" tabindex="0" role="button" aria-label="Open ${esc(m.name)}'s finance profile" onclick="finOpenProfile('${m.id}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="sh-av" style="width:38px;height:38px;font-size:13px;flex-shrink:0">${esc(m.initials)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
          <div style="font-size:11px;color:var(--mt)">${esc(m.classYear)}</div>
        </div>
        <span class="badge ${statusBadge[st]||'bm2'}" style="font-size:9.5px;white-space:nowrap">${st}</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
        <span style="font-size:17px;font-weight:700;color:${bal>0?'var(--rd)':'var(--gn)'}">$${bal.toLocaleString()}</span>
        <span style="font-size:10.5px;color:var(--mt)">balance</span>
        ${d.fineCount>0?`<span class="badge br2" style="font-size:9px;margin-left:auto">${d.fineCount} fine${d.fineCount>1?'s':''}</span>`:''}
      </div>
      <div style="font-size:11px;color:var(--mt)">$${d.paid.toLocaleString()} paid of $${d.semesterDues.toLocaleString()} · ${d.lastPayment?fds(d.lastPayment):'Never paid'}</div>
    </div>`;
  }).join('')||'<div style="color:var(--ht);font-size:12px;padding:20px;text-align:center">No members found</div>';
}

// ── FINES TABLE ──
function finRenderFines(){
  const sem=finSem();
  const range=semesterDateRange(sem);
  const canEdit=finCheckPerms()&&isCurrentSemester(sem);
  const fines=(D.finance.fines||[]).filter(f=>!range||(f.date>=range.start&&f.date<=range.end));
  const unpaid=fines.filter(f=>f.status==='Unpaid');
  const total=fines.reduce((s,f)=>s+f.amount,0);
  const outstanding=unpaid.reduce((s,f)=>s+f.amount,0);
  document.getElementById('fin-fines-kpi').innerHTML=
    statStrip('Total Fines',fines.length,sem,'neutral')+
    statStrip('Outstanding','$'+outstanding.toLocaleString(),'Unpaid',outstanding?'down':'neutral')+
    statStrip('Collected','$'+(total-outstanding).toLocaleString(),'Paid','neutral');
  const statusBadge={Paid:'bg2',Unpaid:'br2'};
  // A fixed 5-value type label, not a customizable categorical system (unlike budget categories)
  // — 'Judicial' previously used gold/navy here with no brand/primary-action reason; sky reads as
  // "informational category" without over-using the brand accent (see DESIGN.md's Two-Accent Rule).
  const typeColors={'Attendance':'var(--am)','Late Payment':'var(--rd)','Damage':'var(--rd)','Judicial':'var(--bl)','Other':'var(--mt)'};
  document.getElementById('fin-fines-table').innerHTML=`<thead><tr><th>Member</th><th>Status</th><th>Amount</th><th>Type</th><th>Reason</th><th>Date Issued</th><th></th></tr></thead><tbody>${fines.sort((a,b)=>b.date.localeCompare(a.date)).map(f=>{
    const m=mB(f.memberId);
    return`<tr><td><div style="display:flex;align-items:center;gap:6px"><div class="sh-av" style="width:22px;height:22px;font-size:8px">${esc(m.initials)}</div><span style="font-weight:500">${esc(m.name)}</span></div></td>
    <td><span class="badge ${statusBadge[f.status]||'bm2'}">${f.status}</span></td>
    <td style="font-weight:600;color:var(--rd)">$${f.amount.toLocaleString()}</td>
    <td><span style="font-size:10px;font-weight:500;color:${typeColors[f.type]||'var(--mt)'}">${esc(f.type)}</span></td>
    <td style="color:var(--mt)">${esc(f.reason)}</td>
    <td style="color:var(--mt)">${fds(f.date)}</td>
    <td style="white-space:nowrap">${f.status==='Unpaid'&&canEdit?`<button class="btn" style="height:22px;font-size:10px;padding:0 7px;margin-right:3px" onclick="finMarkFinePaid('${f.id}')"><i class="ti ti-check"></i>Paid</button>`:''}${canEdit?`<button class="btn btn-d" style="height:22px;font-size:10px;padding:0 7px" aria-label="Delete fine for ${esc(m.name)}" onclick="deleteFineFn('${f.id}')"><i class="ti ti-trash"></i></button>`:''}</td></tr>`;
  }).join('')||'<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--mt)">No fines issued</td></tr>'}</tbody>`;
  const mobEl=document.getElementById('fin-fines-mobile-cards');
  if(mobEl)mobEl.innerHTML=[...fines].sort((a,b)=>b.date.localeCompare(a.date)).map(f=>{
    const m=mB(f.memberId);
    return`<div class="mob-card card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div class="sh-av" style="width:34px;height:34px;font-size:12px;flex-shrink:0">${esc(m.initials)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
          <div style="font-size:11px;color:${typeColors[f.type]||'var(--mt)'}">${esc(f.type)} · ${fds(f.date)}</div>
        </div>
        <span class="badge ${statusBadge[f.status]||'bm2'}" style="font-size:9.5px;flex-shrink:0">${f.status}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:15px;font-weight:700;color:var(--rd);flex-shrink:0">$${f.amount.toLocaleString()}</span>
        <span style="font-size:11px;color:var(--mt);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.reason)}</span>
      </div>
      ${canEdit?`<div style="display:flex;gap:6px;margin-top:8px">${f.status==='Unpaid'?`<button class="btn" style="height:24px;font-size:10.5px;flex:1" onclick="finMarkFinePaid('${f.id}')"><i class="ti ti-check"></i>Mark Paid</button>`:''}<button class="btn btn-d" style="height:24px;font-size:10.5px" aria-label="Delete fine for ${esc(m.name)}" onclick="deleteFineFn('${f.id}')"><i class="ti ti-trash"></i></button></div>`:''}
    </div>`;
  }).join('')||'<div style="color:var(--ht);font-size:12px;padding:20px;text-align:center">No fines issued</div>';
}

// ── BUDGET ──
function finRenderBudget(){
  const sem=finSem();
  const budget=finBudgetForSemester(sem);
  const range=semesterDateRange(sem);
  const canEdit=finCheckPerms()&&isCurrentSemester(sem);
  const exp=[...(D.finance.expenses||[])].filter(e=>!range||(e.date>=range.start&&e.date<=range.end)).sort((a,b)=>b.date.localeCompare(a.date));
  // One card holding every category as a compact row (label+bar+detail), not one bordered card
  // per category — the same .pr/.pl/.pb/.pf list pattern the Overview's own Budget Overview
  // widget and the Dashboard's Semester Goals already use, extended with a second line for the
  // %-spent/remaining detail this fuller tab view needs that the Overview's glance version omits.
  const budEl=document.getElementById('fin-budget-cards');
  budEl.innerHTML=getCatNames().map(cat=>{
    const spent=exp.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);
    const bud=budget[cat]||0;
    const pct=bud?Math.min(100,Math.round(spent/bud*100)):0;
    const rem=bud-spent;
    const col=pct>=90?'var(--rd)':pct>=70?'var(--am)':getCatColor(cat);
    const flexible=getCatFlexible(cat);
    return`<div class="pr" style="align-items:flex-start">
      <span class="pl" style="width:130px;padding-top:2px" title="${esc(cat)}">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${flexible?'var(--gn)':'var(--rd)'};margin-right:5px;flex-shrink:0" title="${flexible?'Flexible':'Non-Flexible'}"></span>
        <i class="ti ${getCatIcon(cat)}" style="font-size:11px;margin-right:4px"></i>${cat}
      </span>
      <div style="flex:1;min-width:0">
        <div class="pb" style="width:100%"><div class="pf" style="width:${pct}%;background:${col}"></div></div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px">
          <span style="color:${pct>=90?'var(--rd)':'var(--mt)'}">${pct}% spent</span>
          <span style="color:${rem<0?'var(--rd)':'var(--gn)'};font-weight:600">$${rem.toLocaleString()} remaining</span>
        </div>
      </div>
      <span style="width:95px;text-align:right;font-size:10.5px;color:var(--mt);flex-shrink:0;padding-top:2px">$${spent.toLocaleString()} / $${bud.toLocaleString()}</span>
    </div>`;
  }).join('');

  // Non-Flexible vs Flexible totals — same split the chapter's own budget spreadsheet uses
  // (fixed/required costs vs. discretionary spending), computed off allocated budget $, not spend.
  const flexTotalsEl=document.getElementById('fin-budget-flex-totals');
  if(flexTotalsEl){
    const nonFlexTotal=getCatNames().filter(c=>!getCatFlexible(c)).reduce((s,c)=>s+(budget[c]||0),0);
    const flexTotal=getCatNames().filter(c=>getCatFlexible(c)).reduce((s,c)=>s+(budget[c]||0),0);
    const grandTotal=nonFlexTotal+flexTotal;
    flexTotalsEl.innerHTML=grandTotal?`
      <div style="display:flex;gap:8px">
        <div style="flex:1;background:var(--rd-bg);border-radius:var(--r-xs);padding:8px 10px">
          <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--rd-tx)">Non-Flexible</div>
          <div style="font-size:14px;font-weight:700;color:var(--rd-tx)">$${nonFlexTotal.toLocaleString()}</div>
        </div>
        <div style="flex:1;background:var(--gn-bg);border-radius:var(--r-xs);padding:8px 10px">
          <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--gn-tx)">Flexible</div>
          <div style="font-size:14px;font-weight:700;color:var(--gn-tx)">$${flexTotal.toLocaleString()}</div>
        </div>
      </div>`:'';
  }

  finDrawBudgetDonut(budget);

  // Expense log
  document.getElementById('fin-expense-log').innerHTML=`<thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Officer</th><th>Date</th><th></th></tr></thead><tbody>${exp.map(e=>`<tr><td><span style="font-size:10px;font-weight:600;color:${getCatColor(e.category)}">${esc(e.category)}</span></td><td style="font-weight:500">${esc(e.desc)}</td><td style="color:var(--rd);font-weight:600">$${e.amount.toLocaleString()}</td><td style="color:var(--mt)">${esc(mB(e.officer).name.split(' ')[0])}</td><td style="color:var(--mt)">${fds(e.date)}</td><td>${canEdit?`<button class="btn btn-d" style="height:22px;font-size:10px;padding:0 7px" onclick="deleteExpense('${e.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--mt)">No expenses logged</td></tr>'}</tbody>`;
  const expMobEl=document.getElementById('fin-expense-mobile-cards');
  if(expMobEl)expMobEl.innerHTML=exp.map(e=>`<div class="mob-card card">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:10px;font-weight:600;color:${getCatColor(e.category)};flex-shrink:0">${esc(e.category)}</span>
      <span style="font-size:11px;color:var(--ht);flex:1;text-align:right">${fds(e.date)}</span>
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.desc)}</div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:15px;font-weight:700;color:var(--rd)">$${e.amount.toLocaleString()}</span>
      <span style="font-size:11px;color:var(--mt)">${esc(mB(e.officer).name.split(' ')[0])}</span>
    </div>
    ${canEdit?`<button class="btn btn-d" style="height:24px;font-size:10.5px;margin-top:8px;width:100%" onclick="deleteExpense('${e.id}')" aria-label="Delete"><i class="ti ti-trash"></i>Delete</button>`:''}
  </div>`).join('')||'<div style="color:var(--ht);font-size:12px;padding:20px;text-align:center">No expenses logged</div>';
}

// Donut showing how the selected semester's budget is allocated across categories — same
// stroke-dasharray ring technique as js/analytics.js's attDrawDonut(), just fed budget $ instead
// of member counts. Reflects allocation, not spending (finRenderBudget's bars already show spend).
function finDrawBudgetDonut(budget){
  const svg=document.getElementById('fin-budget-donut');
  const legend=document.getElementById('fin-budget-donut-legend');
  const totalEl=document.getElementById('fin-budget-donut-total');
  if(!svg)return;
  const segs=getCatNames().map(cat=>({cat,amt:budget[cat]||0,col:getCatColor(cat)})).filter(s=>s.amt>0);
  const total=segs.reduce((s,c)=>s+c.amt,0);
  if(totalEl)totalEl.textContent=total?'$'+total.toLocaleString():'N/A';
  const R=42,CX=55,CY=55,CIRC=2*Math.PI*R,SW=16;
  if(!total){
    svg.innerHTML=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#F1F3F6" stroke-width="${SW}"/>`;
    if(legend)legend.innerHTML=`<div style="font-size:11px;color:var(--ht)">No budget allocated yet. Set category amounts in Settings.</div>`;
    return;
  }
  let offset=0,paths='';
  segs.forEach(s=>{
    const dash=(s.amt/total)*CIRC;
    const off=CIRC-(offset/total*CIRC);
    paths+=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${s.col}" stroke-width="${SW}"
      stroke-dasharray="${dash} ${CIRC}" stroke-dashoffset="${off}"
      style="transform:rotate(-90deg);transform-origin:${CX}px ${CY}px;transition:stroke-dashoffset .7s ease"/>`;
    offset+=s.amt;
  });
  svg.innerHTML=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#F1F3F6" stroke-width="${SW}"/>${paths}`;
  if(legend){
    legend.innerHTML=segs.map(s=>`<div style="display:flex;align-items:center;gap:6px">
      <div style="width:8px;height:8px;border-radius:50%;background:${s.col};flex-shrink:0"></div>
      <span style="font-size:10.5px;color:var(--mt);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.cat)}</span>
      <span style="font-size:10.5px;font-weight:600;flex-shrink:0">${Math.round(s.amt/total*100)}%</span>
    </div>`).join('');
  }
}

// ── FINANCE SETTINGS ──
function finRenderSettings(){
  if(!D.settings)D.settings={};
  const s=D.settings;
  // In-House
  const ih=document.getElementById('fin-dues-inhouse');if(ih)ih.value=s.duesInHouse||'';
  const ihd=document.getElementById('fin-dues-inhouse-date');if(ihd)ihd.value=s.duesInHouseDate||'';
  // Out-of-House
  const oh=document.getElementById('fin-dues-outofhouse');if(oh)oh.value=s.duesOutOfHouse||'';
  const ohd=document.getElementById('fin-dues-outofhouse-date');if(ohd)ohd.value=s.duesOutOfHouseDate||'';
  // Pledge
  const pl=document.getElementById('fin-dues-pledge');if(pl)pl.value=s.duesPledge||'';
  const pld=document.getElementById('fin-dues-pledge-date');if(pld)pld.value=s.duesPledgeDate||'';
  // National
  const na=document.getElementById('fin-dues-national');if(na)na.value=s.duesNational||'';
  const nad=document.getElementById('fin-dues-national-date');if(nad)nad.value=s.duesNationalDate||'';

  const statusEl=document.getElementById('fin-dues-status');
  if(statusEl){
    const ih=s.duesInHouse||0, oh=s.duesOutOfHouse||0, pl=s.duesPledge||0, na=s.duesNational||0;
    if(!ih&&!oh&&!pl){
      statusEl.textContent='Dues not yet configured. Set amounts above then click Save.';
      statusEl.style.color='var(--am-tx)';
    } else {
      statusEl.textContent=`In-House: $${ih.toLocaleString()} · Out-of-House: $${oh.toLocaleString()} · New Member: $${pl.toLocaleString()} · National: ${na?'$'+na.toLocaleString():'Not set'}`;
      statusEl.style.color='var(--gn-tx)';
    }
  }
  const budInputs=document.getElementById('fin-budget-inputs');
  if(budInputs){
    const sem=finSem();
    const budget=finBudgetForSemester(sem);
    const ro=isCurrentSemester(sem)?'':' readonly style="opacity:.6;cursor:not-allowed"';
    budInputs.innerHTML=getCatNames().map(cat=>{
      const flexible=getCatFlexible(cat);
      return`
      <div style="display:flex;align-items:center;gap:9px">
        <i class="ti ${getCatIcon(cat)}" style="font-size:13px;color:${getCatColor(cat)};width:16px;flex-shrink:0"></i>
        <label style="font-size:12px;font-weight:500;flex:1">${cat}</label>
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;padding:2px 6px;border-radius:99px;flex-shrink:0;${flexible?'background:var(--gn-bg);color:var(--gn-tx)':'background:var(--rd-bg);color:var(--rd-tx)'}">${flexible?'Flexible':'Non-Flexible'}</span>
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:12px;color:var(--mt)">$</span>
          <input type="number" id="fin-bud-${cat.replace(/\s+/g,'-')}" value="${budget[cat]||0}" min="0" step="50"
            style="width:90px;height:28px;padding:0 7px;border:1px solid var(--bdr);border-radius:var(--r);font-size:12px;font-family:inherit;color:var(--tx);outline:none;text-align:right"
            oninput="finUpdateBudgetTotal()" onfocus="this.style.borderColor='var(--sky)'" onblur="this.style.borderColor='var(--bdr)'"${ro}>
        </div>
      </div>`;
    }).join('');
    finUpdateBudgetTotal();
  }
  finRenderCatManager();
}
function finUpdateBudgetTotal(){
  const totalEl=document.getElementById('fin-budget-total');if(!totalEl)return;
  const valueOf=cat=>{const el=document.getElementById('fin-bud-'+cat.replace(/\s+/g,'-'));return el?parseFloat(el.value)||0:0;};
  const total=getCatNames().reduce((s,cat)=>s+valueOf(cat),0);
  const nonFlexTotal=getCatNames().filter(c=>!getCatFlexible(c)).reduce((s,c)=>s+valueOf(c),0);
  const flexTotal=total-nonFlexTotal;
  totalEl.innerHTML=`Total: $${total.toLocaleString()} <span style="color:var(--rd-tx)">· Non-Flexible: $${nonFlexTotal.toLocaleString()}</span> <span style="color:var(--gn-tx)">· Flexible: $${flexTotal.toLocaleString()}</span>`;
}
function finSaveDuesSettings(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can change dues settings.','error');return;}
  if(!D.settings)D.settings={};
  D.settings.duesInHouse=parseFloat(document.getElementById('fin-dues-inhouse')?.value)||0;
  D.settings.duesInHouseDate=document.getElementById('fin-dues-inhouse-date')?.value||'';
  D.settings.duesOutOfHouse=parseFloat(document.getElementById('fin-dues-outofhouse')?.value)||0;
  D.settings.duesOutOfHouseDate=document.getElementById('fin-dues-outofhouse-date')?.value||'';
  D.settings.duesPledge=parseFloat(document.getElementById('fin-dues-pledge')?.value)||0;
  D.settings.duesPledgeDate=document.getElementById('fin-dues-pledge-date')?.value||'';
  D.settings.duesNational=parseFloat(document.getElementById('fin-dues-national')?.value)||0;
  D.settings.duesNationalDate=document.getElementById('fin-dues-national-date')?.value||'';
  saveD('settings');finRenderSettings();toast('Dues settings saved','success');
}
// The actual "start new semester" trigger for dues — always applies to the CURRENT semester
// (never whatever's selected in the viewer, since past semesters are frozen) and only ever
// creates a fresh entry if one doesn't already exist there; never touches a prior semester.
async function finApplyDuesToAll(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can apply dues.','error');return;}
  const s=D.settings||{};
  if(!s.duesInHouse&&!s.duesOutOfHouse&&!s.duesPledge){toast('Set dues amounts first then click Apply','error');return;}
  const sem=getSemester();
  D.members.forEach(m=>{
    const amount=getSemDues(m.id,sem);
    const rec=finEnsureDuesRec(m.id,sem);
    rec.semesterDues=amount;
    const paid=rec.paid||0;
    rec.status=paid>=amount?'Paid':'Partial';
  });
  try{ await saveFinanceDuesMany(D.members.map(m=>m.id)); finRenderSettings(); toast('Dues applied to all '+D.members.length+' members for '+sem,'success'); }
  catch(e){ toast('Failed to apply dues. Please try again.','error'); }
}
async function finSaveBudget(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can edit the budget.','error');return;}
  const sem=finSem();
  if(!isCurrentSemester(sem)){toast('This semester is read-only.','error');return;}
  if(!D.finance.budget)D.finance.budget={};
  if(!D.finance.budget[sem])D.finance.budget[sem]={};
  getCatNames().forEach(cat=>{const el=document.getElementById('fin-bud-'+cat.replace(/\s+/g,'-'));if(el)D.finance.budget[sem][cat]=parseFloat(el.value)||0;});
  try{ await saveFinanceLedger(); finRenderSettings(); toast('Budget saved','success'); }
  catch(e){ toast('Failed to save budget. Please try again.','error'); }
}

// ── NATIONAL DUES ──
function finRenderNational(){
  if(!D.finance.nationalDues)D.finance.nationalDues={};
  const natAmt=D.settings?.duesNational||0;
  const dues=D.finance.nationalDues;
  const paid=D.members.filter(m=>dues[m.id]?.status==='Paid').length;
  const total=D.members.length;
  const totalOwed=D.members.reduce((s,m)=>s+(natAmt-(dues[m.id]?.paid||0)),0);
  document.getElementById('fin-natl-kpi').innerHTML=
    statStrip('National Dues Rate',natAmt?'$'+natAmt.toLocaleString():'Not set','Per member this semester','neutral')+
    statStrip('Paid',paid,paid+' / '+total+' members',paid===total&&total>0?'up':'neutral')+
    statStrip('Outstanding','$'+Math.max(0,totalOwed).toLocaleString(),(total-paid)+' members unpaid',totalOwed>0?'down':'neutral')+
    statStrip('Total Collected','$'+D.members.reduce((s,m)=>s+(dues[m.id]?.paid||0),0).toLocaleString(),'National dues received','neutral');
  finFilterNational();
}
function finFilterNational(){
  const q=(document.getElementById('fin-natl-search')||{value:''}).value.toLowerCase();
  const flt=(document.getElementById('fin-natl-filter')||{value:''}).value;
  const natAmt=D.settings?.duesNational||0;
  if(!D.finance.nationalDues)D.finance.nationalDues={};
  const dues=D.finance.nationalDues;
  let rows=sortedMembers().map(m=>{
    const d=dues[m.id]||{paid:0,status:'Unpaid',lastPayment:''};
    return {m,d,owed:Math.max(0,natAmt-(d.paid||0)),status:d.paid>=(natAmt||Infinity)&&natAmt>0?'Paid':d.paid>0?'Partial':'Unpaid'};
  });
  if(q)rows=rows.filter(r=>r.m.name.toLowerCase().includes(q));
  if(flt)rows=rows.filter(r=>r.status===flt);
  const canEdit=finCheckPerms();
  // 'Unpaid' now gets the same warning-amber treatment 'Partial' gets on Member Dues, instead of
  // neutral gray — a $0-paid balance is functionally the same "needs attention" state either way.
  const statusBadge={Paid:'bg2',Partial:'ba2',Unpaid:'ba2'};
  const tbl=document.getElementById('fin-natl-table');if(!tbl)return;
  tbl.innerHTML=`<thead><tr><th>Member</th><th>Status</th><th>Balance</th><th>Paid</th><th>National Dues</th><th>Class</th><th>Last Payment</th>${canEdit?'<th></th>':''}</tr></thead>
  <tbody>${rows.map(({m,d,owed,status})=>`<tr>
    <td><div style="display:flex;align-items:center;gap:6px"><div class="sh-av" style="width:22px;height:22px;font-size:8px">${esc(m.initials)}</div><span style="font-weight:500">${esc(m.name)}</span></div></td>
    <td><span class="badge ${statusBadge[status]||'bm2'}">${status}</span></td>
    <td style="color:${owed>0?'var(--rd)':'var(--gn)'};font-weight:600">$${owed.toLocaleString()}</td>
    <td style="color:var(--gn);font-weight:500">$${(d.paid||0).toLocaleString()}</td>
    <td style="color:var(--mt)">$${natAmt.toLocaleString()}</td>
    <td style="color:var(--mt)">${esc(m.classYear)}</td>
    <td style="color:var(--ht)">${d.lastPayment?fds(d.lastPayment):'N/A'}</td>
    ${canEdit?`<td><button class="btn" style="height:22px;font-size:10px;padding:0 7px" onclick="finOpenNationalPaymentFor('${m.id}')"><i class="ti ti-plus"></i>Pay</button></td>`:''}
  </tr>`).join('')||`<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--ht)">No members found.</td></tr>`}
  </tbody>`;
  document.getElementById('fin-natl-mobile-cards').innerHTML=rows.map(({m,d,owed,status})=>`<div class="mob-card card">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div class="sh-av" style="width:38px;height:38px;font-size:13px;flex-shrink:0">${esc(m.initials)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
        <div style="font-size:11px;color:var(--mt)">${esc(m.classYear)}</div>
      </div>
      <span class="badge ${statusBadge[status]||'bm2'}" style="font-size:9.5px;white-space:nowrap">${status}</span>
    </div>
    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
      <span style="font-size:17px;font-weight:700;color:${owed>0?'var(--rd)':'var(--gn)'}">$${owed.toLocaleString()}</span>
      <span style="font-size:10.5px;color:var(--mt)">owed</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <div style="font-size:11px;color:var(--mt);flex:1">$${(d.paid||0).toLocaleString()} paid · ${d.lastPayment?fds(d.lastPayment):'Never paid'}</div>
      ${canEdit?`<button class="btn" style="height:24px;font-size:10.5px;flex-shrink:0" onclick="finOpenNationalPaymentFor('${m.id}')"><i class="ti ti-plus"></i>Pay</button>`:''}
    </div>
  </div>`).join('')||`<div style="color:var(--ht);font-size:12px;padding:20px;text-align:center">No members found.</div>`;
}
function finOpenNationalPayment(){
  const sel=document.getElementById('fnatl-member');if(!sel)return;
  sel.innerHTML=mOpts();
  document.getElementById('fnatl-amount').value='';
  document.getElementById('fnatl-date').value=localDateStr();
  document.getElementById('fnatl-notes').value='';
  openM('m-fin-national');
}
function finOpenNationalPaymentFor(memberId){
  finOpenNationalPayment();
  const sel=document.getElementById('fnatl-member');if(sel)sel.value=memberId;
}
async function finRecordNationalPayment(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can record payments.','error');return;}
  const memberId=document.getElementById('fnatl-member').value;
  const amount=parseFloat(document.getElementById('fnatl-amount').value);
  if(!memberId||isNaN(amount)||amount<=0){toast('Member and amount are required','error');return;}
  const date=document.getElementById('fnatl-date').value||localDateStr();
  const notes=document.getElementById('fnatl-notes').value.trim();
  const natAmt=D.settings?.duesNational||0;
  if(!D.finance.nationalDues)D.finance.nationalDues={};
  if(!D.finance.nationalDues[memberId])D.finance.nationalDues[memberId]={paid:0,status:'Unpaid',lastPayment:''};
  D.finance.nationalDues[memberId].paid=(D.finance.nationalDues[memberId].paid||0)+amount;
  D.finance.nationalDues[memberId].lastPayment=date;
  D.finance.nationalDues[memberId].status=D.finance.nationalDues[memberId].paid>=natAmt&&natAmt>0?'Paid':D.finance.nationalDues[memberId].paid>0?'Partial':'Unpaid';
  if(notes)D.finance.nationalDues[memberId].notes=notes;
  if(!D.finance.nationalPayments)D.finance.nationalPayments=[];
  D.finance.nationalPayments.unshift({id:uid(),memberId,amount,date,notes});
  try{ await saveFinanceLedger(); }
  catch(e){ toast('Failed to save national payment. Please try again.','error'); return; }
  closeM(null,document.getElementById('m-fin-national'));
  toast('National dues payment of $'+amount+' recorded for '+mB(memberId).name.split(' ')[0],'success');
  finRenderNational();
}

// ── PAYMENT PLANS ──
function finRenderPlans(){
  const plans=D.finance.plans||[];
  const active=plans.filter(p=>p.status!=='Completed');
  const canEdit=finCheckPerms();
  const labels={'on-track':'On Track','late':'Late','complete':'Completed'};
  const rows=plans.map(p=>{
    const rem=p.total-p.paid;
    const pct=Math.round(p.paid/p.total*100);
    const status=p.paid>=p.total?'complete':isOv(p.nextDue)?'late':'on-track';
    return {p,m:mB(p.memberId),rem,pct,status};
  });
  const tbl=document.getElementById('fin-plans-table');
  if(tbl)tbl.innerHTML=`<thead><tr><th>Member</th><th>Status</th><th>Progress</th><th>Remaining</th><th>Paid</th><th>Total</th><th>Next Due</th><th></th></tr></thead><tbody>${plans.length?rows.map(({p,m,rem,pct,status})=>{
    return`<tr><td><div style="display:flex;align-items:center;gap:6px"><div class="sh-av" style="width:22px;height:22px;font-size:8px">${esc(m.initials)}</div><span style="font-weight:500">${esc(m.name)}</span></div></td>
    <td><span class="fin-plan-badge ${status}">${labels[status]}</span></td>
    <td><div style="width:80px;height:5px;background:#F1F3F6;border-radius:99px;overflow:hidden"><div style="height:100%;background:var(--gn);width:${pct}%;border-radius:99px"></div></div></td>
    <td style="color:${rem>0?'var(--rd)':'var(--gn)'};font-weight:600">$${rem.toLocaleString()}</td>
    <td style="color:var(--gn);font-weight:500">$${p.paid.toLocaleString()}</td>
    <td>$${p.total.toLocaleString()}</td>
    <td style="color:var(--mt)">${p.nextDue?fds(p.nextDue):'N/A'}</td>
    <td>${canEdit?`<button class="btn btn-d" style="height:22px;font-size:10px;padding:0 7px" onclick="deletePlan('${p.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`:''}</td></tr>`;
  }).join(''):''}</tbody>${!plans.length?`<tfoot><tr><td colspan="8">${es('ti-calendar-dollar','blue','No payment plans','Create a plan for members who need installments.',canEdit?`<button class="btn btn-p" onclick="finOpenAddPlan()"><i class="ti ti-plus"></i>Create Plan</button>`:'')}</td></tr></tfoot>`:''} `;
  const mobEl=document.getElementById('fin-plans-mobile-cards');
  if(mobEl)mobEl.innerHTML=rows.map(({p,m,rem,pct,status})=>`<div class="mob-card card">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div class="sh-av" style="width:34px;height:34px;font-size:12px;flex-shrink:0">${esc(m.initials)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
        <div style="font-size:11px;color:var(--mt)">Next due ${p.nextDue?fds(p.nextDue):'N/A'}</div>
      </div>
      <span class="fin-plan-badge ${status}" style="flex-shrink:0">${labels[status]}</span>
    </div>
    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px">
      <span style="font-size:17px;font-weight:700;color:${rem>0?'var(--rd)':'var(--gn)'}">$${rem.toLocaleString()}</span>
      <span style="font-size:10.5px;color:var(--mt)">remaining of $${p.total.toLocaleString()}</span>
    </div>
    <div style="width:100%;height:5px;background:#F1F3F6;border-radius:99px;overflow:hidden;margin-bottom:${canEdit?'8px':'0'}"><div style="height:100%;background:var(--gn);width:${pct}%;border-radius:99px"></div></div>
    ${canEdit?`<button class="btn btn-d" style="height:24px;font-size:10.5px;width:100%" onclick="deletePlan('${p.id}')" aria-label="Delete plan for ${esc(m.name)}"><i class="ti ti-trash"></i>Delete</button>`:''}
  </div>`).join('')||`<div style="grid-column:1/-1">${es('ti-calendar-dollar','blue','No payment plans','Create a plan for members who need installments.',canEdit?`<button class="btn btn-p" onclick="finOpenAddPlan()"><i class="ti ti-plus"></i>Create Plan</button>`:'')}</div>`;
}

// ── MEMBER FINANCIAL PROFILE ──
function finOpenProfile(memberId){
  const m=D.members.find(x=>x.id===memberId);
  if(!m)return;
  const sem=finSem();
  const d=finDuesRec(memberId,sem)||{semesterDues:getSemDues(memberId,sem),paid:0,status:'Partial',lastPayment:'',fineCount:0,notes:'',restriction:'None'};
  const range=semesterDateRange(sem);
  const fines=(D.finance.fines||[]).filter(f=>f.memberId===memberId&&(!range||(f.date>=range.start&&f.date<=range.end)));
  const payments=(D.finance.payments||[]).filter(p=>p.memberId===memberId&&(!range||(p.date>=range.start&&p.date<=range.end)));
  const plan=(D.finance.plans||[]).find(p=>p.memberId===memberId&&p.status!=='Completed');
  const statusBadge={Paid:'bg2',Partial:'ba2',Overdue:'br2','Payment Plan':'bb2'};
  const modal=document.getElementById('m-fin-profile');
  document.getElementById('fmp-av').textContent=m.initials;
  document.getElementById('fmp-name').textContent=m.name;
  document.getElementById('fmp-role').textContent=m.classYear+' · '+m.role;
  const sb=document.getElementById('fmp-status-badge');
  const st=d.status||'Partial';
  sb.textContent=st;sb.className='badge '+(statusBadge[st]||'bm2');
  const bal=d.semesterDues-d.paid;
  const canEdit=finCheckPerms()&&isCurrentSemester(sem);
  document.getElementById('fmp-body').innerHTML=`
    <div class="fin-profile-grid" style="margin-bottom:14px">
      <div>
        <div class="card-t" style="margin-bottom:8px">${esc(sem)}</div>
        <div class="fin-stat"><span style="color:var(--mt)">Semester Dues</span><span style="font-weight:500">$${d.semesterDues.toLocaleString()}</span></div>
        <div class="fin-stat"><span style="color:var(--mt)">Amount Paid</span><span style="font-weight:600;color:var(--gn)">$${d.paid.toLocaleString()}</span></div>
        <div class="fin-stat"><span style="color:var(--mt)">Balance Due</span><span style="font-weight:700;color:${bal>0?'var(--rd)':'var(--gn)'}">$${bal.toLocaleString()}</span></div>
        <div class="fin-stat"><span style="color:var(--mt)">Status</span><span class="badge ${statusBadge[st]||'bm2'}">${st}</span></div>
        <div class="fin-stat"><span style="color:var(--mt)">Last Payment</span><span>${d.lastPayment?fds(d.lastPayment):'Never'}</span></div>
        <div class="fin-stat"><span style="color:var(--mt)">Restriction</span><span style="color:${d.restriction&&d.restriction!=='None'?'var(--rd)':'var(--mt)'};font-weight:500">${d.restriction||'None'}</span></div>
        ${canEdit?`<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-p" style="height:26px;font-size:11px" onclick="finOpenPaymentFor('${memberId}')"><i class="ti ti-plus"></i>Record Payment</button>
          <button class="btn" style="height:26px;font-size:11px" onclick="finOpenFineFor('${memberId}')"><i class="ti ti-gavel"></i>Add Fine</button>
        </div>`:''}
      </div>
      <div>
        <div class="card-t" style="margin-bottom:8px">Outstanding Fines (${fines.filter(f=>f.status==='Unpaid').length})</div>
        ${fines.length?fines.map(f=>`<div class="fin-fine-row"><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500">${esc(f.type)}: $${f.amount.toLocaleString()}</div><div style="font-size:10px;color:var(--ht)">${fds(f.date)} · ${esc(f.reason)}</div></div><span class="badge ${f.status==='Paid'?'bg2':'br2'}">${esc(f.status)}</span></div>`).join(''):`<div style="font-size:11.5px;color:var(--ht);padding:8px 0">No fines</div>`}
        ${plan?`<div class="card-t" style="margin-top:11px;margin-bottom:8px">Payment Plan</div>
        <div class="fin-stat"><span style="color:var(--mt)">Total</span><span>$${plan.total.toLocaleString()}</span></div>
        <div class="fin-stat"><span style="color:var(--mt)">Paid</span><span style="color:var(--gn);font-weight:500">$${plan.paid.toLocaleString()}</span></div>
        <div class="fin-stat"><span style="color:var(--mt)">Next Due</span><span>${plan.nextDue?fds(plan.nextDue):'N/A'}</span></div>`:''}
      </div>
    </div>
    <div>
      <div class="card-t" style="margin-bottom:8px">Payment History (${payments.length})</div>
      ${payments.length?payments.map(p=>`<div class="fin-pay-row"><div class="fin-pay-icon" style="background:var(--gn-bg)"><i class="ti ti-cash" style="color:var(--gn)"></i></div><div style="flex:1"><div style="font-size:12px;font-weight:500">$${p.amount.toLocaleString()}, ${esc(p.type)}</div><div style="font-size:10px;color:var(--ht)">${fds(p.date)} · ${esc(p.method)}${p.notes?' · '+esc(p.notes):''}</div></div><span style="font-size:11px;font-weight:600;color:var(--gn)">+$${p.amount.toLocaleString()}</span></div>`).join(''):`<div style="font-size:11.5px;color:var(--ht);padding:6px 0">No payment history</div>`}
    </div>`;
  modal.classList.add('open');
}

// ── RECORD PAYMENT ──
function finOpenPayment(){
  const sel=document.getElementById('fpay-member');
  sel.innerHTML=mOpts();
  document.getElementById('fpay-date').value=localDateStr();
  document.getElementById('fpay-amount').value='';
  openM('m-fin-payment');
}
function finOpenPaymentFor(memberId){
  finOpenPayment();
  const sel=document.getElementById('fpay-member');if(sel)sel.value=memberId;
}

async function finRecordPayment(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can record payments.','error');return;}
  if(!isCurrentSemester(finSem())){toast('This semester is read-only.','error');return;}
  const memberId=document.getElementById('fpay-member').value;
  const amount=parseFloat(document.getElementById('fpay-amount').value);
  if(!memberId||isNaN(amount)||amount<=0){toast('Member and amount are required','error');return;}
  const date=document.getElementById('fpay-date').value||localDateStr();
  const type=document.getElementById('fpay-type').value;
  const method=document.getElementById('fpay-method').value;
  const notes=document.getElementById('fpay-notes').value.trim();
  const payment={id:'py'+uid(),memberId,amount,type,method,date,notes,by:CURRENT_USER?CURRENT_USER.mid:'m3'};
  D.finance.payments.unshift(payment);
  const rec=finEnsureDuesRec(memberId,getSemester());
  const prevPaid=rec.paid;
  const prevLastPayment=rec.lastPayment;
  const prevStatus=rec.status;
  rec.paid=Math.min(rec.semesterDues,rec.paid+amount);
  rec.lastPayment=date;
  rec.status=rec.paid>=rec.semesterDues?'Paid':'Partial';
  try{
    await Promise.all([saveFinanceLedger(), saveFinanceDues(memberId)]);
    closeM(null,document.getElementById('m-fin-payment'));
    toast('Payment of $'+amount+' recorded for '+mB(memberId).name.split(' ')[0],'success');
    if(FIN_ACTIVE_TAB==='fin-dues')finRenderDues();
    else if(FIN_ACTIVE_TAB==='fin-overview')finRenderOverview();
  }catch(e){
    D.finance.payments=D.finance.payments.filter(p=>p.id!==payment.id);
    rec.paid=prevPaid;
    rec.lastPayment=prevLastPayment;
    rec.status=prevStatus;
    toast('Failed to record payment. Please try again.','error');
  }
}

// ── ADD FINE ──
function finOpenAddFine(){
  const sel=document.getElementById('ffine-member');
  sel.innerHTML=mOpts();
  document.getElementById('ffine-date').value=localDateStr();
  document.getElementById('ffine-amount').value='';
  document.getElementById('ffine-reason').value='';
  openM('m-fin-fine');
}
function finOpenFineFor(memberId){
  finOpenAddFine();
  const sel=document.getElementById('ffine-member');if(sel)sel.value=memberId;
}

async function finAddFine(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can issue fines.','error');return;}
  if(!isCurrentSemester(finSem())){toast('This semester is read-only.','error');return;}
  const memberId=document.getElementById('ffine-member').value;
  const amount=parseFloat(document.getElementById('ffine-amount').value);
  if(!memberId||isNaN(amount)||amount<=0){toast('Member and amount are required','error');return;}
  const fine={id:'fn'+uid(),memberId,type:document.getElementById('ffine-type').value,amount,reason:document.getElementById('ffine-reason').value.trim()||'Fine issued',date:document.getElementById('ffine-date').value||localDateStr(),status:'Unpaid',paidDate:''};
  D.finance.fines.unshift(fine);
  const rec=finEnsureDuesRec(memberId,getSemester());
  const prevCount=rec.fineCount||0;
  rec.fineCount=prevCount+1;
  try{
    await Promise.all([saveFinanceLedger(), saveFinanceDues(memberId)]);
    closeM(null,document.getElementById('m-fin-fine'));
    toast('Fine of $'+amount+' issued to '+mB(memberId).name.split(' ')[0],'success');
    if(FIN_ACTIVE_TAB==='fin-fines')finRenderFines();
    else if(FIN_ACTIVE_TAB==='fin-overview')finRenderOverview();
  }catch(e){
    D.finance.fines=D.finance.fines.filter(f=>f.id!==fine.id);
    rec.fineCount=prevCount;
    toast('Failed to issue fine. Please try again.','error');
  }
}

// Auto-generated fine for an Unexcused Miss, created from the attendance-marking flow
// (js/attendance.js) rather than the manual Add Fine modal — gated by canEditAttendance()
// (President/VP/Secretary) instead of finCheckPerms(), since the Secretary marking attendance
// is exactly who's expected to issue these, not just Treasurer/President/VP. Same fine object
// shape finAddFine() builds, plus an eventId so a re-save of the same event's attendance can
// tell "already fined for this" apart from "needs a new fine". Always lands in the CURRENT
// semester's dues — attendance can only be marked for current-semester events in the first
// place (see js/attendance.js's own semester guard), so this is never reachable for a past one.
async function finAddAttendanceFine(memberId, eventId, eventTitle, amount){
  const fine={id:'fn'+uid(),memberId,eventId,type:'Attendance',amount,reason:'Unexcused absence: '+eventTitle,date:localDateStr(),status:'Unpaid',paidDate:''};
  D.finance.fines.unshift(fine);
  const rec=finEnsureDuesRec(memberId,getSemester());
  const prevCount=rec.fineCount||0;
  rec.fineCount=prevCount+1;
  try{
    await Promise.all([saveFinanceLedger(), saveFinanceDues(memberId)]);
  }catch(e){
    D.finance.fines=D.finance.fines.filter(f=>f.id!==fine.id);
    rec.fineCount=prevCount;
    throw e;
  }
}
// Has this member already been fined for this specific event's unexcused miss? (checked before
// prompting, and again defensively before creating, so re-editing an already-fined event's
// attendance never double-fines someone.)
function finHasAttendanceFine(memberId, eventId){
  return (D.finance.fines||[]).some(f=>f.type==='Attendance'&&f.memberId===memberId&&f.eventId===eventId);
}

async function finMarkFinePaid(fineId){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can mark fines paid.','error');return;}
  if(!isCurrentSemester(finSem())){toast('This semester is read-only.','error');return;}
  const f=D.finance.fines.find(x=>x.id===fineId);
  if(!f)return;
  const prevStatus=f.status;const prevDate=f.paidDate;
  f.status='Paid';f.paidDate=localDateStr();
  try{await saveFinanceLedger();finRenderFines();toast('Fine marked as paid','success');}
  catch(e){f.status=prevStatus;f.paidDate=prevDate;toast('Failed to update fine. Please try again.','error');}
}

// ── LOG EXPENSE ──
function finOpenAddExpense(){
  document.getElementById('fexp-date').value=localDateStr();
  document.getElementById('fexp-amount').value='';
  document.getElementById('fexp-desc').value='';
  const catSel=document.getElementById('fexp-cat');
  if(catSel)catSel.innerHTML=getCatNames().map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  const sel=document.getElementById('fexp-officer');
  sel.innerHTML=sortedMembers().filter(m=>m.role!=='Member').map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('');
  if(CURRENT_USER)sel.value=CURRENT_USER.mid;
  openM('m-fin-expense');
}

async function finLogExpense(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can log expenses.','error');return;}
  const cat=document.getElementById('fexp-cat').value;
  const amount=parseFloat(document.getElementById('fexp-amount').value);
  const desc=document.getElementById('fexp-desc').value.trim();
  if(!cat||isNaN(amount)||amount<=0||!desc){toast('Category, amount, and description are required','error');return;}
  const expense={id:'ex'+uid(),category:cat,desc,amount,officer:document.getElementById('fexp-officer').value,date:document.getElementById('fexp-date').value||localDateStr()};
  D.finance.expenses.unshift(expense);
  try{
    await saveFinanceLedger();
    closeM(null,document.getElementById('m-fin-expense'));
    toast('Expense of $'+amount+' logged under '+cat,'success');
    if(FIN_ACTIVE_TAB==='fin-budget')finRenderBudget();
    else if(FIN_ACTIVE_TAB==='fin-overview')finRenderOverview();
  }catch(e){
    D.finance.expenses=D.finance.expenses.filter(x=>x.id!==expense.id);
    toast('Failed to log expense. Please try again.','error');
  }
}

// ── PAYMENT PLAN ──
function finOpenAddPlan(){
  const sel=document.getElementById('fplan-member');
  sel.innerHTML=mOpts();
  document.getElementById('fplan-start').value=localDateStr();
  document.getElementById('fplan-total').value='';
  document.getElementById('fplan-notes').value='';
  openM('m-fin-plan');
}

async function finCreatePlan(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can create payment plans.','error');return;}
  if(!isCurrentSemester(finSem())){toast('This semester is read-only.','error');return;}
  const memberId=document.getElementById('fplan-member').value;
  const total=parseFloat(document.getElementById('fplan-total').value);
  if(!memberId||isNaN(total)||total<=0){toast('Member and total are required','error');return;}
  const inst=parseInt(document.getElementById('fplan-inst').value);
  const startDate=new Date(document.getElementById('fplan-start').value+'T12:00:00');
  const nextDue=localDateStr(startDate);
  const plan={id:'pl'+uid(),memberId,total,paid:0,installments:inst,installmentAmt:Math.round(total/inst*100)/100,nextDue,notes:document.getElementById('fplan-notes').value.trim(),status:'Active',createdDate:localDateStr()};
  D.finance.plans.push(plan);
  const rec=finDuesRec(memberId,getSemester());
  const prevDuesStatus=rec?.status;
  if(rec)rec.status='Payment Plan';
  try{
    await Promise.all([saveFinanceLedger(), rec?saveFinanceDues(memberId):Promise.resolve()]);
    closeM(null,document.getElementById('m-fin-plan'));
    toast('Payment plan created for '+mB(memberId).name.split(' ')[0],'success');
    if(FIN_ACTIVE_TAB==='fin-plans')finRenderPlans();
  }catch(e){
    D.finance.plans=D.finance.plans.filter(p=>p.id!==plan.id);
    if(rec&&prevDuesStatus!==undefined)rec.status=prevDuesStatus;
    toast('Failed to create payment plan. Please try again.','error');
  }
}

// ── EXPORT ──
function finExport(){
  const sem=finSem();
  const dues=finDuesMapForSemester(sem);
  let csv='Name,Class Year,Semester Dues,Paid,Balance,Status,Last Payment,Fine Count\n';
  sortedMembers().forEach(m=>{
    const d=dues[m.id]||{semesterDues:getSemDues(m.id,sem),paid:0,status:'Partial',lastPayment:'',fineCount:0};
    csv+=`${csvSafe(m.name)},${m.classYear},$${d.semesterDues},$${d.paid},$${d.semesterDues-d.paid},${d.status||'Partial'},${d.lastPayment||''},${d.fineCount||0}\n`;
  });
  downloadCSV('dues_report_'+sem.replace(/\s+/g,'_')+'.csv',csv);
}

function _myMemberRecord(){
  if(!CURRENT_USER || !D.members) return null;
  return D.members.find(m => CURRENT_USER.mid && m.id === CURRENT_USER.mid)
      || D.members.find(m => m.email && m.email.toLowerCase() === (CURRENT_USER.email||'').toLowerCase())
      || D.members.find(m => m.name && m.name.toLowerCase() === (CURRENT_USER.name||'').toLowerCase())
      || null;
}

function renderSettings(){
  // Ensure all settings fields exist
  if(!D.settings.chapterName)D.settings.chapterName=CURRENT_USER?.chapterName||'';
  if(!D.settings.university)D.settings.university=CURRENT_USER?.university||'';

  // My Profile: read-only view pulled from the user's member record
  const myM = _myMemberRecord();
  const profName  = document.getElementById('se-name');
  const profYear  = document.getElementById('se-year');
  const profClass = document.getElementById('se-class');
  const profSave  = document.querySelector('[onclick="saveProf()"]');
  if(profName)  { profName.value  = myM?.name      || CURRENT_USER?.name || ''; profName.readOnly  = true; profName.style.cssText  += ';opacity:.7;cursor:default'; }
  if(profYear)  { profYear.value  = myM?.year      || '';                        profYear.readOnly  = true; profYear.style.cssText  += ';opacity:.7;cursor:default'; }
  if(profClass) { profClass.value = myM?.classYear || 'Senior';                  profClass.disabled = true; profClass.style.cssText += ';opacity:.7;cursor:default'; }
  if(profSave)  profSave.style.display = 'none';
  const profNote = document.getElementById('se-prof-note');
  if(profNote) profNote.style.display = '';

  // Chapter info — editable by President/VP/admin only
  const chInfEl=document.getElementById('se-chapter-info');
  if(chInfEl){
    const ro = isLeadUser() ? '' : ' readonly style="opacity:.6;cursor:not-allowed"';
    chInfEl.innerHTML=`
      <div class="fr c2">
        <div class="fld"><label>Chapter Name</label><input id="se-ch-name" value="${esc(D.settings.chapterName)}" placeholder="e.g. Beta Beta"${ro}></div>
        <div class="fld"><label>University</label><input id="se-ch-uni" value="${esc(D.settings.university)}" placeholder="e.g. University of Alabama in Huntsville"${ro}></div>
      </div>
      <div class="fr c2">
        <div class="fld"><label>Founded Year</label><input id="se-ch-founded" value="${esc(D.settings.chapterFounded)}" placeholder="e.g. 1948" type="number"${ro}></div>
        <div class="fld"><label>IFC Chapter Email</label><input id="se-ch-email" value="${esc(D.settings.chapterEmail)}" placeholder="ato@youruniversity.edu"${ro}></div>
      </div>
      ${isLeadUser()
        ? `<button class="btn btn-p" onclick="saveChapterInfo()"><i class="ti ti-device-floppy"></i>Save Chapter Info</button>`
        : `<div style="font-size:11.5px;color:var(--mt);margin-top:6px"><i class="ti ti-lock" style="font-size:12px;margin-right:4px"></i>Only a chapter lead can edit chapter settings.</div>`}
    `;
  }

  // System info (read-only)
  const lastLoginDisplay=CURRENT_USER&&CURRENT_USER.lastLogin?CURRENT_USER.lastLogin:'First session';
  document.getElementById('se-info').innerHTML=[
    ['Chapter',D.settings.chapterName||CURRENT_USER?.chapterName||'N/A'],
    ['University',D.settings.university||CURRENT_USER?.university||'N/A'],
    ['Semester',getSemester()],
    ['Total members',D.members.length],
    ['Your role',CURRENT_USER?CURRENT_USER.title:'N/A'],
    ['Last login',lastLoginDisplay]
  ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bdr);font-size:12.5px"><span style="color:var(--mt)">${esc(l)}</span><span style="font-weight:500">${esc(v)}</span></div>`).join('');

  // User management table (officer accounts)
  seRenderUsers();
  // Enabled Modules — lead-only, edits CURRENT_CHAPTER.enabledModules directly. Rendered before
  // Positions & Permissions since that editor's own per-page grant list is filtered by this.
  if(typeof seRenderModules==='function')seRenderModules();
  // Positions & Permissions — lead-only, edits CURRENT_CHAPTER.positions directly
  if(typeof seRenderPositions==='function')seRenderPositions();
  // Member approval (general members, viewer role) — shown inside Chapter Settings card
  if(typeof seRenderMemberApproval==='function')seRenderMemberApproval();
  // Chapter Achievements — feeds the True Merit Report Assistant's awards_and_achievements
  // section (js/truemerit.js).
  if(typeof tmRenderAchievements==='function')tmRenderAchievements();
}

function saveChapterInfo(){
  D.settings.chapterName=document.getElementById('se-ch-name')?.value.trim()||D.settings.chapterName;
  D.settings.university=document.getElementById('se-ch-uni')?.value.trim()||D.settings.university;
  D.settings.chapterFounded=document.getElementById('se-ch-founded')?.value||D.settings.chapterFounded;
  D.settings.chapterEmail=document.getElementById('se-ch-email')?.value.trim()||D.settings.chapterEmail;
  saveD('settings');renderSettings();toast('Chapter info saved','success');
}

// seRenderUsers is defined below near the Firebase auth section

// ── BUDGET CATEGORY MANAGER ──
const FIN_CAT_COLOR_OPTS=[
  {label:'Navy',   val:'var(--navy)'},
  {label:'Blue',   val:'var(--bl)'},
  {label:'Green',  val:'var(--gn)'},
  {label:'Red',    val:'var(--rd)'},
  {label:'Amber',  val:'var(--am)'},
  {label:'Gray',   val:'var(--mt)'},
  {label:'Muted',  val:'var(--ht)'},
];
const FIN_CAT_ICON_OPTS=[
  'ti-home','ti-bolt','ti-flame','ti-recycle','ti-building','ti-device-tv',
  'ti-trophy','ti-tool','ti-confetti','ti-book','ti-heart','ti-heart-handshake',
  'ti-users-group','ti-school','ti-dots','ti-cash','ti-chart-bar','ti-receipt',
  'ti-star','ti-music','ti-ball-basketball','ti-car','ti-pizza','ti-shirt','ti-gift',
];

function finRenderCatManager(){
  const el=document.getElementById('fin-cat-manager');
  if(!el)return;
  const cats=getBudgetCats();
  const colorOpts=FIN_CAT_COLOR_OPTS.map(o=>`<option value="${o.val}">${o.label}</option>`).join('');
  const iconOpts=FIN_CAT_ICON_OPTS.map(i=>`<option value="${i}">${i.replace('ti-','')}</option>`).join('');
  el.innerHTML=`
    <div id="fin-cat-rows" style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
      ${cats.map((c,i)=>finCatRow(c,i,colorOpts,iconOpts)).join('')}
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap">
      <button class="btn" onclick="finAddCatRow()" style="font-size:11px"><i class="ti ti-plus"></i>Add Category</button>
      <button class="btn" onclick="finResetCats()" style="font-size:11px;color:var(--rd)">Reset to Defaults</button>
      <button class="btn btn-p" onclick="finSaveCats()" style="margin-left:auto"><i class="ti ti-device-floppy"></i>Save Categories</button>
    </div>`;
  el.querySelectorAll('.fin-cat-icon-sel').forEach(sel=>finCatPreviewIcon(sel));
}

// Flexible = discretionary spending the exec board can realistically adjust (events, scholarship);
// Non-Flexible = fixed/required costs (rent, utilities, national dues). A button rather than a
// select so the red/green coloring itself carries the meaning at a glance, same convention as the
// budget's own spent-vs-allocated color coding elsewhere on this tab.
function finFlexToggleHtml(flexible){
  return `<button type="button" class="fin-cat-flex-toggle btn" data-flexible="${flexible?'true':'false'}" onclick="finToggleCatFlexible(this)"
    style="height:28px;padding:0 9px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;border:1px solid transparent;flex-shrink:0;white-space:nowrap;${flexible?'background:var(--gn-bg);color:var(--gn-tx)':'background:var(--rd-bg);color:var(--rd-tx)'}"
    title="Click to toggle">${flexible?'Flexible':'Non-Flexible'}</button>`;
}
function finToggleCatFlexible(btn){
  const flexible=btn.dataset.flexible!=='true';
  btn.dataset.flexible=flexible?'true':'false';
  btn.textContent=flexible?'Flexible':'Non-Flexible';
  btn.style.background=flexible?'var(--gn-bg)':'var(--rd-bg)';
  btn.style.color=flexible?'var(--gn-tx)':'var(--rd-tx)';
}

function finCatRow(c,i,colorOpts,iconOpts){
  if(!colorOpts)colorOpts=FIN_CAT_COLOR_OPTS.map(o=>`<option value="${o.val}">${o.label}</option>`).join('');
  if(!iconOpts)iconOpts=FIN_CAT_ICON_OPTS.map(x=>`<option value="${x}">${x.replace('ti-','')}</option>`).join('');
  const selColor=colorOpts.replace(`value="${c.color}"`,`value="${c.color}" selected`);
  const selIcon=iconOpts.replace(`value="${c.icon}"`,`value="${c.icon}" selected`);
  const inp=`style="height:28px;padding:0 7px;border:1px solid var(--bdr);border-radius:var(--r-xs);font-size:11.5px;font-family:inherit;color:var(--tx);background:var(--surf);outline:none"`;
  return`<div class="fin-cat-row" style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--bdr);flex-wrap:wrap">
    <i class="ti fin-cat-icon-preview" style="font-size:14px;color:var(--mt);width:18px;flex-shrink:0"></i>
    <select class="fin-cat-icon-sel" onchange="finCatPreviewIcon(this)" ${inp} style="height:28px;padding:0 5px;font-size:11px;width:110px;flex-shrink:0">${selIcon}</select>
    <select class="fin-cat-color-sel" ${inp} style="height:28px;padding:0 5px;font-size:11px;width:80px;flex-shrink:0">${selColor}</select>
    <input class="fin-cat-name-inp" value="${esc(c.name)}" placeholder="Category name" ${inp} style="flex:1;min-width:80px">
    ${finFlexToggleHtml(c.flexible!==false)}
    <button onclick="finMoveCatRow(this,-1)" class="btn" style="padding:0 6px;height:26px;font-size:11px" title="Move up" aria-label="Move ${esc(c.name)} category up"><i class="ti ti-chevron-up"></i></button>
    <button onclick="finMoveCatRow(this,1)" class="btn" style="padding:0 6px;height:26px;font-size:11px" title="Move down" aria-label="Move ${esc(c.name)} category down"><i class="ti ti-chevron-down"></i></button>
    <button onclick="finDeleteCatRow(this)" class="btn btn-d" style="padding:0 6px;height:26px;font-size:11px" aria-label="Delete ${esc(c.name)} category"><i class="ti ti-trash"></i></button>
  </div>`;
}

function finCatPreviewIcon(sel){
  const row=sel.closest('.fin-cat-row');
  const prev=row?.querySelector('.fin-cat-icon-preview');
  if(prev){prev.className='ti '+sel.value+' fin-cat-icon-preview';prev.style.fontSize='14px';prev.style.color='var(--mt)';prev.style.width='18px';}
}

function finAddCatRow(){
  const rows=document.getElementById('fin-cat-rows');
  if(!rows)return;
  const div=document.createElement('div');
  div.innerHTML=finCatRow({name:'',color:'var(--navy)',icon:'ti-cash',flexible:true},0);
  rows.appendChild(div.firstElementChild);
  rows.querySelector('.fin-cat-row:last-child .fin-cat-name-inp')?.focus();
}

function finDeleteCatRow(btn){
  btn.closest('.fin-cat-row')?.remove();
}

function finMoveCatRow(btn, dir){
  const row=btn.closest('.fin-cat-row');
  const rows=document.getElementById('fin-cat-rows');
  if(!row||!rows)return;
  const all=[...rows.children];
  const idx=all.indexOf(row);
  const target=all[idx+dir];
  if(!target)return;
  if(dir===-1)rows.insertBefore(row,target);
  else rows.insertBefore(target,row);
}

function finSaveCats(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can edit budget categories.','error');return;}
  const rows=document.querySelectorAll('#fin-cat-rows .fin-cat-row');
  const cats=[];
  rows.forEach(row=>{
    const name=(row.querySelector('.fin-cat-name-inp')?.value||'').trim();
    const color=row.querySelector('.fin-cat-color-sel')?.value||'var(--navy)';
    const icon=row.querySelector('.fin-cat-icon-sel')?.value||'ti-cash';
    const flexible=(row.querySelector('.fin-cat-flex-toggle')?.dataset.flexible??'true')==='true';
    if(name)cats.push({name,color,icon,flexible});
  });
  if(!cats.length){toast('Add at least one category','error');return;}
  if(!D.settings)D.settings={};
  D.settings.budgetCategories=cats;
  saveD('settings');
  finRenderCatManager();
  finRenderSettings();
  toast('Budget categories saved','success');
}

function finResetCats(){
  if(!canWrite()||!finCheckPerms()){toast('Only Treasurer, President, or VP can reset budget categories.','error');return;}
  if(!confirm('Reset to default categories? This will remove your custom categories.'))return;
  if(!D.settings)D.settings={};
  D.settings.budgetCategories=[];
  saveD('settings');
  finRenderCatManager();
  finRenderSettings();
  toast('Categories reset to defaults','success');
}



// ══════════════════════════════════════════════════
// REPORTS — Automated Chapter Reports
// ══════════════════════════════════════════════════

let RP_ACTIVE = 'weekly';

// ── Semester scoping — Reports has no stored data of its own (pure read-only generator over
// other modules' data), so there's nothing to lock: switching semesters just re-runs the active
// report reading historical data instead of current. Reuses each source module's own
// semester-aware accessors where they exist (Finance's finDuesMapForSemester/finBudgetForSemester,
// Recruitment's semester-keyed goal/rushees, Academics' semester-labeled history[]).
let RP_SELECTED_SEM=null;
function rpSem(){ return RP_SELECTED_SEM||getSemester(); }
function rpKnownSemesters(){
  return unionKnownSemesters([
    getSemester(),
    ...(typeof finKnownSemesters==='function'?finKnownSemesters():[]),
    ...(typeof rcKnownSemesters==='function'?rcKnownSemesters():[]),
    ...(D.academics?.history||[]).map(h=>h.semester),
  ]);
}
function rpSemesterChanged(){
  RP_SELECTED_SEM=document.getElementById('rp-semester-select').value;
  rpGenerate(RP_ACTIVE);
}

function renderReports(){
  initSemesterSelect('rp-semester-select',rpKnownSemesters(),rpSemesterChanged,rpSem());
  rpGenerate(RP_ACTIVE);
}

function rpSelect(el, type){
  document.querySelectorAll('.rp-item').forEach(i=>i.classList.remove('active'));
  el.classList.add('active');
  RP_ACTIVE=type;
  const titles={weekly:'Weekly Exec Summary',attendance:'Attendance Report',recruitment:'Recruitment Report',finance:'Finance Snapshot',academics:'Academic Standing',full:'Full Chapter Report'};
  const t=document.getElementById('rp-preview-title');
  if(t)t.textContent=titles[type]||type;
  rpGenerate(type);
}

function rpGenerate(type){
  const el=document.getElementById('rp-preview');
  if(!el)return;
  // Reports has no empty-state handling of its own (it's a pure read-only generator over other
  // modules' data, never an es()-managed list) — a brand-new chapter with no roster yet would
  // otherwise see every section render as zeros/blank tables, which reads as "this chapter has
  // zero attendance/dues/recruitment" rather than "nothing tracked yet." Caught once, here, rather
  // than in every individual rp* section builder. (Dead branch in this demo — the seeded roster is
  // never empty — kept in sync with the real app's js/reports.js anyway.)
  if(!D.members||!D.members.length){
    el.innerHTML=es('ti-file-analytics','slate','Nothing to report yet','Reports are generated from your chapter\'s attendance, finance, recruitment, and academic records — add members and start tracking data to see real reports here.','');
    return;
  }
  const fns={weekly:rpWeekly,attendance:rpAttendance,recruitment:rpRecruitment,finance:rpFinance,academics:rpAcademics,full:rpFull};
  el.innerHTML=(fns[type]||rpWeekly)(rpSem());
}

// ── HELPERS ──
function rpHeader(title, subtitle, sem){
  const now=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  return`<div class="rp-doc-header">
    <div class="rp-doc-title">${title}</div>
    <div class="rp-doc-meta">
      <span>ATO ${D.settings?.chapterName||CURRENT_USER?.chapterName||''} · ${D.settings?.university||CURRENT_USER?.university||''}</span>
      <span>${sem||getSemester()}</span>
      <span>Generated ${now}</span>
    </div>
    ${subtitle?`<div style="font-size:11.5px;opacity:.75;margin-top:6px">${subtitle}</div>`:''}
  </div>`;
}
function rpSection(icon, title, html){
  return`<div class="rp-section">
    <div class="rp-section-title"><i class="ti ${icon}"></i>${title}</div>
    ${html}
  </div>`;
}
function rpKpis(items){
  return`<div class="rp-kpi-row">${items.map(k=>`<div class="rp-kpi">
    <div class="rp-kpi-val" style="color:${k.color||'var(--tx)'}">${k.val}</div>
    <div class="rp-kpi-lbl">${k.label}</div>
  </div>`).join('')}</div>`;
}
function rpTable(heads, rows){
  return`<table class="rp-table"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// ── WEEKLY EXEC SUMMARY — always reflects right-now operational data (open tasks, overdue
// items, upcoming events) regardless of the selected semester, same reasoning Health Scorecard
// was excluded from semester partitioning entirely — this just labels which semester is active.
function rpWeekly(sem){
  const tot=D.members.length||1;
  const avg=Math.round(D.members.reduce((s,m)=>s+aR(m.id),0)/tot);
  const dn=D.tasks.filter(t=>t.status==='done').length;
  const openT=D.tasks.filter(t=>t.status!=='done').length;
  const ovT=D.tasks.filter(t=>isOv(t.dueDate)&&t.status!=='done').length;
  const openCases=D.cases.filter(c=>!['resolved','dismissed'].includes(c.status)).length;
  const upEvents=D.events.filter(e=>isUp(e.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
  const overdue=D.tasks.filter(t=>isOv(t.dueDate)&&t.status!=='done').sort((a,b)=>({urgent:0,high:1,medium:2,low:3}[a.priority]||2)-({urgent:0,high:1,medium:2,low:3}[b.priority]||2));
  const lowAtt=D.members.filter(m=>aR(m.id)<75);
  const unassignedShifts=sbFlatSlots().filter(s=>isUp(s.date)&&!s.memberId).length;

  return rpHeader('Weekly Executive Summary','Officer briefing: key metrics, action items, and upcoming events (always current, regardless of the semester selector)',sem)+
  rpSection('ti-chart-bar','Chapter Pulse',rpKpis([
    {label:'Attendance Avg',val:avg+'%',color:avg>=85?'var(--gn)':avg<75?'var(--rd)':'var(--am)'},
    {label:'Open Tasks',val:openT,color:ovT>0?'var(--rd)':'var(--tx)'},
    {label:'Tasks Overdue',val:ovT,color:ovT>0?'var(--rd)':'var(--gn)'},
    {label:'Open J-Board Cases',val:openCases,color:openCases>0?'var(--rd)':'var(--gn)'},
  ]))+
  rpSection('ti-alert-triangle','Action Items Required',
    (()=>{
      const items=[];
      if(ovT>0)items.push({icon:'ti-clock',text:`${ovT} overdue task${ovT>1?'s':''}: assign ownership and set new deadlines`,color:'var(--rd-bg)',ic:'var(--rd-tx)'});
      if(lowAtt.length)items.push({icon:'ti-user-x',text:`${lowAtt.length} member${lowAtt.length>1?'s':''} below 75% attendance: ${esc(lowAtt.slice(0,3).map(m=>m.name.split(' ')[0]).join(', '))}${lowAtt.length>3?` +${lowAtt.length-3} more`:''}`,color:'var(--am-bg)',ic:'var(--am-tx)'});
      if(unassignedShifts>0)items.push({icon:'ti-shield-exclamation',text:`${unassignedShifts} social monitor shift${unassignedShifts>1?'s':''} unassigned, needs coverage before next event`,color:'var(--bl-bg)',ic:'var(--bl-tx)'});
      if(openCases>0)items.push({icon:'ti-scale',text:`${openCases} open Judicial Board case${openCases>1?'s':''}: schedule hearings and follow up`,color:'var(--rd-bg)',ic:'var(--rd-tx)'});
      if(!items.length)return`<div style="color:var(--gn);font-size:12px;padding:10px 0"><i class="ti ti-circle-check" style="font-size:11px;margin-right:4px"></i>No urgent action items, chapter is in good standing.</div>`;
      return items.map(i=>`<div class="rp-alert-row"><i class="ti ${i.icon}" style="color:${i.ic};font-size:13px;flex-shrink:0;margin-top:1px"></i><span>${i.text}</span></div>`).join('');
    })()
  )+
  rpSection('ti-calendar-event','Upcoming Events',
    upEvents.length?rpTable(['Event','Date','Type','Location','Required'],upEvents.map(e=>[
      `<strong>${esc(e.title)}</strong>`,fd(e.date),esc(e.type)||'N/A',esc(e.location)||'N/A',e.mandatory?'<span style="color:var(--rd);font-weight:600">Yes</span>':'No'
    ])):(`<div style="color:var(--mt);font-size:12px">No upcoming events scheduled.</div>`)
  )+
  rpSection('ti-checkbox','Overdue Tasks',
    overdue.length?rpTable(['Task','Position','Priority','Days Overdue'],overdue.slice(0,8).map(t=>{
      const daysOv=Math.round((new Date()-new Date(t.dueDate+'T12:00:00'))/(1000*86400));
      const pc={urgent:'var(--rd)',high:'var(--rd)',medium:'var(--am)',low:'var(--mt)'};
      return[`<strong>${esc(t.title)}</strong>`,esc(t.positionTitle||'Unassigned'),`<span style="color:${pc[t.priority]||'var(--mt)'};">${esc(t.priority)}</span>`,`<span style="color:var(--rd)">${daysOv}d</span>`];
    })):(`<div style="color:var(--gn);font-size:12px">No overdue tasks, all on track.</div>`)
  )+
  rpSection('ti-users','Officer Accountability',
    (()=>{
      const offs=D.members.filter(m=>m.role!=='Member');
      if(!offs.length)return`<div style="color:var(--mt);font-size:12px">No officers found. Assign roles in Members.</div>`;
      // Shared with Dashboard's officer cards and the Analytics page's officer matrix
      // (js/analytics.js:calcOfficerEngagement) so this can't disagree with either.
      return rpTable(['Officer','Role','Tasks Done','Attendance','Status'],offs.map(m=>{
        const eng=calcOfficerEngagement(m.id);
        const statusColor={on_track:'var(--gn)',behind:'var(--am)',at_risk:'var(--rd)'}[eng.status];
        return[`<strong>${esc(m.name)}</strong>`,esc(m.role),`${eng.taskDone}/${eng.taskTotal}`,`<span style="color:${attTier(eng.attendanceRate).color}">${eng.attendanceRate}%</span>`,`<span style="color:${statusColor}">${eng.statusMeta.label}</span>`];
      }));
    })()
  );
}

// ── ATTENDANCE REPORT ──
function rpAttendance(sem){
  sem=sem||getSemester();
  const rate=m=>aRForSemester(m.id,sem);
  const range=semesterDateRange(sem);
  const tot=D.members.length||1;
  const avg=Math.round(D.members.reduce((s,m)=>s+rate(m),0)/tot);
  const good=D.members.filter(m=>rate(m)>=85).length;
  const risk=D.members.filter(m=>{const r=rate(m);return r>=65&&r<85;}).length;
  const warn=D.members.filter(m=>rate(m)<65).length;
  const mandEvents=D.events.filter(e=>e.mandatory&&!isUp(e.date)&&(!range||(e.date>=range.start&&e.date<=range.end)));
  const sorted=[...D.members].sort(mNameCompare);

  return rpHeader('Attendance Report',`${mandEvents.length} mandatory events tracked in ${sem}`,sem)+
  rpSection('ti-chart-bar','Summary',rpKpis([
    {label:'Chapter Avg',val:avg+'%',color:avg>=85?'var(--gn)':avg<75?'var(--rd)':'var(--am)'},
    {label:'Good Standing (85%+)',val:good,color:'var(--gn)'},
    {label:'At Risk (65–84%)',val:risk,color:'var(--am)'},
    {label:'Warning (<65%)',val:warn,color:warn>0?'var(--rd)':'var(--gn)'},
  ]))+
  rpSection('ti-alert-triangle','Members Requiring Attention',
    (()=>{
      const atRisk=sorted.filter(m=>rate(m)<80);
      if(!atRisk.length)return`<div style="color:var(--gn);font-size:12px"><i class="ti ti-circle-check" style="font-size:11px;margin-right:4px"></i>All members above 80%, no attendance concerns.</div>`;
      return rpTable(['Member','Class','Rate','Status'],atRisk.map(m=>{
        const r=rate(m);
        const s=r<65?['Warning','var(--rd)']:r<75?['At Risk','var(--rd)']:['Watch','var(--am)'];
        return[`<strong>${esc(m.name)}</strong>`,esc(m.classYear),`<span style="color:${s[1]};font-weight:700">${r}%</span>`,`<span style="color:${s[1]}">${s[0]}</span>`];
      }));
    })()
  )+
  rpSection('ti-users','Full Member Attendance',
    rpTable(['Member','Class','Role','Attendance Rate','Status'],[...D.members].sort(mNameCompare).map(m=>{
      const r=rate(m);
      const s=r>=85?['Good','var(--gn)']:r>=75?['Good','var(--navy)']:r>=65?['At Risk','var(--am)']:['Warning','var(--rd)'];
      return[esc(m.name),esc(m.classYear),esc(m.role)||'Member',`<span style="font-weight:600;color:${s[1]}">${r}%</span>`,`<span style="color:${s[1]}">${s[0]}</span>`];
    }))
  )+
  rpSection('ti-calendar-check','Mandatory Events in '+sem,
    mandEvents.length?rpTable(['Event','Date','Present','Unexcused','Rate'],mandEvents.sort((a,b)=>b.date.localeCompare(a.date)).map(ev=>{
      const att=D.attendance[ev.id]||{};
      const pres=Object.values(att).filter(v=>v==='present'||v==='excused').length;
      const abs=Object.values(att).filter(v=>v==='absent').length;
      const rate=Math.round(pres/tot*100);
      return[`<strong>${esc(ev.title)}</strong>`,fd(ev.date),pres,abs,`<span style="color:${rate>=85?'var(--gn)':rate>=75?'var(--navy)':'var(--rd)'};font-weight:600">${rate}%</span>`];
    })):(`<div style="color:var(--mt);font-size:12px">No mandatory events marked yet.</div>`)
  );
}

// ── RECRUITMENT REPORT ──
function rpRecruitment(sem){
  sem=sem||getSemester();
  const rushees=(D.recruitment.rushees||[]).filter(r=>!r.semester||r.semester===sem);
  const RCG=(D.recruitment.goal||{})[sem]||{target:20};
  const goal=rcGoalProgress(rushees,RCG);
  const lateStage=rcLateStageProspects(rushees).length;
  const hot=rcHotProspects(rushees).length;
  const stale=rushees.filter(r=>{if(!r.lastContact)return true;return Math.round((new Date()-new Date(r.lastContact+'T12:00:00'))/(86400000))>5&&!['Accepted','Bid Extended'].includes(r.stage);});

  return rpHeader('Recruitment Report',`${rushees.length} rushees in pipeline · ${sem}`,sem)+
  rpSection('ti-chart-bar','Pipeline Summary',rpKpis([
    {label:'Total Rushees',val:rushees.length,color:'var(--navy)'},
    {label:'Bid Ready or Later',val:lateStage,color:'var(--gn)'},
    {label:'Hot Prospects (70+)',val:hot,color:'var(--am-tx)'},
    {label:'Goal Progress (Accepted)',val:goal.pct+'%',color:'var(--bl)'},
  ]))+
  rpSection('ti-filter','Stage Breakdown',
    rpTable(['Stage','Count','% of Total'],rcStageDistribution(rushees).map(s=>[s.stage,s.count,`${s.pct}%`]))
  )+
  rpSection('ti-alert-circle','Needs Attention',
    (()=>{
      const items=[];
      if(stale.length)items.push(`${stale.length} rushee${stale.length>1?'s':''} not contacted in 5+ days: ${stale.slice(0,4).map(r=>r.name).join(', ')}${stale.length>4?' ...':''}`);
      const newNoContact=rushees.filter(r=>r.stage==='New Lead'&&!r.lastContact);
      if(newNoContact.length)items.push(`${newNoContact.length} new lead${newNoContact.length>1?'s':''} never contacted: ${newNoContact.slice(0,3).map(r=>r.name).join(', ')}`);
      if(!items.length)return`<div style="color:var(--gn);font-size:12px"><i class="ti ti-circle-check" style="font-size:11px;margin-right:4px"></i>All rushees recently contacted, recruitment on track.</div>`;
      return items.map(i=>`<div class="rp-alert-row"><i class="ti ti-clock" style="color:var(--am-tx);font-size:13px;flex-shrink:0"></i><span>${i}</span></div>`).join('');
    })()
  )+
  rpSection('ti-users','Full Rushee List',
    rushees.length?rpTable(['Name','Stage','Bid Score','Recruiter','Last Contact'],
      [...rushees].sort((a,b)=>(b.bidScore||0)-(a.bidScore||0)).map(r=>{
        const sc=r.bidScore>=85?'var(--gn)':r.bidScore>=70?'var(--bl)':r.bidScore>=50?'var(--am)':'var(--rd)';
        return[`<strong>${esc(r.name)}</strong>`,esc(r.stage),`<span style="font-weight:700;color:${sc}">${r.bidScore||0}</span>`,esc(mB(r.recruiter).name)||'N/A',r.lastContact?fds(r.lastContact):'<span style="color:var(--rd)">Never</span>'];
      })):`<div style="color:var(--mt);font-size:12px">No rushees in the pipeline yet.</div>`
  );
}

// ── FINANCE SNAPSHOT — reads via the semester-aware accessors Finance's own page uses
// (finDuesMapForSemester/finBudgetForSemester), fixing a pre-existing bug where this report
// still read Finance's now-legacy flat shape directly (dues[m.id].semesterDues never existed
// after Finance was restructured to {[semester]:{...}} — every "Overdue Dues" row was silently
// always empty). ──
function rpFinance(sem){
  sem=sem||getSemester();
  const fin=D.finance||{};
  const dues=typeof finDuesMapForSemester==='function'?finDuesMapForSemester(sem):{};
  const budget=typeof finBudgetForSemester==='function'?finBudgetForSemester(sem):{};
  const range=semesterDateRange(sem);
  const totalOwed=D.members.reduce((s,m)=>{const d=dues[m.id]||{};return s+(d.semesterDues||getSemDues(m.id,sem));},0);
  const totalPaid=D.members.reduce((s,m)=>{const d=dues[m.id]||{};return s+(d.paid||0);},0);
  const outstanding=totalOwed-totalPaid;
  const collRate=totalOwed>0?Math.round(totalPaid/totalOwed*100):0;
  const unpaid=D.members.filter(m=>{const d=dues[m.id]||{};const owed=d.semesterDues||getSemDues(m.id,sem);return(d.paid||0)<owed;});
  const expenses=(fin.expenses||[]).filter(e=>!range||(e.date>=range.start&&e.date<=range.end));
  const totalExp=expenses.reduce((s,e)=>s+(e.amount||0),0);

  return rpHeader('Finance Snapshot',`Dues collection and budget status · ${sem}`,sem)+
  rpSection('ti-chart-bar','Financial Summary',rpKpis([
    {label:'Total Owed',val:'$'+totalOwed.toLocaleString(),color:'var(--navy)'},
    {label:'Collected',val:'$'+totalPaid.toLocaleString(),color:'var(--gn)'},
    {label:'Outstanding',val:'$'+outstanding.toLocaleString(),color:outstanding>0?'var(--rd)':'var(--gn)'},
    {label:'Collection Rate',val:collRate+'%',color:collRate>=80?'var(--gn)':collRate>=60?'var(--am)':'var(--rd)'},
  ]))+
  rpSection('ti-alert-circle','Overdue Dues',
    unpaid.length?rpTable(['Member','Class','Owed','Paid','Balance','Status'],unpaid.map(m=>{
      const d=dues[m.id]||{};const owed=d.semesterDues||getSemDues(m.id,sem);const paid=d.paid||0;
      return[`<strong>${esc(m.name)}</strong>`,esc(m.classYear),`$${owed}`,`$${paid}`,`<span style="color:var(--rd);font-weight:600">$${owed-paid}</span>`,esc(d.status)||'Partial'];
    })):(`<div style="color:var(--gn);font-size:12px"><i class="ti ti-circle-check" style="font-size:11px;margin-right:4px"></i>All members current on dues.</div>`)
  )+
  rpSection('ti-receipt','Recent Expenses',
    expenses.length?rpTable(['Description','Category','Amount','Date'],
      [...expenses].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10).map(e=>[
        esc(e.desc||e.description)||'N/A',esc(e.category)||'N/A',`$${(e.amount||0).toLocaleString()}`,e.date?fds(e.date):'N/A'
      ])):(`<div style="color:var(--mt);font-size:12px">No expenses logged yet.</div>`)
  );
}

// ── ACADEMIC STANDING — D.academics.gpas is only ever current live values (overwritten each
// semester, no per-member history); only D.academics.history[] entries are semester-labeled, and
// they're chapter-wide aggregates with no per-member breakdown. When a past semester is
// selected, fall back to that reduced historical-summary mode rather than fabricating a
// per-member table the data doesn't have. ──
function rpAcademics(sem){
  sem=sem||getSemester();
  if(!D.academics)D.academics={gpas:{},history:[]};
  if(sem!==getSemester()){
    const hist=(D.academics.history||[]).find(h=>h.semester===sem);
    if(!hist){
      return rpHeader('Academic Standing Report',`Chapter GPA and individual member academic status · ${sem}`,sem)+
      rpSection('ti-list','No Historical Data',`<div style="color:var(--mt);font-size:12px">No academic history was recorded for ${esc(sem)}.</div>`);
    }
    return rpHeader('Academic Standing Report',`Chapter GPA and individual member academic status · ${sem}`,sem)+
    rpSection('ti-chart-bar','Academic Summary (Historical)',rpKpis([
      {label:'Chapter GPA',val:parseFloat(hist.chapterGpa).toFixed(2),color:'var(--navy)'},
      {label:'Cumulative Chapter GPA',val:hist.cumulativeChapterGpa?parseFloat(hist.cumulativeChapterGpa).toFixed(2):'N/A',color:'var(--bl)'},
      {label:'Members Tracked',val:hist.memberCount,color:'var(--bl)'},
    ]))+
    rpSection('ti-alert-circle','Note',`<div style="color:var(--mt);font-size:12px">Per-member GPA rankings are only available for the current semester. ${esc(sem)} only has a chapter-wide snapshot on record (saved ${fds(hist.date)}).</div>`);
  }
  const withGpa=D.members.map(m=>{const g=D.academics.gpas[m.id]||{};const cum=g.cumulativeGpa?parseFloat(g.cumulativeGpa):null;const pri=g.priorGpa?parseFloat(g.priorGpa):null;return{m,cum,pri};}).filter(x=>x.cum!==null||x.pri!==null);
  const gpas=withGpa.map(x=>x.cum??x.pri??0);
  const avgGpa=gpas.length?(gpas.reduce((a,b)=>a+b,0)/gpas.length).toFixed(2):'N/A';
  const deans=withGpa.filter(x=>(x.cum??0)>=3.5).length;
  const warn=withGpa.filter(x=>(x.cum??x.pri??4)<2.75).length;

  return rpHeader('Academic Standing Report',`Chapter GPA and individual member academic status · ${sem}`,sem)+
  rpSection('ti-chart-bar','Academic Summary',rpKpis([
    {label:'Chapter Avg GPA',val:avgGpa,color:'var(--navy)'},
    {label:"Dean's List (3.5+)",val:deans,color:'var(--gn)'},
    {label:'Members Tracked',val:withGpa.length+'/'+D.members.length,color:'var(--bl)'},
    {label:'Academic Warnings (<2.75)',val:warn,color:warn>0?'var(--rd)':'var(--gn)'},
  ]))+
  (warn>0?rpSection('ti-alert-triangle','Academic Warnings',
    rpTable(['Member','Class','Cumulative GPA','Last Semester','Status'],withGpa.filter(x=>(x.cum??x.pri??4)<2.75).sort((a,b)=>(a.cum??a.pri??4)-(b.cum??b.pri??4)).map(({m,cum,pri})=>[
      `<strong>${esc(m.name)}</strong>`,esc(m.classYear),
      cum!==null?`<span style="color:var(--rd);font-weight:700">${cum.toFixed(2)}</span>`:'N/A',
      pri!==null?pri.toFixed(2):'N/A',
      '<span style="color:var(--rd)">Warning</span>'
    ]))
  ):'')+
  rpSection('ti-list','Full Academic Rankings',
    withGpa.length?rpTable(['Rank','Member','Class','Cumulative GPA','Last Semester','Status'],
      [...withGpa].sort((a,b)=>(b.cum??b.pri??0)-(a.cum??a.pri??0)).map(({m,cum,pri},i)=>{
        const g=cum??pri??0;
        const status=g>=3.5?"Dean's List":g>=3.0?'Good Standing':g>=2.75?'Watch':'Warning';
        const sc=g>=3.5?'var(--gn)':g>=3.0?'var(--bl)':g>=2.75?'var(--am)':'var(--rd)';
        return[i+1,esc(m.name),esc(m.classYear),cum!==null?`<span style="font-weight:700;color:${sc}">${cum.toFixed(2)}</span>`:'N/A',pri!==null?pri.toFixed(2):'N/A',`<span style="color:${sc}">${status}</span>`];
      })):`<div style="color:var(--mt);font-size:12px">No GPA data entered yet. Add GPAs in the Academics page.</div>`
  );
}

// ── FULL CHAPTER REPORT ──
function rpFull(sem){
  sem=sem||getSemester();
  return rpHeader('Full Chapter Report','Comprehensive semester overview: all operational areas',sem)+
  `<div class="rp-section"><div class="rp-section-title"><i class="ti ti-layout-dashboard"></i>Section 1: Operations Overview</div>${rpWeekly(sem).replace(/<div class="rp-doc-header">[\s\S]*?<\/div>\s*/,'')}</div>`+
  `<div class="rp-divider"></div>`+
  `<div style="margin-top:14px;font-size:11px;color:var(--mt);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Section 2: Attendance</div>${rpAttendance(sem).replace(/<div class="rp-doc-header">[\s\S]*?<\/div>\s*/,'')}`+
  `<div class="rp-divider"></div>`+
  `<div style="margin-top:14px;font-size:11px;color:var(--mt);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Section 3: Recruitment</div>${rpRecruitment(sem).replace(/<div class="rp-doc-header">[\s\S]*?<\/div>\s*/,'')}`;
}

// ── PRINT ──
function rpPrint(){
  const content=document.getElementById('rp-preview')?.innerHTML||'';
  const title=document.getElementById('rp-preview-title')?.textContent||'Chapter Report';
  const w=window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><title>${title} - ATO ${D.settings?.chapterName||CURRENT_USER?.chapterName||''}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',system-ui,sans-serif;font-size:12.5px;color:#111827;line-height:1.6;padding:28px 32px;max-width:860px;margin:0 auto}
    .rp-doc-header{background:#C9A227;color:#151008;padding:18px 22px;border-radius:10px;margin-bottom:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rp-doc-title{font-size:20px;font-weight:700;margin-bottom:4px}
    .rp-doc-meta{font-size:11px;opacity:.75;display:flex;flex-wrap:wrap;gap:14px}
    .rp-section{margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid #E5E7EB}
    .rp-section:last-child{border-bottom:none}
    .rp-section-title{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#6B7280;margin-bottom:10px}
    .rp-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:0}
    .rp-kpi{background:#F2F4F7;border-radius:8px;padding:10px 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rp-kpi-val{font-size:20px;font-weight:700;line-height:1;margin-bottom:2px}
    .rp-kpi-lbl{font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em}
    .rp-table{width:100%;border-collapse:collapse;font-size:11.5px}
    .rp-table th{text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;padding:5px 7px;border-bottom:2px solid #E5E7EB}
    .rp-table td{padding:5px 7px;border-bottom:1px solid #E5E7EB}
    .rp-alert-row{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;background:#F2F4F7;border-radius:7px;margin-bottom:5px;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rp-divider{height:1px;background:#E5E7EB;margin:14px 0}
    @media print{body{padding:16px 20px}.rp-doc-header{-webkit-print-color-adjust:exact}}
  </style></head><body>${content}</body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),400);
}

// ── COPY TEXT ──
function rpCopy(){
  const el=document.getElementById('rp-preview');
  if(!el)return;
  const text=el.innerText||el.textContent||'';
  navigator.clipboard.writeText(text).then(()=>toast('Report copied to clipboard','success')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('Report copied to clipboard','success');
  });
}

// committees:renderCommittees now resolves to js/committees.js's renderCommittees() — this
// registry just holds a name reference, so it doesn't care which file defines it.
const R={dashboard:renderDash,attendance:renderAttendance,finance:renderFinance,calendar:renderCalendar,tasks:renderTasks,notes:renderNotes,judicial:renderJudicial,sober:renderSober,members:renderMembers,recruitment:renderRecruitment,academics:renderAcademics,committees:renderCommittees,analytics:renderAnalytics,files:renderFiles,transition:renderTransition,settings:renderSettings,philanthropy:renderPhilanthropy,communityService:renderCommunityService,alumni:renderAlumni,ritual:renderRitual,newMemberEducation:renderNewMemberEducation,healthscore:renderHealthScore,reports:renderReports,kcrew:renderKcrew,social:renderSocial,houseLife:renderHouseLife};



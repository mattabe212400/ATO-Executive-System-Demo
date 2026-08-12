// ── ACADEMICS ──

function acCanAccess(){
  return canEditPage('academics');
}

let AC_ACTIVE_TAB = 'ac-pane-overview';

function acTab(btn, tabId){
  document.querySelectorAll('.ac-tab').forEach(t=>t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('#ac-content div[id^="ac-pane-"]').forEach(d=>{d.style.display='none';});
  const el=document.getElementById(tabId);if(el)el.style.display='block';
  AC_ACTIVE_TAB=tabId;
}

function gpaColor(gpa){
  if(gpa===null||gpa===undefined||gpa==='')return'gpa-none';
  const g=parseFloat(gpa);
  if(g>=3.5)return'gpa-high';
  if(g>=3.0)return'gpa-good';
  if(g>=2.75)return'gpa-warn';
  return'gpa-risk';
}
function gpaTrend(gpa){
  const g=parseFloat(gpa);
  if(isNaN(g))return'';
  if(g>=3.5)return'<span style="color:var(--gn);font-size:10px">Dean\'s List</span>';
  if(g>=3.0)return'<span style="color:var(--bl);font-size:10px">Good Standing</span>';
  if(g>=2.75)return'<span style="color:var(--am);font-size:10px">Watch</span>';
  return'<span style="color:var(--rd);font-size:10px;font-weight:600">Academic Warning</span>';
}

function openUpdateGpa(){
  const sem=document.getElementById('gpa-semester');
  if(sem)sem.value=getSemester();
  filterGpaModal();
  openM('m-updategpa');
}

function gpaVal(id,field){
  const rec=D.academics.gpas[id]||{};
  return rec[field]||'';
}

function filterGpaModal(){
  const q=(document.getElementById('gpa-search')||{value:''}).value.toLowerCase();
  const cls=(document.getElementById('gpa-class-filter')||{value:'all'}).value;
  const members=D.members.filter(m=>{
    if(cls!=='all'&&m.classYear!==cls)return false;
    return m.name.toLowerCase().includes(q)||m.role.toLowerCase().includes(q);
  }).sort(mNameCompare);
  const list=document.getElementById('gpa-modal-list');
  if(!list)return;

  function inp(id,field,label){
    const v=gpaVal(id,field);
    return`<input type="number" id="gpa-${field}-${id}" step="0.01" min="0" max="4" value="${v}" placeholder="N/A"
      title="${label}"
      style="width:68px;height:28px;padding:0 6px;border:1px solid var(--bdr);border-radius:6px;font-size:11.5px;font-family:inherit;text-align:center;outline:none;transition:border .1s"
      onfocus="this.style.borderColor='var(--navy)'" onblur="this.style.borderColor='var(--bdr)'">`;
  }

  list.innerHTML=members.map(m=>{
    const cumV=gpaVal(m.id,'cumulativeGpa');
    const priV=gpaVal(m.id,'priorGpa');
    // Warning flag: use semester GPA if present, else cumulative
    const isWarn=cumV&&parseFloat(cumV)<2.75||priV&&parseFloat(priV)<2.75;
    return`<div style="display:grid;grid-template-columns:1fr 68px 68px;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr);${isWarn?'background:var(--rd-bg);margin:0 -2px;padding:6px 4px;border-radius:5px;':''}">
      <div style="display:flex;align-items:center;gap:8px;min-width:0">
        <div class="sh-av" style="width:24px;height:24px;font-size:8.5px;flex-shrink:0">${esc(m.initials)}</div>
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
          <div style="font-size:10px;color:var(--mt)">${esc(m.classYear)}</div>
        </div>
      </div>
      ${inp(m.id,'cumulativeGpa','Cumulative GPA')}
      ${inp(m.id,'priorGpa','Last Semester GPA')}
    </div>`;
  }).join('');
}

function saveGPAs(){
  if(!acCanAccess()){toast('Only officers with Academics edit access can update GPAs.','error');return;}
  if(!D.academics)D.academics={gpas:{},history:[]};
  const members=D.members;
  let changed=0;

  function parseGpa(v){
    if(!v||v.trim()==='')return null;
    const g=parseFloat(v);
    if(isNaN(g)||g<0||g>4)return 'err';
    return(Math.round(g*100)/100).toString();
  }

  for(const m of members){
    const cumV=parseGpa((document.getElementById('gpa-cumulativeGpa-'+m.id)||{value:''}).value);
    const priV=parseGpa((document.getElementById('gpa-priorGpa-'+m.id)||{value:''}).value);
    if(cumV==='err'||priV==='err'){toast('Invalid GPA for '+m.name+': must be 0.00–4.00','error');return;}
    const cur=D.academics.gpas[m.id]||{};
    const updated={
      semesterGpa:'',
      cumulativeGpa: cumV!==null?cumV:(cur.cumulativeGpa||''),
      priorGpa: priV!==null?priV:(cur.priorGpa||''),
    };
    if(JSON.stringify(cur)!==JSON.stringify(updated)){changed++;D.academics.gpas[m.id]=updated;}
  }

  // Snapshot: chapter GPA = avg of LAST SEMESTER GPAs
  const priorGpas=members.map(m=>(D.academics.gpas[m.id]||{}).priorGpa).filter(v=>v&&v!=='').map(v=>parseFloat(v)).filter(g=>!isNaN(g));
  const useGpas=priorGpas;

  if(useGpas.length){
    const avg=(useGpas.reduce((a,b)=>a+b,0)/useGpas.length).toFixed(3);
    const sem=(document.getElementById('gpa-semester')||{value:getSemester()}).value||getSemester();
    const cumGpas=members.map(m=>(D.academics.gpas[m.id]||{}).cumulativeGpa).filter(v=>v&&v!=='').map(v=>parseFloat(v)).filter(g=>!isNaN(g));
    const cumAvg=cumGpas.length?(cumGpas.reduce((a,b)=>a+b,0)/cumGpas.length).toFixed(3):null;
    const existing=D.academics.history.findIndex(h=>h.semester===sem);
    const entry={semester:sem,chapterGpa:avg,cumulativeChapterGpa:cumAvg,memberCount:useGpas.length,date:localDateStr()};
    if(existing>=0)D.academics.history[existing]=entry;
    else D.academics.history.unshift(entry);
  }

  saveD('academics');
  closeM(null,document.getElementById('m-updategpa'));
  renderAcademics();
  toast('GPAs updated for '+changed+' member'+(changed!==1?'s':'')+(changed===0?' (no changes)':''),changed?'success':'info');
}

function filterAc(){
  const q=(document.getElementById('ac-search')||{value:''}).value.toLowerCase();
  const cls=(document.getElementById('ac-filter')||{value:'all'}).value;
  document.querySelectorAll('#ac-table tbody tr').forEach(tr=>{
    const matchQ=(tr.dataset.name||'').toLowerCase().includes(q);
    const matchC=cls==='all'||(tr.dataset.class||'')===cls;
    tr.style.display=(matchQ&&matchC)?'':'none';
  });
}

function renderAcademics(){
  const gate=document.getElementById('ac-gate');
  const content=document.getElementById('ac-content');
  if(!canAccess('academics')){
    if(gate)gate.style.display='block';
    if(content)content.style.display='none';
    return;
  }
  if(gate)gate.style.display='none';
  if(content)content.style.display='block';
  const updateBtn=document.getElementById('ac-update-gpa-btn');
  if(updateBtn)updateBtn.style.display=acCanAccess()?'':'none';
  if(!D.academics)D.academics={gpas:{},history:[]};
  if(!D.academics.gradeChecks)D.academics.gradeChecks=[];
  if(!D.academics.nmCheckins)D.academics.nmCheckins={};
  // Restore to active tab (or default to overview on first load)
  document.querySelectorAll('.ac-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===AC_ACTIVE_TAB));
  document.querySelectorAll('#ac-content div[id^="ac-pane-"]').forEach(d=>{d.style.display=d.id===AC_ACTIVE_TAB?'block':'none';});

  // Build member GPA objects with all three values
  function getMemberGpas(m){
    const rec=D.academics.gpas[m.id]||{};
    const sem=rec.semesterGpa&&rec.semesterGpa!==''?parseFloat(rec.semesterGpa):null;
    const cum=rec.cumulativeGpa&&rec.cumulativeGpa!==''?parseFloat(rec.cumulativeGpa):null;
    const pri=rec.priorGpa&&rec.priorGpa!==''?parseFloat(rec.priorGpa):null;
    return{m,sem,cum,pri,hasAny:sem!==null||cum!==null||pri!==null};
  }
  const allMemberGpas=sortedMembers().map(getMemberGpas);
  const withAny=allMemberGpas.filter(x=>x.hasAny);

  // Chapter GPA = prior semester avg (per spec); fallback to semester avg
  const hist=D.academics.history;
  const latestHist=hist[0]||null;
  const chapterGpaDisplay=latestHist?parseFloat(latestHist.chapterGpa).toFixed(2):null;

  // For KPIs: use semester GPA if present for warnings/deans list (current standing)
  const withCum=allMemberGpas.filter(x=>x.cum!==null);
  const withPri=allMemberGpas.filter(x=>x.pri!==null);
  const deansList=withCum.filter(x=>x.cum>=3.5).length;
  const goodStand=withCum.filter(x=>x.cum>=3.0&&x.cum<3.5).length;
  // Warning: flag by cumulative, or last semester if no cumulative
  const warnMembers=withAny.filter(x=>{
    const check=x.cum!==null?x.cum:(x.pri!==null?x.pri:null);
    return check!==null&&check<2.75;
  });

  // KPIs
  document.getElementById('ac-kpi').innerHTML=
    statStrip('Chapter GPA',chapterGpaDisplay||'N/A',latestHist?'Prior semester · '+latestHist.semester+(latestHist.semester&&latestHist.semester.toLowerCase().startsWith('spring')?' · Excludes Spring graduates':''):'No history yet, save GPAs to record','neutral')+
    statStrip("Dean's List",deansList,'3.50 and above (cumulative)',deansList>0?'up':'neutral')+
    statStrip('Good Standing',goodStand,'3.00 – 3.49 (cumulative)','neutral')+
    statStrip('Academic Warnings',warnMembers.length,'Below 2.75',warnMembers.length>0?'down':'neutral');

  // Sort by cumulative GPA descending for ranking, then semester, then prior
  const ranked=[...withAny].sort((a,b)=>{
    const ag=a.cum??a.pri??0;
    const bg=b.cum??b.pri??0;
    return bg-ag;
  });
  const noGpa=allMemberGpas.filter(x=>!x.hasAny);

  // Main table
  document.getElementById('ac-table').innerHTML=`<thead><tr>
    <th>#</th><th>Member</th><th>Class</th>
    <th style="text-align:center">Cumulative GPA</th>
    <th style="text-align:center">Last Semester</th>
    <th>Status</th>
  </tr></thead><tbody>${[
    ...ranked.map((x,i)=>({...x,rank:i+1})),
    ...noGpa.map(x=>({...x,rank:null}))
  ].map(row=>{
    const statusGpa=row.cum??row.pri??null;
    return`<tr data-name="${row.m.name}" data-class="${row.m.classYear}">
      <td style="color:var(--ht);font-size:11px">${row.rank||'N/A'}</td>
      <td><div style="display:flex;align-items:center;gap:7px">
        <div class="sh-av" style="width:24px;height:24px;font-size:8.5px">${row.m.initials}</div>
        <span style="font-weight:500">${row.m.name}</span>
      </div></td>
      <td style="color:var(--mt)">${row.m.classYear}</td>
      <td style="text-align:center"><span class="gpa-badge ${gpaColor(row.cum)}">${row.cum!==null?row.cum.toFixed(2):'N/A'}</span></td>
      <td style="text-align:center"><span class="gpa-badge ${gpaColor(row.pri)}">${row.pri!==null?row.pri.toFixed(2):'N/A'}</span></td>
      <td>${gpaTrend(statusGpa)}</td>
    </tr>`;
  }).join('')}</tbody>`;
  document.getElementById('ac-mobile-cards').innerHTML=[
    ...ranked.map((x,i)=>({...x,rank:i+1})),
    ...noGpa.map(x=>({...x,rank:null}))
  ].map(row=>{
    const statusGpa=row.cum??row.pri??null;
    return`<div class="mob-card card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="sh-av" style="width:38px;height:38px;font-size:13px;flex-shrink:0">${row.m.initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${row.m.name}</div>
          <div style="font-size:11px;color:var(--mt)">${row.m.classYear}${row.rank?' · Rank #'+row.rank:''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span class="gpa-badge ${gpaColor(row.cum)}" style="font-size:13px">${row.cum!==null?row.cum.toFixed(2):'N/A'}</span>
        <span style="font-size:10px;color:var(--mt)">Cumulative</span>
        <span class="gpa-badge ${gpaColor(row.pri)}" style="font-size:11px;margin-left:auto">${row.pri!==null?row.pri.toFixed(2):'N/A'}</span>
        <span style="font-size:10px;color:var(--mt)">Last Sem.</span>
      </div>
      <div>${gpaTrend(statusGpa)}</div>
    </div>`;
  }).join('') || `<div style="color:var(--ht);font-size:12px;padding:20px;text-align:center">No GPA data yet.</div>`;

  // Top 5 by cumulative GPA
  const top=ranked.slice(0,5);
  document.getElementById('ac-top').innerHTML=top.length?top.map((x,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr)">
      <div class="ac-rank ac-rank-${i+1}">${i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500">${x.m.name}</div>
        <div style="font-size:10px;color:var(--mt)">${x.m.classYear}</div>
      </div>
      <div style="text-align:right">
        ${x.cum!==null?`<span class="gpa-badge gpa-high" style="display:block;margin-bottom:2px">${x.cum.toFixed(2)} cum</span>`:''}
        ${x.pri!==null?`<span class="gpa-badge gpa-good" style="display:block">${x.pri.toFixed(2)} last sem</span>`:''}
      </div>
    </div>`).join(''):'<div style="color:var(--ht);font-size:12px;padding:8px 0;text-align:center">No GPAs entered yet</div>';

  // Warnings panel
  const warnEl=document.getElementById('ac-warn');
  const warnEmpty=document.getElementById('ac-warn-empty');
  if(warnMembers.length){
    warnEmpty.style.display='none';
    warnEl.innerHTML=warnMembers.sort((a,b)=>{
      const ag=a.cum??a.pri??4;const bg=b.cum??b.pri??4;return ag-bg;
    }).map(x=>`
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr)">
        <div class="sh-av" style="width:24px;height:24px;font-size:8.5px;background:var(--rd);color:#fff">${x.m.initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500">${x.m.name}</div>
          <div style="font-size:10px;color:var(--mt)">${x.m.classYear}</div>
        </div>
        <div style="text-align:right;display:flex;flex-direction:column;gap:2px">
          ${x.cum!==null?`<span class="gpa-badge gpa-risk" style="font-size:9px">${x.cum.toFixed(2)} cum</span>`:''}
          ${x.pri!==null?`<span class="gpa-badge ${gpaColor(x.pri)}" style="font-size:9px">${x.pri.toFixed(2)} last sem</span>`:''}
        </div>
      </div>`).join('');
  } else {
    warnEmpty.style.display='block';
    warnEmpty.innerHTML=es('ti-circle-check','green','All in good standing','No members below the 2.75 GPA threshold.','');
    warnEl.innerHTML='';
  }

  // Distribution (based on semester GPA; fallback to cumulative)
  const distGpas=withAny.map(x=>x.cum??x.pri??null).filter(g=>g!==null);
  const buckets=[
    {label:"3.50 – 4.00 (Dean's List)",min:3.5,max:4.01,color:'var(--gn)'},
    {label:'3.00 – 3.49 (Good Standing)',min:3.0,max:3.5,color:'var(--bl)'},
    {label:'2.75 – 2.99 (Watch)',min:2.75,max:3.0,color:'var(--am)'},
    {label:'Below 2.75 (Warning)',min:0,max:2.75,color:'var(--rd)'},
  ];
  document.getElementById('ac-dist').innerHTML=buckets.map(b=>{
    const n=distGpas.filter(g=>g>=b.min&&g<b.max).length;
    const pct=distGpas.length?Math.round(n/distGpas.length*100):0;
    return`<div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
        <span style="color:var(--mt)">${b.label}</span><span style="font-weight:500">${n}</span>
      </div>
      <div class="pb"><div class="pf" style="width:${pct}%;background:${b.color}"></div></div>
    </div>`;
  }).join('');

  // History table
  const histEl=document.getElementById('ac-history');
  const histEmpty=document.getElementById('ac-history-empty');
  if(hist.length){
    histEmpty.style.display='none';
    histEl.innerHTML=`<div class="tw"><table class="tbl">
      <thead><tr>
        <th>Semester</th>
        <th style="text-align:center">Chapter GPA<br><span style="font-weight:400;font-size:9px;color:var(--ht)">(last sem avg)</span></th>
        <th style="text-align:center">Cumulative Avg</th>
        <th>Members</th><th>Updated</th><th>vs Prior</th>
      </tr></thead>
      <tbody>${hist.map((h,i)=>{
        const prior=hist[i+1];
        let delta='';
        if(prior){const d=(parseFloat(h.chapterGpa)-parseFloat(prior.chapterGpa));delta=`<span style="color:${d>=0?'var(--gn)':'var(--rd)'}">${d>=0?'↑':'↓'}${Math.abs(d).toFixed(3)}</span>`;}
        return`<tr>
          <td style="font-weight:500">${h.semester}</td>
          <td style="text-align:center"><span class="gpa-badge ${gpaColor(h.chapterGpa)}">${parseFloat(h.chapterGpa).toFixed(2)}</span></td>
          <td style="text-align:center">${h.cumulativeChapterGpa?`<span class="gpa-badge ${gpaColor(h.cumulativeChapterGpa)}">${parseFloat(h.cumulativeChapterGpa).toFixed(2)}</span>`:'<span style="color:var(--ht)">N/A</span>'}</td>
          <td style="color:var(--mt)">${h.memberCount}</td>
          <td style="color:var(--ht)">${fds(h.date)}</td>
          <td>${delta||'<span style="color:var(--ht)">N/A</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } else {
    histEmpty.style.display='block';
    histEmpty.innerHTML=es('ti-chart-line','blue','No GPA history yet','Use "Update GPAs" each semester to build a historical record of chapter academic performance.','');
    histEl.innerHTML='';
  }

  renderGradeChecks();
}

// ── GRADE CHECKS ──

const GC_NM_TARGET = 2.67;

function gcWeekStart(dateStr){
  const d=new Date(dateStr+'T12:00:00');
  const diff=d.getDay()===0?6:d.getDay()-1;
  const mon=new Date(d);mon.setDate(d.getDate()-diff);
  return localDateStr(mon);
}

function gcLastCheckin(checkins){
  if(!checkins||!checkins.length)return null;
  return checkins.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
}

function gcDaysSince(dateStr){
  if(!dateStr)return null;
  return Math.floor((new Date(localDateStr()+'T12:00:00')-new Date(dateStr+'T12:00:00'))/86400000);
}

function renderGradeChecks(){
  if(!D.academics.gradeChecks)D.academics.gradeChecks=[];
  if(!D.academics.nmCheckins)D.academics.nmCheckins={};
  const el=document.getElementById('ac-grade-checks');
  if(!el)return;

  // New Member Grade Checks (the weekly nmCheckins table) moved to the New Member Education
  // page — nmeRenderGradeChecks() in js/newmembereducation.js — since it's new-member-specific.
  // This pane now only holds Membership Review Referrals, which apply to any member.

  // ── Membership Review Referrals ──
  const refs=[...D.academics.gradeChecks].sort((a,b)=>{
    const aLast=gcLastCheckin(a.checkins||[]);
    const bLast=gcLastCheckin(b.checkins||[]);
    return(aLast?.date||'').localeCompare(bLast?.date||'');
  });

  const refRows=refs.map(r=>{
    const m=mB(r.memberId);
    const displayName=r.memberName||m.name;
    const checkins=r.checkins||[];
    const last=gcLastCheckin(checkins);
    const days=gcDaysSince(last?.date);
    const lastGpa=last?parseFloat(last.gpa):null;
    const target=parseFloat(r.targetGpa)||GC_NM_TARGET;
    const below=lastGpa!==null&&lastGpa<target;
    return`<tr>
      <td style="min-width:140px">
        <div style="display:flex;align-items:center;gap:7px">
          <div class="sh-av" style="width:22px;height:22px;font-size:8px">${m.initials}</div>
          <div><div style="font-weight:500;font-size:12px">${esc(displayName)}</div>
          <div style="font-size:10px;color:var(--mt);max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(r.reason||'')}">${esc(r.reason||'N/A')}</div></div>
        </div>
      </td>
      <td style="text-align:center">${lastGpa!==null?`<span class="gpa-badge ${gpaColor(lastGpa)}">${lastGpa.toFixed(2)}</span>`:'<span style="color:var(--ht)">N/A</span>'}</td>
      <td style="text-align:center"><span style="font-size:11px;font-weight:600;color:var(--navy)">${target.toFixed(2)}</span></td>
      <td style="text-align:center;font-size:12px;font-weight:600;color:${below?'var(--rd)':'var(--gn)'}">${lastGpa!==null?(below?'↓ Below':'✓ Met'):'N/A'}</td>
      <td style="font-size:11px"><div style="color:var(--mt)">${last?fds(last.date):'Never'}</div>${days!==null?`<div style="font-size:10px;color:${days>14?'var(--rd)':'var(--ht)'}">${days}d ago</div>`:''}</td>
      <td style="font-size:10.5px;color:var(--mt)">${r.freq||'Weekly'}</td>
      <td style="white-space:nowrap">
        ${acCanAccess()?`<button class="btn btn-p" style="height:23px;font-size:10px;padding:0 8px;margin-right:3px" onclick="openLogCheckin('${r.memberId}','mr','${r.id}')"><i class="ti ti-check"></i>Log</button>`:''}
        <button class="btn" style="height:23px;font-size:10px;padding:0 7px;margin-right:3px" onclick="openCheckinHistory('${r.memberId}','mr','${r.id}')" title="View history" aria-label="View check-in history for ${esc(displayName)}"><i class="ti ti-history"></i></button>
        ${acCanAccess()?`<button class="btn" style="height:23px;font-size:10px;padding:0 7px;margin-right:3px" onclick="openAddGradeCheck('${r.id}')" aria-label="Edit"><i class="ti ti-pencil"></i></button>
        <button class="btn btn-d" style="height:23px;font-size:10px;padding:0 7px" onclick="deleteGradeCheck('${r.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`:''}
      </td>
    </tr>`;
  }).join('');

  el.innerHTML=`
    <div class="card">
      <div class="card-hd">
        <div>
          <div class="card-t">Membership Review Referrals</div>
          <div style="font-size:11px;color:var(--mt);margin-top:1px">Standards Board referrals · End-goal GPA target · Sorted by least recent check-in</div>
        </div>
        <button class="btn btn-p" style="height:26px;font-size:11px" onclick="openAddGradeCheck()"><i class="ti ti-plus"></i>Add Referral</button>
      </div>
      ${refs.length
        ?`<div class="tw"><table class="tbl"><thead><tr>
            <th>Member</th><th style="text-align:center">Latest GPA</th><th style="text-align:center">End Goal</th>
            <th style="text-align:center">Progress</th><th>Last Check-In</th><th>Frequency</th><th></th>
          </tr></thead><tbody>${refRows}</tbody></table></div>`
        :`<div style="color:var(--ht);font-size:11.5px;padding:16px 0;text-align:center">No referrals on file. Add one when a member is sent by the Standards Board or membership review.</div>`}
    </div>`;
}

function openAddGradeCheck(id){
  if(!D.academics.gradeChecks)D.academics.gradeChecks=[];
  const sel=document.getElementById('gc-member');
  sel.innerHTML=sortedMembers().map(m=>`<option value="${m.id}">${esc(m.name)}, ${m.classYear}</option>`).join('');
  const today=localDateStr();
  const titleEl=document.getElementById('m-addgradecheck').querySelector('.md-t');
  if(id){
    const c=D.academics.gradeChecks.find(x=>x.id===id);
    if(!c)return;
    document.getElementById('gc-id').value=id;
    sel.value=c.memberId;
    document.getElementById('gc-reason').value=c.reason||'';
    document.getElementById('gc-start').value=c.startDate||today;
    document.getElementById('gc-target').value=c.targetGpa||'';
    document.getElementById('gc-freq').value=c.freq||'weekly';
    document.getElementById('gc-notes').value=c.notes||'';
    titleEl.childNodes[0].textContent='Edit Referral';
  } else {
    document.getElementById('gc-id').value='';
    document.getElementById('gc-reason').value='';
    document.getElementById('gc-start').value=today;
    document.getElementById('gc-target').value='';
    document.getElementById('gc-freq').value='weekly';
    document.getElementById('gc-notes').value='';
    titleEl.childNodes[0].textContent='Add Referral';
  }
  openM('m-addgradecheck');
}

function saveGradeCheck(){
  if(!acCanAccess()){toast('Only officers with Academics access can do this.','error');return;}
  if(!D.academics.gradeChecks)D.academics.gradeChecks=[];
  const memberId=document.getElementById('gc-member').value;
  const reason=document.getElementById('gc-reason').value.trim();
  const targetRaw=document.getElementById('gc-target').value;
  if(!memberId){toast('Please select a member','error');return;}
  if(!reason){toast('Reason is required','error');return;}
  if(!targetRaw){toast('Target GPA is required','error');return;}
  const data={
    // memberName snapshot — same reason judicial cases now snapshot it (js/judicial.js
    // addCase()): this referral isn't in deleteMember()'s cascade cleanup, so without a
    // snapshot a deleted member's referral would show "Unknown" forever.
    memberId,memberName:mB(memberId).name,reason,
    startDate:document.getElementById('gc-start').value,
    targetGpa:parseFloat(targetRaw).toFixed(2),
    freq:document.getElementById('gc-freq').value,
    notes:document.getElementById('gc-notes').value.trim(),
  };
  const editId=document.getElementById('gc-id').value;
  if(editId){
    const idx=D.academics.gradeChecks.findIndex(x=>x.id===editId);
    if(idx>=0)D.academics.gradeChecks[idx]={...D.academics.gradeChecks[idx],...data};
  } else {
    D.academics.gradeChecks.push({id:uid(),...data,checkins:[],createdAt:localDateStr()});
  }
  saveD('academics');
  closeM(null,document.getElementById('m-addgradecheck'));
  renderGradeChecks();
  toast(editId?'Referral updated':'Referral added','success');
}

function openLogCheckin(memberId, type, refId){
  const m=mB(memberId);
  document.getElementById('ci-type').value=type;
  document.getElementById('ci-memberid').value=memberId;
  document.getElementById('ci-refid').value=refId||'';
  document.getElementById('ci-av').textContent=m.initials;
  document.getElementById('ci-name').textContent=m.name;
  let targetLabel='Minimum GPA: '+GC_NM_TARGET.toFixed(2);
  if(type==='mr'&&refId){
    const r=D.academics.gradeChecks.find(x=>x.id===refId);
    if(r)targetLabel='Target GPA: '+parseFloat(r.targetGpa).toFixed(2)+(r.reason?' · '+r.reason:'');
  }
  document.getElementById('ci-target-label').textContent=targetLabel;
  document.getElementById('ci-gpa').value='';
  document.getElementById('ci-notes').value='';
  document.getElementById('ci-date').value=localDateStr();
  openM('m-logcheckin');
}

function saveCheckin(){
  const type=document.getElementById('ci-type').value;
  // New Member Grade Checks now live on the New Member Education page, so its officers
  // (canEditNewMemberEducation) can log those check-ins too, not just Academics officers —
  // Membership Review Referral check-ins ('mr') stay Academics-only since referrals aren't
  // new-member-exclusive.
  const allowed=type==='nm'?(acCanAccess()||canEditNewMemberEducation()):acCanAccess();
  if(!allowed){toast('You do not have permission to do this.','error');return;}
  const memberId=document.getElementById('ci-memberid').value;
  const refId=document.getElementById('ci-refid').value;
  const gpaRaw=document.getElementById('ci-gpa').value;
  if(!gpaRaw){toast('Current GPA is required','error');return;}
  const gpa=parseFloat(gpaRaw);
  if(isNaN(gpa)||gpa<0||gpa>4){toast('GPA must be between 0.00 and 4.00','error');return;}
  const entry={id:uid(),date:document.getElementById('ci-date').value,gpa:gpa.toFixed(2),notes:document.getElementById('ci-notes').value.trim()};
  if(type==='nm'){
    if(!D.academics.nmCheckins)D.academics.nmCheckins={};
    if(!D.academics.nmCheckins[memberId])D.academics.nmCheckins[memberId]=[];
    D.academics.nmCheckins[memberId].push(entry);
  } else {
    const r=D.academics.gradeChecks.find(x=>x.id===refId);
    if(!r){toast('Referral not found','error');return;}
    if(!r.checkins)r.checkins=[];
    r.checkins.push(entry);
  }
  saveD('academics');
  closeM(null,document.getElementById('m-logcheckin'));
  renderGradeChecks();
  if(type==='nm'&&typeof nmeRenderGradeChecks==='function')nmeRenderGradeChecks();
  const m=mB(memberId);
  const target=type==='nm'?GC_NM_TARGET:parseFloat((D.academics.gradeChecks.find(x=>x.id===refId)||{}).targetGpa||GC_NM_TARGET);
  toast(m.name.split(' ')[0]+' checked in · GPA: '+gpa.toFixed(2)+' '+(gpa>=target?'✓ Goal met':'↓ Below goal'),'success',4000);
}

function openCheckinHistory(memberId, type, refId){
  const m=mB(memberId);
  let checkins=[];
  let targetLabel='Minimum: '+GC_NM_TARGET.toFixed(2)+' GPA';
  if(type==='nm'){
    checkins=(D.academics.nmCheckins||{})[memberId]||[];
    targetLabel='New Member · Minimum '+GC_NM_TARGET.toFixed(2)+' GPA · Weekly';
  } else {
    const r=D.academics.gradeChecks.find(x=>x.id===refId);
    if(r){checkins=r.checkins||[];targetLabel='Target: '+parseFloat(r.targetGpa).toFixed(2)+' GPA · '+(r.freq||'Weekly')+(r.reason?' · '+r.reason:'');}
  }
  const sorted=[...checkins].sort((a,b)=>b.date.localeCompare(a.date));
  const canEdit=type==='nm'?(acCanAccess()||canEditNewMemberEducation()):acCanAccess();
  const target=type==='nm'?GC_NM_TARGET:parseFloat((D.academics.gradeChecks.find(x=>x.id===refId)||{}).targetGpa||GC_NM_TARGET);
  document.getElementById('cih-name').textContent=m.name;
  document.getElementById('cih-target').textContent=targetLabel;
  document.getElementById('cih-list').innerHTML=sorted.length
    ?sorted.map((c,i)=>{
      const g=parseFloat(c.gpa);
      const prev=sorted[i+1]?parseFloat(sorted[i+1].gpa):null;
      const delta=prev!==null?g-prev:null;
      return`<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--bdr)">
        <div style="flex-shrink:0;text-align:center;min-width:48px">
          <div style="font-size:10px;font-weight:600;color:var(--mt)">${fds(c.date)}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="gpa-badge ${gpaColor(c.gpa)}">${g.toFixed(2)}</span>
            ${delta!==null?`<span style="font-size:10.5px;font-weight:600;color:${delta>=0?'var(--gn)':'var(--rd)'}"><i class="ti ti-arrow-${delta>=0?'up':'down'}" style="font-size:10px"></i>${Math.abs(delta).toFixed(2)}</span>`:''}
            <span style="font-size:10px;font-weight:600;color:${g>=target?'var(--gn)':'var(--rd)'}">${g>=target?'<i class="ti ti-check" style="font-size:10px"></i> Met target':'<i class="ti ti-arrow-down" style="font-size:10px"></i> Below target'}</span>
          </div>
          ${c.notes?`<div style="font-size:11px;color:var(--mt);margin-top:4px">${esc(c.notes)}</div>`:''}
        </div>
        ${canEdit?`<button class="btn btn-d" style="height:20px;font-size:10px;padding:0 6px;flex-shrink:0" onclick="deleteCheckin('${memberId}','${type}','${refId||''}','${c.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`:''}
      </div>`;
    }).join('')
    :`<div style="color:var(--ht);font-size:11.5px;padding:20px 0;text-align:center">No check-ins logged yet.</div>`;
  openM('m-checkin-history');
}

async function deleteCheckin(memberId, type, refId, checkinId){
  const allowed=type==='nm'?(acCanAccess()||canEditNewMemberEducation()):acCanAccess();
  if(!allowed){toast('You do not have permission to do this.','error');return;}
  let removed, removedIdx;
  if(type==='nm'){
    if(!D.academics.nmCheckins||!D.academics.nmCheckins[memberId])return;
    removedIdx=D.academics.nmCheckins[memberId].findIndex(c=>c.id===checkinId);
    removed=D.academics.nmCheckins[memberId][removedIdx];
    D.academics.nmCheckins[memberId]=D.academics.nmCheckins[memberId].filter(c=>c.id!==checkinId);
  } else {
    const r=D.academics.gradeChecks.find(x=>x.id===refId);
    if(!r||!r.checkins)return;
    removedIdx=r.checkins.findIndex(c=>c.id===checkinId);
    removed=r.checkins[removedIdx];
    r.checkins=r.checkins.filter(c=>c.id!==checkinId);
  }
  try{
    await saveD('academics');
    openCheckinHistory(memberId, type, refId);
    renderGradeChecks();
    if(type==='nm'&&typeof nmeRenderGradeChecks==='function')nmeRenderGradeChecks();
    toast('Check-in removed','info');
  }catch(e){
    if(removed){
      if(type==='nm')D.academics.nmCheckins[memberId].splice(removedIdx,0,removed);
      else D.academics.gradeChecks.find(x=>x.id===refId)?.checkins.splice(removedIdx,0,removed);
    }
    toast('Failed to remove check-in. Please try again.','error');
  }
}

async function deleteGradeCheck(id){
  if(!acCanAccess()){toast('You do not have permission to do this.','error');return;}
  const ok=await confirmDialog('Delete Referral','Remove this membership review referral and all its check-in history?');
  if(!ok)return;
  const removed=D.academics.gradeChecks.find(x=>x.id===id);
  D.academics.gradeChecks=D.academics.gradeChecks.filter(x=>x.id!==id);
  try{
    await saveD('academics');
    renderGradeChecks();
    toast('Referral removed','info');
  }catch(e){
    if(removed)D.academics.gradeChecks.push(removed);
    toast('Failed to remove referral. Please try again.','error');
  }
}


// Redraw line chart on window resize
window.addEventListener('resize',()=>{
  if(document.getElementById('page-analytics')?.classList.contains('active')){
    anDrawLine();
  }
});


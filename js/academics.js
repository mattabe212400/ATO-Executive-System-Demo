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
  filterGpaModal();
  openM('m-updategpa');
}

function gpaVal(id,field){
  const rec=D.academics.gpas[id]||{};
  return rec[field]||'';
}

// A member marked "studied abroad last semester" — their last-semester GPA isn't representative,
// so it's shown as "Abroad" rather than a number and they're left out of academic-warning
// flagging. Their cumulative GPA still counts toward rankings and standing.
function gpaToggleAbroadRow(id){
  const chk=document.getElementById('gpa-abroad-'+id);
  const sem=document.getElementById('gpa-semesterGpa-'+id);
  if(chk&&sem){
    sem.disabled=chk.checked;
    sem.style.opacity=chk.checked?'.4':'';
    if(chk.checked)sem.value='';
  }
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
    const rec=D.academics.gpas[m.id]||{};
    const priV=rec.priorGpa||'';
    const isWarn=priV&&parseFloat(priV)<2.75;
    const abroad=!!rec.studyAbroad;
    return`<div style="display:grid;grid-template-columns:1fr 68px 68px 74px;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr);${isWarn?'background:var(--rd-bg);margin:0 -2px;padding:6px 4px;border-radius:5px;':''}">
      <div style="display:flex;align-items:center;gap:8px;min-width:0">
        <div class="sh-av" style="width:24px;height:24px;font-size:8.5px;flex-shrink:0">${esc(m.initials)}</div>
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
          <div style="font-size:10px;color:var(--mt)">${esc(m.classYear)}</div>
        </div>
      </div>
      ${inp(m.id,'priorGpa','Cumulative GPA')}
      ${inp(m.id,'semesterGpa','Last Semester GPA')}
      <label style="display:flex;align-items:center;gap:4px;font-size:9.5px;color:var(--mt);cursor:pointer;justify-self:center" title="Studied abroad last semester — last-semester GPA won't count">
        <input type="checkbox" id="gpa-abroad-${m.id}" ${abroad?'checked':''} onchange="gpaToggleAbroadRow('${m.id}')" style="width:13px;height:13px;accent-color:var(--navy)"> Abroad
      </label>
    </div>`;
  }).join('');
  members.forEach(m=>{ if((D.academics.gpas[m.id]||{}).studyAbroad)gpaToggleAbroadRow(m.id); });
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
    const abroad=!!(document.getElementById('gpa-abroad-'+m.id)||{}).checked;
    const priV=parseGpa((document.getElementById('gpa-priorGpa-'+m.id)||{value:''}).value);
    const semV=parseGpa((document.getElementById('gpa-semesterGpa-'+m.id)||{value:''}).value);
    if(priV==='err'||semV==='err'){toast('Invalid GPA for '+m.name+': must be 0.00–4.00','error');return;}
    const cur=D.academics.gpas[m.id]||{};
    const updated={
      semesterGpa: abroad?'':(semV!==null?semV:(cur.semesterGpa||'')),
      priorGpa: priV!==null?priV:(cur.priorGpa||''),
    };
    if(abroad)updated.studyAbroad=true;
    if(JSON.stringify(cur)!==JSON.stringify(updated)){changed++;D.academics.gpas[m.id]=updated;}
  }

  // Chapter GPA History is entered by hand from each semester's official university grade report
  // (History tab) — it is not derived from these per-member numbers.

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
  acEnsureHistory();
  // Restore to active tab (or default to overview on first load)
  document.querySelectorAll('.ac-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===AC_ACTIVE_TAB));
  document.querySelectorAll('#ac-content div[id^="ac-pane-"]').forEach(d=>{d.style.display=d.id===AC_ACTIVE_TAB?'block':'none';});

  // Build member GPA objects. NOTE: the stored field is still keyed `priorGpa` for backward
  // compatibility, but it now holds each member's CUMULATIVE GPA — that's the single number the
  // chapter enters, ranks by, and shows on the roster.
  function getMemberGpas(m){
    const rec=D.academics.gpas[m.id]||{};
    const pri=rec.priorGpa&&rec.priorGpa!==''?parseFloat(rec.priorGpa):null;      // cumulative
    const sem=rec.semesterGpa&&rec.semesterGpa!==''?parseFloat(rec.semesterGpa):null; // last semester
    return{m,pri,sem,abroad:!!rec.studyAbroad,hasAny:pri!==null};
  }
  const allMemberGpas=sortedMembers().map(getMemberGpas);
  const withAny=allMemberGpas.filter(x=>x.hasAny);

  // Chapter GPA = the latest official semester report entered on the History tab (not computed).
  const latestHist=acSortedHistory()[0]||null;
  const chapterGpaDisplay=latestHist?parseFloat(latestHist.chapterGpa).toFixed(2):null;

  const deansList=withAny.filter(x=>x.pri>=3.5).length;
  const goodStand=withAny.filter(x=>x.pri>=3.0&&x.pri<3.5).length;
  const warnMembers=withAny.filter(x=>x.pri<2.75);

  // KPIs
  document.getElementById('ac-kpi').innerHTML=
    statStrip('Chapter GPA',chapterGpaDisplay||'N/A',latestHist?'Official report · '+latestHist.semester:'Add a report in the History tab','neutral')+
    statStrip("Dean's List",deansList,'Cumulative GPA 3.50+','neutral')+
    statStrip('Good Standing',goodStand,'Cumulative GPA 3.00 – 3.49','neutral')+
    statStrip('Academic Warnings',warnMembers.length,'Cumulative GPA below 2.75',warnMembers.length>0?'down':'neutral');

  // Sort by GPA descending for ranking
  const ranked=[...withAny].sort((a,b)=>b.pri-a.pri);
  const noGpa=allMemberGpas.filter(x=>!x.hasAny);

  // Main table
  document.getElementById('ac-table').innerHTML=`<thead><tr>
    <th>#</th><th>Member</th><th>Class</th>
    <th style="text-align:center">Cumulative GPA</th>
    <th style="text-align:center">Last Sem.</th>
    <th>Status</th>
  </tr></thead><tbody>${[
    ...ranked.map((x,i)=>({...x,rank:i+1})),
    ...noGpa.map(x=>({...x,rank:null}))
  ].map(row=>{
    return`<tr data-name="${row.m.name}" data-class="${row.m.classYear}">
      <td style="color:var(--ht);font-size:11px">${row.rank||'N/A'}</td>
      <td><div style="display:flex;align-items:center;gap:7px">
        <div class="sh-av" style="width:24px;height:24px;font-size:8.5px">${row.m.initials}</div>
        <span style="font-weight:500">${row.m.name}</span>
      </div></td>
      <td style="color:var(--mt)">${row.m.classYear}</td>
      <td style="text-align:center"><span class="gpa-badge ${gpaColor(row.pri)}">${row.pri!==null?row.pri.toFixed(2):'N/A'}</span></td>
      <td style="text-align:center">${row.abroad?'<span class="badge bb2" style="font-size:9px">Abroad</span>':`<span class="gpa-badge ${gpaColor(row.sem)}">${row.sem!==null?row.sem.toFixed(2):'N/A'}</span>`}</td>
      <td>${gpaTrend(row.pri)}</td>
    </tr>`;
  }).join('')}</tbody>`;
  document.getElementById('ac-mobile-cards').innerHTML=[
    ...ranked.map((x,i)=>({...x,rank:i+1})),
    ...noGpa.map(x=>({...x,rank:null}))
  ].map(row=>{
    return`<div class="mob-card card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="sh-av" style="width:38px;height:38px;font-size:13px;flex-shrink:0">${row.m.initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${row.m.name}</div>
          <div style="font-size:11px;color:var(--mt)">${row.m.classYear}${row.rank?' · Rank #'+row.rank:''}</div>
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-bottom:6px">
        <div><span class="gpa-badge ${gpaColor(row.pri)}" style="font-size:13px">${row.pri!==null?row.pri.toFixed(2):'N/A'}</span><div style="font-size:10px;color:var(--mt);margin-top:2px">Cumulative</div></div>
        <div>${row.abroad?'<span class="badge bb2" style="font-size:11px">Abroad</span>':`<span class="gpa-badge ${gpaColor(row.sem)}" style="font-size:13px">${row.sem!==null?row.sem.toFixed(2):'N/A'}</span>`}<div style="font-size:10px;color:var(--mt);margin-top:2px">Last Sem.</div></div>
      </div>
      <div>${gpaTrend(row.pri)}</div>
    </div>`;
  }).join('') || `<div style="color:var(--ht);font-size:12px;padding:20px;text-align:center">No GPA data yet.</div>`;

  // Top 5 by GPA
  const top=ranked.slice(0,5);
  document.getElementById('ac-top').innerHTML=top.length?top.map((x,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr)">
      <div class="ac-rank ac-rank-${i+1}">${i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500">${x.m.name}</div>
        <div style="font-size:10px;color:var(--mt)">${x.m.classYear}</div>
      </div>
      <div style="text-align:right">
        <span class="gpa-badge gpa-high">${x.pri.toFixed(2)}</span>
      </div>
    </div>`).join(''):'<div style="color:var(--ht);font-size:12px;padding:8px 0;text-align:center">No GPAs entered yet</div>';

  // Warnings panel
  const warnEl=document.getElementById('ac-warn');
  const warnEmpty=document.getElementById('ac-warn-empty');
  if(warnMembers.length){
    warnEmpty.style.display='none';
    warnEl.innerHTML=warnMembers.sort((a,b)=>a.pri-b.pri).map(x=>`
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr)">
        <div class="sh-av" style="width:24px;height:24px;font-size:8.5px;background:var(--rd);color:#fff">${x.m.initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500">${x.m.name}</div>
          <div style="font-size:10px;color:var(--mt)">${x.m.classYear}</div>
        </div>
        <span class="gpa-badge gpa-risk" style="font-size:9px">${x.pri.toFixed(2)}</span>
      </div>`).join('');
  } else {
    warnEmpty.style.display='block';
    warnEmpty.innerHTML=es('ti-circle-check','green','All in good standing','No members below the 2.75 cumulative GPA threshold.','');
    warnEl.innerHTML='';
  }

  // Distribution
  const distGpas=withAny.map(x=>x.pri).filter(g=>g!==null);
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

  // History table — hand-entered official chapter GPA from each semester's university grade report
  const histEl=document.getElementById('ac-history');
  const histEmpty=document.getElementById('ac-history-empty');
  const canEditAc=acCanAccess();
  const histAddBtn=document.getElementById('ac-history-add-btn');
  if(histAddBtn)histAddBtn.style.display=canEditAc?'':'none';
  const sortedHist=acSortedHistory();
  if(sortedHist.length){
    histEmpty.style.display='none';
    histEl.innerHTML=`<div class="tw"><table class="tbl">
      <thead><tr>
        <th>Semester</th>
        <th style="text-align:center">Official Chapter GPA</th>
        <th>Notes</th>
        <th>vs Prior</th>
        ${canEditAc?'<th></th>':''}
      </tr></thead>
      <tbody>${sortedHist.map((h,i)=>{
        const prior=sortedHist[i+1];
        let delta='<span style="color:var(--ht)">N/A</span>';
        if(prior&&!isNaN(parseFloat(h.chapterGpa))&&!isNaN(parseFloat(prior.chapterGpa))){
          const d=parseFloat(h.chapterGpa)-parseFloat(prior.chapterGpa);
          delta=`<span style="color:${d>=0?'var(--gn)':'var(--rd)'}">${d>=0?'↑':'↓'}${Math.abs(d).toFixed(2)}</span>`;
        }
        return`<tr>
          <td style="font-weight:500">${esc(h.semester)}</td>
          <td style="text-align:center"><span class="gpa-badge ${gpaColor(h.chapterGpa)}">${parseFloat(h.chapterGpa).toFixed(2)}</span></td>
          <td style="color:var(--mt);font-size:11px">${esc(h.notes||'')||'—'}</td>
          <td>${delta}</td>
          ${canEditAc?`<td style="white-space:nowrap"><button class="btn" style="height:22px;font-size:10px;padding:0 7px;margin-right:3px" onclick="acOpenHistory('${h.id}')" aria-label="Edit ${esc(h.semester)}"><i class="ti ti-pencil"></i></button><button class="btn btn-d" style="height:22px;font-size:10px;padding:0 7px" onclick="acDeleteHistory('${h.id}')" aria-label="Delete ${esc(h.semester)}"><i class="ti ti-trash"></i></button></td>`:''}
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } else {
    histEmpty.style.display='block';
    histEmpty.innerHTML=es('ti-chart-line','blue','No grade reports yet',canEditAc?'Add your chapter\'s official GPA from each semester\'s university grade report.':'Officers will post the official semester GPA reports here.','');
    histEl.innerHTML='';
  }

  renderGradeChecks();
}

// ── CHAPTER GPA HISTORY (manual — one row per semester's official university grade report) ──
function acEnsureHistory(){
  if(!D.academics)D.academics={gpas:{},history:[]};
  if(!D.academics.history)D.academics.history=[];
  D.academics.history.forEach(h=>{ if(h&&!h.id)h.id='h'+uid(); });
}
function acSortedHistory(){
  acEnsureHistory();
  return [...D.academics.history].sort((a,b)=>{
    const ra=semesterDateRange(a.semester), rb=semesterDateRange(b.semester);
    return (rb?rb.start:(b.date||'')).localeCompare(ra?ra.start:(a.date||''));
  });
}
function acOpenHistory(id){
  if(!acCanAccess()){toast('Only officers with Academics edit access can edit GPA history.','error');return;}
  acEnsureHistory();
  const h=id?D.academics.history.find(x=>x.id===id):null;
  document.getElementById('ach-id').value=h?h.id:'';
  document.getElementById('ach-title').textContent=h?'Edit Semester Grade Report':'Add Semester Grade Report';
  document.getElementById('ach-sem').value=h?h.semester:'';
  document.getElementById('ach-gpa').value=h?h.chapterGpa:'';
  document.getElementById('ach-notes').value=h?(h.notes||''):'';
  openM('m-ac-history');
}
function acSaveHistory(){
  if(!acCanAccess()){toast('No permission to edit GPA history.','error');return;}
  acEnsureHistory();
  const id=document.getElementById('ach-id').value;
  const sem=document.getElementById('ach-sem').value.trim();
  const gpa=parseFloat(document.getElementById('ach-gpa').value);
  if(!sem){toast('Semester is required','error');return;}
  if(isNaN(gpa)||gpa<0||gpa>4){toast('Enter an official GPA between 0.00 and 4.00','error');return;}
  const notes=document.getElementById('ach-notes').value.trim();
  const chapterGpa=(Math.round(gpa*100)/100).toString();
  let idx=id?D.academics.history.findIndex(h=>h.id===id):-1;
  if(idx<0&&!id)idx=D.academics.history.findIndex(h=>(h.semester||'').toLowerCase()===sem.toLowerCase());
  if(idx>=0)D.academics.history[idx]={...D.academics.history[idx],semester:sem,chapterGpa,notes,date:localDateStr()};
  else D.academics.history.push({id:'h'+uid(),semester:sem,chapterGpa,notes,date:localDateStr()});
  saveD('academics');
  closeM(null,document.getElementById('m-ac-history'));
  renderAcademics();
  toast('Grade report saved','success');
}
async function acDeleteHistory(id){
  if(!acCanAccess())return;
  const h=(D.academics.history||[]).find(x=>x.id===id);
  const ok=await confirmDialog('Delete grade report',`Delete the ${h?h.semester:'selected'} chapter GPA entry? This can't be undone.`,'Delete',true);
  if(!ok)return;
  D.academics.history=(D.academics.history||[]).filter(x=>x.id!==id);
  saveD('academics');
  renderAcademics();
  toast('Grade report deleted','info');
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
    const hasNotes=!!(r.notes||'').trim();
    return`<tr>
      <td style="min-width:140px">
        <div style="display:flex;align-items:center;gap:7px">
          <div class="sh-av" style="width:22px;height:22px;font-size:8px">${m.initials}</div>
          <div style="min-width:0"><div style="font-weight:500;font-size:12px">${esc(displayName)}</div>
          <div role="button" tabindex="0" onclick="openCheckinHistory('${r.memberId}','mr','${r.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCheckinHistory('${r.memberId}','mr','${r.id}')}" title="View full referral details" style="font-size:10px;color:var(--navy);max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px">${esc(r.reason||'View details')}${hasNotes?' <i class="ti ti-note" style="font-size:9px;color:var(--mt)" title="Has an action plan"></i>':''}</div></div>
        </div>
      </td>
      <td style="text-align:center">${lastGpa!==null?`<span class="gpa-badge ${gpaColor(lastGpa)}">${lastGpa.toFixed(2)}</span>`:'<span style="color:var(--ht)">N/A</span>'}</td>
      <td style="text-align:center"><span style="font-size:11px;font-weight:600;color:var(--navy)">${target.toFixed(2)}</span></td>
      <td style="text-align:center;font-size:12px;font-weight:600;color:${below?'var(--rd)':'var(--gn)'}">${lastGpa!==null?(below?'↓ Below':'✓ Met'):'N/A'}</td>
      <td style="font-size:11px"><div style="color:var(--mt)">${last?fds(last.date):'Never'}</div>${days!==null?`<div style="font-size:10px;color:${days>14?'var(--rd)':'var(--ht)'}">${days}d ago</div>`:''}</td>
      <td style="font-size:10.5px;color:var(--mt)">${r.freq||'Weekly'}</td>
      <td style="white-space:nowrap">
        ${acCanAccess()?`<button class="btn btn-p" style="height:23px;font-size:10px;padding:0 8px;margin-right:3px" onclick="openLogCheckin('${r.memberId}','mr','${r.id}')"><i class="ti ti-check"></i>Log</button>`:''}
        <button class="btn" style="height:23px;font-size:10px;padding:0 7px;margin-right:3px" onclick="openCheckinHistory('${r.memberId}','mr','${r.id}')" title="Referral details & check-in history" aria-label="View referral details and check-in history for ${esc(displayName)}"><i class="ti ti-history"></i></button>
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
          <div style="font-size:11px;color:var(--mt);margin-top:1px">Standards Board referrals · End-goal GPA target · Click a member's reason for the full write-up</div>
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
  let ref=null;
  if(type==='nm'){
    checkins=(D.academics.nmCheckins||{})[memberId]||[];
    targetLabel='New Member · Minimum '+GC_NM_TARGET.toFixed(2)+' GPA · Weekly';
  } else {
    ref=D.academics.gradeChecks.find(x=>x.id===refId);
    if(ref){checkins=ref.checkins||[];targetLabel='End goal '+parseFloat(ref.targetGpa).toFixed(2)+' GPA · '+(ref.freq||'Weekly')+' check-ins'+(ref.startDate?' · since '+fds(ref.startDate):'');}
  }
  const sorted=[...checkins].sort((a,b)=>b.date.localeCompare(a.date));
  const canEdit=type==='nm'?(acCanAccess()||canEditNewMemberEducation()):acCanAccess();
  const target=type==='nm'?GC_NM_TARGET:parseFloat((D.academics.gradeChecks.find(x=>x.id===refId)||{}).targetGpa||GC_NM_TARGET);
  const titleEl=document.getElementById('cih-title');if(titleEl)titleEl.textContent=type==='mr'?'Referral Details & Check-Ins':'Check-In History';
  document.getElementById('cih-name').textContent=m.name;
  document.getElementById('cih-target').textContent=targetLabel;
  // Full referral write-up — the reason line in the table is truncated, so this is where the
  // Standards Board reason and any action plan are actually readable, for editors and non-editors alike.
  const detailEl=document.getElementById('cih-detail');
  if(detailEl){
    if(type==='mr'&&ref&&((ref.reason||'').trim()||(ref.notes||'').trim())){
      detailEl.innerHTML=
        ((ref.reason||'').trim()?`<div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mt);margin-bottom:2px">Reason / referred by</div><div style="white-space:pre-wrap;margin-bottom:${(ref.notes||'').trim()?'9px':'0'}">${esc(ref.reason)}</div>`:'')+
        ((ref.notes||'').trim()?`<div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mt);margin-bottom:2px">Notes / action plan</div><div style="white-space:pre-wrap">${esc(ref.notes)}</div>`:'');
      detailEl.style.display='';
    }else{
      detailEl.style.display='none';
    }
  }
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
  const gc=D.academics.gradeChecks.find(x=>x.id===id);
  const ok=await confirmDialog('Delete Referral',`Remove ${gc?gc.memberName:'this'}'s membership review referral and all its check-in history?`);
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

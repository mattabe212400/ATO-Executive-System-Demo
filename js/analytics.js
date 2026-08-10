// ══════════════════════════════════════════════════
// ANALYTICS — single home for all chapter analytics.
// Powers both the mini "Analytics" tab inside the Attendance page (attRenderAnalytics, below)
// and the full "Chapter Intelligence" page (renderAnalytics, further below). Both pull from
// the same shared calc functions in this file so numbers can never disagree between pages —
// previously this logic was scattered across analytics.js/attendance.js/judicial.js/
// dashboard.js/reports.js with several independently-reimplemented (and disagreeing) formulas.
// ══════════════════════════════════════════════════

// ── SHARED CALCULATIONS (single source of truth) ──

// Replaces 5 independent reimplementations of the same attendance-trend math.
function calcAttendanceTrend(n){
  const tot=D.members.length||1;
  const mandPast=D.events.filter(e=>e.mandatory&&!isUp(e.date)).sort((a,b)=>a.date.localeCompare(b.date));
  if(mandPast.length<2) return [];
  return mandPast.slice(-n).map(ev=>{
    const att=D.attendance[ev.id]||{};
    const pres=Object.values(att).filter(v=>v==='present'||v==='excused').length;
    return {date:ev.date, label:mos(ev.date)+' '+dom(ev.date), title:ev.title, val:Math.round(pres/tot*100)};
  });
}
// Standard tier for a value against the canonical ATT_TARGET/WARN/LOW (85/75/65) thresholds —
// used everywhere a member/officer/chapter attendance number needs a color or label.
function attTier(pct){
  if(pct>=ATT_TARGET) return {label:'Good', color:'var(--gn)', badge:'bg2'};
  if(pct>=ATT_WARN)   return {label:'On Track', color:'var(--navy)', badge:'bb2'};
  if(pct>=ATT_LOW)    return {label:'At Risk', color:'var(--am)', badge:'ba2'};
  return {label:'Warning', color:'var(--rd)', badge:'br2'};
}

// Replaces 3 independent reimplementations (Dashboard officer cards, old Analytics officer
// matrix, Weekly Report's Officer Accountability table) with slightly different thresholds.
function calcOfficerEngagement(memberId){
  const m=D.members.find(x=>x.id===memberId);
  const attendanceRate=aR(memberId);
  const ts=tM(memberId);
  const noteCount=D.notes.filter(n=>n.officerReports&&n.officerReports.some(r=>r.name===m?.name&&r.notes)).length;
  const notePct=Math.min(100,Math.round(noteCount/Math.max(D.notes.length,1)*100));
  const status = ts.rate>=80&&attendanceRate>=ATT_TARGET ? 'on_track'
    : ts.rate>=60||attendanceRate>=ATT_WARN ? 'behind'
    : 'at_risk';
  const statusMeta={on_track:{label:'On Track',badge:'bg2',color:'var(--gn)'},behind:{label:'Behind',badge:'ba2',color:'var(--am)'},at_risk:{label:'At Risk',badge:'br2',color:'var(--rd)'}}[status];
  return {memberId, attendanceRate, taskRate:ts.rate, taskDone:ts.done, taskTotal:ts.total, notePct, status, statusMeta};
}

// First real use of D.finance.payments[]'s dates — confirmed unused for any trend chart before this.
function calcFinanceCollectionRate(){
  const sem=getSemester();
  const dues=typeof finDuesMapForSemester==='function'?finDuesMapForSemester(sem):(D.finance?.dues||{});
  const tot=D.members.length||1;
  const paidCount=D.members.filter(m=>(dues[m.id]?.status||'Partial')==='Paid').length;
  return {rate:Math.round(paidCount/tot*100), paidCount, total:tot};
}
// Current-snapshot recruitment funnel — real and derivable without any change-log, since it's
// just today's stage distribution, not a trend over time (which isn't derivable — see the plan's
// "explicitly not built" list: no stage-change history exists anywhere in the data model).
function calcRecruitmentFunnel(){
  const rushees=D.recruitment?.rushees||[];
  const total=rushees.length;
  const stages=(typeof RC_STAGES!=='undefined'?RC_STAGES:['New Lead','Contacted','Attended Event','Active Rush','Interviewed','Bid Ready','Bid Extended','Accepted']);
  const counts=stages.map((s,i)=>{
    const count=rushees.filter(r=>r.stage===s).length;
    return {stage:s, count, col:(typeof RC_STAGE_COLORS!=='undefined'?RC_STAGE_COLORS[i]:'var(--sky)')};
  });
  // Drop-off: biggest relative decrease between adjacent stages, using cumulative-from-top counts
  // (a rushee in a later stage implicitly passed through earlier ones — this is a real, derivable
  // current-state shape even without any historical stage-change log).
  let dropOff=null, maxDrop=-1;
  for(let i=1;i<counts.length;i++){
    const prevCum=counts.slice(0,i).reduce((s,c)=>s+c.count,0)+counts[i-1].count;
    const cur=counts.slice(i).reduce((s,c)=>s+c.count,0);
    const prevTotal=counts.slice(i-1).reduce((s,c)=>s+c.count,0);
    if(prevTotal>0){
      const dropPct=1-(counts.slice(i).reduce((s,c)=>s+c.count,0)/prevTotal);
      if(dropPct>maxDrop){maxDrop=dropPct;dropOff={from:counts[i-1].stage,to:counts[i].stage,pct:Math.round(dropPct*100)};}
    }
  }
  const accepted=rushees.filter(r=>r.stage==='Accepted').length;
  const bidReadyPlus=rushees.filter(r=>['Bid Ready','Bid Extended','Accepted'].includes(r.stage)).length;
  const conversionRate=total?Math.round(bidReadyPlus/total*100):0;
  const acceptRate=total?Math.round(accepted/total*100):0;
  return {total, counts, dropOff, conversionRate, acceptRate, accepted};
}
// Recruiter performance — a real substitute for "recruitment source performance" (no `source`
// field exists on rushee records; `recruiter` does, so this is what's actually derivable).
function calcRecruiterPerformance(){
  const rushees=D.recruitment?.rushees||[];
  const byRecruiter={};
  rushees.forEach(r=>{
    if(!r.recruiter)return;
    if(!byRecruiter[r.recruiter])byRecruiter[r.recruiter]={total:0,bidReadyPlus:0};
    byRecruiter[r.recruiter].total++;
    if(['Bid Ready','Bid Extended','Accepted'].includes(r.stage))byRecruiter[r.recruiter].bidReadyPlus++;
  });
  return Object.entries(byRecruiter).map(([mid,v])=>({member:mB(mid),...v,rate:v.total?Math.round(v.bidReadyPlus/v.total*100):0})).sort((a,b)=>b.bidReadyPlus-a.bidReadyPlus);
}

// ══════════════════════════════════════════════════
// ATTENDANCE-TAB MINI ANALYTICS (the "Analytics" sub-tab inside the Attendance page).
// Reuses calcAttendanceTrend()/attTier() above so this can never disagree with the full
// Chapter Intelligence page or anything else that shows an attendance number.
// ══════════════════════════════════════════════════
function attRenderAnalytics(){
  attDrawTrend();
  attDrawDonut();
  attDrawEventBars();
  attDrawClassYear();
  attDrawRiskGrid();
}

function attDrawTrend(){
  const svg=document.getElementById('att-line');
  const xaxis=document.getElementById('att-line-xaxis');
  const lbl=document.getElementById('att-trend-lbl');
  if(!svg)return;

  const mandCount=D.events.filter(e=>e.mandatory&&!isUp(e.date)).length;
  if(lbl)lbl.textContent=mandCount+' mandatory events';
  const pts=calcAttendanceTrend(12);

  if(pts.length<2){
    svg.innerHTML=`<text x="50%" y="75" text-anchor="middle" fill="var(--mt)" font-family="Inter,system-ui,sans-serif" font-size="12">Mark attendance for mandatory events to see the trend.</text>`;
    if(xaxis)xaxis.innerHTML='';return;
  }

  const W=svg.parentElement?svg.parentElement.clientWidth||520:520;
  svg.setAttribute('viewBox',`0 0 ${W} 140`);
  const H=140,PAD={t:12,r:20,b:8,l:34};
  const CW=W-PAD.l-PAD.r,CH=H-PAD.t-PAD.b;
  const vals=pts.map(p=>p.val);
  const minV=Math.max(0,Math.min(...vals)-15),maxV=Math.min(100,Math.max(...vals)+15);
  const xS=i=>PAD.l+i*(CW/(pts.length-1));
  const yS=v=>PAD.t+CH-(v-minV)/(maxV-minV||1)*CH;

  let html='';
  [0,25,50,75,100].forEach(g=>{
    if(g<minV-5||g>maxV+5)return;
    const y=yS(g);
    html+=`<line x1="${PAD.l}" y1="${y}" x2="${PAD.l+CW}" y2="${y}" stroke="#E4E7EC" stroke-width="1"/>`;
    html+=`<text x="${PAD.l-5}" y="${y+4}" text-anchor="end" fill="var(--mt)" font-size="9" font-family="Inter,system-ui,sans-serif">${g}%</text>`;
  });
  if(ATT_TARGET>=minV&&ATT_TARGET<=maxV){
    const y=yS(ATT_TARGET);
    html+=`<line x1="${PAD.l}" y1="${y}" x2="${PAD.l+CW}" y2="${y}" stroke="var(--rd)" stroke-width="1.5" stroke-dasharray="5 4" opacity=".5"/>`;
    html+=`<text x="${PAD.l+CW+4}" y="${y+3.5}" fill="var(--rd)" font-size="8.5" font-family="Inter,system-ui,sans-serif" opacity=".8">${ATT_TARGET}%</text>`;
  }
  const areaPath=pts.map((p,i)=>(i===0?`M${xS(i)},${yS(p.val)}`:`L${xS(i)},${yS(p.val)}`)).join(' ')+` L${xS(pts.length-1)},${PAD.t+CH} L${xS(0)},${PAD.t+CH} Z`;
  html+=`<path d="${areaPath}" fill="var(--navy)" opacity=".06"/>`;
  const linePath=pts.map((p,i)=>(i===0?`M${xS(i)},${yS(p.val)}`:`L${xS(i)},${yS(p.val)}`)).join(' ');
  html+=`<path d="${linePath}" fill="none" stroke="var(--navy)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p,i)=>{
    const cx=xS(i),cy=yS(p.val);
    const col=attTier(p.val).color;
    html+=`<circle class="an-line-dot" cx="${cx}" cy="${cy}" r="4" fill="${col}" stroke="var(--surf)" stroke-width="1.5"
      onmouseenter="attLineTooltip(event,${cx},${cy},'${p.label}: ${p.val}%')"
      onmouseleave="document.getElementById('att-line-tooltip').style.display='none'"/>`;
  });

  svg.innerHTML=html;
  if(xaxis){
    const step=Math.ceil(pts.length/6);
    const positions=pts.map((_,i)=>i).filter(i=>i%step===0||i===pts.length-1);
    xaxis.innerHTML=`<div style="display:flex;justify-content:space-between;width:100%;">`+
      positions.map(i=>`<span style="font-size:9px;color:var(--ht);flex:1;text-align:center">${pts[i].label}</span>`).join('')+`</div>`;
  }
}

function attLineTooltip(e,cx,cy,text){
  const t=document.getElementById('att-line-tooltip');
  if(!t)return;
  t.textContent=text;t.style.display='block';
  t.style.left=(cx-t.offsetWidth/2)+'px';
  t.style.top=(cy-32)+'px';
}

function attDrawDonut(){
  const svg=document.getElementById('att-donut');
  const pctEl=document.getElementById('att-donut-pct');
  const legend=document.getElementById('att-donut-legend');
  if(!svg)return;

  const good=D.members.filter(m=>aR(m.id)>=ATT_TARGET).length;
  const onT=D.members.filter(m=>{const r=aR(m.id);return r>=ATT_WARN&&r<ATT_TARGET;}).length;
  const risk=D.members.filter(m=>{const r=aR(m.id);return r>=ATT_LOW&&r<ATT_WARN;}).length;
  const warn=D.members.filter(m=>aR(m.id)<ATT_LOW).length;
  const segs=[
    {label:`Good (${ATT_TARGET}%+)`,n:good,c:'var(--gn)'},
    {label:`On Track (${ATT_WARN}–${ATT_TARGET-1}%)`,n:onT,c:'var(--sky)'},
    {label:`At Risk (${ATT_LOW}–${ATT_WARN-1}%)`,n:risk,c:'var(--am)'},
    {label:`Warning (<${ATT_LOW}%)`,n:warn,c:'var(--rd)'},
  ].filter(s=>s.n>0);

  const tot=D.members.length||1;
  if(pctEl)pctEl.textContent=good+onT>0?Math.round((good+onT)/tot*100)+'%':'—';

  const R=42,CX=55,CY=55,CIRC=2*Math.PI*R,SW=16;
  let offset=0;
  let paths=segs.length===0?`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#F1F3F6" stroke-width="${SW}"/>`:'';
  segs.forEach(s=>{
    const dash=(s.n/tot)*CIRC;
    const off=CIRC-(offset/tot*CIRC);
    paths+=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${s.c}" stroke-width="${SW}"
      stroke-dasharray="${dash} ${CIRC}" stroke-dashoffset="${off}"
      style="transform:rotate(-90deg);transform-origin:${CX}px ${CY}px;transition:stroke-dashoffset .7s ease"/>`;
    offset+=s.n;
  });
  svg.innerHTML=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#F1F3F6" stroke-width="${SW}"/>${paths}`;

  if(legend){
    legend.innerHTML=[{label:`Good (${ATT_TARGET}%+)`,n:good,c:'var(--gn)'},{label:`On Track (${ATT_WARN}–${ATT_TARGET-1}%)`,n:onT,c:'var(--sky)'},{label:`At Risk (${ATT_LOW}–${ATT_WARN-1}%)`,n:risk,c:'var(--am)'},{label:`Warning (<${ATT_LOW}%)`,n:warn,c:'var(--rd)'}]
      .map(s=>`<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
        <div style="width:9px;height:9px;border-radius:50%;background:${s.c};flex-shrink:0"></div>
        <span style="font-size:10.5px;color:var(--mt);flex:1">${s.label}</span>
        <span style="font-size:11px;font-weight:600">${s.n}</span>
      </div>`).join('');
  }
}

function attDrawEventBars(){
  const el=document.getElementById('att-events-chart');if(!el)return;
  const mandPast=D.events.filter(e=>e.mandatory&&!isUp(e.date)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  if(!mandPast.length){
    el.innerHTML=`<div style="padding:24px;text-align:center;color:var(--ht);font-size:12px">No past mandatory events yet.</div>`;return;
  }
  const tot=D.members.length||1;
  el.innerHTML=mandPast.map(ev=>{
    const att=D.attendance[ev.id]||{};
    const pres=Object.values(att).filter(v=>v==='present'||v==='excused').length;
    const pct=Math.round(pres/tot*100);
    const col=attTier(pct).color;
    return`<div class="att-ev-bar">
      <span class="att-ev-label" title="${esc(ev.title)} · ${fd(ev.date)}">${esc(ev.title)}</span>
      <div class="att-ev-track"><div class="att-ev-fill" style="background:${col}" data-w="${pct}"></div></div>
      <span class="att-ev-pct" style="color:${col}">${pct}%</span>
    </div>`;
  }).join('');
  setTimeout(()=>el.querySelectorAll('[data-w]').forEach(b=>{b.style.transform='scaleX('+(b.dataset.w/100)+')';}),80);
}

function attDrawClassYear(){
  const el=document.getElementById('att-class-chart');if(!el)return;
  const years=[...new Set(D.members.map(m=>m.classYear))].sort();
  if(!years.length){el.innerHTML=`<div style="color:var(--ht);font-size:12px;padding:8px 0;text-align:center">No members yet.</div>`;return;}
  el.innerHTML=years.map(yr=>{
    const mems=D.members.filter(m=>m.classYear===yr);
    const avg=mems.length?Math.round(mems.reduce((s,m)=>s+aR(m.id),0)/mems.length):0;
    const col=attTier(avg).color;
    return`<div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <span style="font-size:12px;font-weight:500">${yr}</span>
        <span style="font-size:11px;color:var(--mt)">${mems.length} member${mems.length!==1?'s':''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:8px;background:#F1F3F6;border-radius:99px;overflow:hidden">
          <div style="height:100%;border-radius:99px;background:${col};width:100%;transform-origin:0 0;transform:scaleX(0);transition:transform .65s ease" data-w="${avg}"></div>
        </div>
        <span style="font-size:11px;font-weight:700;color:${col};width:32px;text-align:right">${avg}%</span>
      </div>
    </div>`;
  }).join('');
  setTimeout(()=>el.querySelectorAll('[data-w]').forEach(b=>{b.style.transform='scaleX('+(b.dataset.w/100)+')';}),80);
}

function attDrawRiskGrid(){
  const el=document.getElementById('att-risk-grid');
  const sumEl=document.getElementById('att-risk-summary');
  if(!el)return;

  const tiers=[
    {label:'Critical',sub:`Below ${ATT_LOW}%`,min:0,max:ATT_LOW,border:'var(--rd)',lc:'var(--rd-tx)',bg:'var(--rd-bg)'},
    {label:'At Risk',sub:`${ATT_LOW}% – ${ATT_WARN}%`,min:ATT_LOW,max:ATT_WARN,border:'var(--am)',lc:'var(--am-tx)',bg:'var(--am-bg)'},
    {label:'Watch',sub:`${ATT_WARN}% – ${ATT_TARGET}%`,min:ATT_WARN,max:ATT_TARGET,border:'var(--bl)',lc:'var(--bl-tx)',bg:'var(--bl-bg)'},
  ];

  const riskCount=D.members.filter(m=>aR(m.id)<ATT_TARGET).length;
  if(sumEl)sumEl.textContent=riskCount>0?`${riskCount} member${riskCount>1?'s':''} below ${ATT_TARGET}% target`:`All members above ${ATT_TARGET}%`;

  el.innerHTML=tiers.map(t=>{
    const mems=D.members.filter(m=>{const r=aR(m.id);return r>=t.min&&r<t.max;}).sort(mNameCompare);
    return`<div class="att-risk-tier" style="border-color:${t.border}22">
      <div class="att-risk-tier-hd">
        <span class="att-risk-tier-lbl" style="color:${t.lc}">${t.label}</span>
        <span style="font-size:10px;color:var(--mt)">${t.sub}</span>
        <span class="badge" style="background:${t.bg};color:${t.lc};font-size:10px">${mems.length}</span>
      </div>
      ${mems.length?mems.slice(0,8).map(m=>{const r=aR(m.id);return`<div class="att-risk-member">
        <div class="sh-av" style="width:22px;height:22px;font-size:7.5px;background:${t.bg};color:${t.lc};flex-shrink:0">${esc(m.initials)}</div>
        <div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div><div style="font-size:10px;color:var(--ht)">${esc(m.classYear)}</div></div>
        <span style="font-size:11px;font-weight:700;color:${t.lc}">${r}%</span>
      </div>`;}).join('')+(mems.length>8?`<div style="font-size:10.5px;color:var(--mt);text-align:center;padding:5px 0;cursor:pointer" onclick="attTab(document.querySelector('.att-tab:nth-child(2)'),'att-members')">+${mems.length-8} more →</div>`:'')
      :`<div style="padding:14px 0;text-align:center;color:var(--ht);font-size:11.5px">None in this tier</div>`}
    </div>`;
  }).join('');
}


// ── GLOBAL FILTER STATE (Chapter Intelligence page only) ──
let CI_FILTER={ start:localDateStr(new Date(Date.now()-90*86400000)), end:localDateStr(), allTime:false, classYear:'all' };
let CI_ACTIVE_TAB='ci-overview';
function ciInDateRange(dateStr){
  if(CI_FILTER.allTime||!dateStr)return true;
  return dateStr>=CI_FILTER.start && dateStr<=CI_FILTER.end;
}
function ciFilterMembers(){
  return CI_FILTER.classYear==='all' ? D.members : D.members.filter(m=>m.classYear===CI_FILTER.classYear);
}
function ciSetFilter(){
  CI_FILTER.allTime=document.getElementById('ci-f-alltime').checked;
  CI_FILTER.start=document.getElementById('ci-f-start').value||CI_FILTER.start;
  CI_FILTER.end=document.getElementById('ci-f-end').value||CI_FILTER.end;
  CI_FILTER.classYear=document.getElementById('ci-f-class').value;
  ciRenderFilterBar();
  ciRenderActiveTab();
}
function ciResetFilter(){
  CI_FILTER={ start:localDateStr(new Date(Date.now()-90*86400000)), end:localDateStr(), allTime:false, classYear:'all' };
  ciRenderFilterBar();
  ciRenderActiveTab();
}

// ══════════════════════════════════════════════════
// CHAPTER INTELLIGENCE — the main "Analytics & Reporting" nav page.
// (Previously misplaced as renderAnalytics() inside js/judicial.js, calling anDraw* chart
// functions physically defined in js/attendance.js — including one, anDrawHealth, whose entire
// result was computed and then discarded. Consolidated here.)
//
// Structured as category tabs (Overview/Attendance/Academics/Finance/Recruitment/Community
// Service/Social/Accountability) rather than one long scroll — the condensed Health Score that
// used to live here was removed in favor of a single link, since the full Health Scorecard page
// already owns that view and showing both was redundant.
// ══════════════════════════════════════════════════
function renderAnalytics(){
  ciRenderFilterBar();
  ciRenderActiveTab();
}
function ciTab(btn, tabId){
  document.querySelectorAll('#page-analytics > div.ci-panel, #page-analytics > .soc-tab').forEach(()=>{});
  document.querySelectorAll('#page-analytics .soc-tab').forEach(t=>t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('#page-analytics .ci-panel').forEach(p=>{p.style.display = p.id===tabId ? '' : 'none';});
  CI_ACTIVE_TAB=tabId;
  ciRenderActiveTab();
}
function ciRenderActiveTab(){
  if(CI_ACTIVE_TAB==='ci-overview') ciRenderOverview();
  else if(CI_ACTIVE_TAB==='ci-tab-attendance') ciRenderAttendanceTab();
  else if(CI_ACTIVE_TAB==='ci-tab-academics') ciRenderAcademicsTab();
  else if(CI_ACTIVE_TAB==='ci-tab-finance') ciRenderFinanceTab();
  else if(CI_ACTIVE_TAB==='ci-tab-recruitment') ciRenderRecruitmentTab();
  else if(CI_ACTIVE_TAB==='ci-tab-cs') ciRenderCommunityServiceTab();
  else if(CI_ACTIVE_TAB==='ci-tab-social') ciRenderSocialTab();
  else if(CI_ACTIVE_TAB==='ci-tab-accountability') ciRenderAccountabilityTab();
  else if(CI_ACTIVE_TAB==='ci-tab-tasks') ciRenderTasksTab();
}

function ciRenderFilterBar(){
  const startEl=document.getElementById('ci-f-start'), endEl=document.getElementById('ci-f-end'), classEl=document.getElementById('ci-f-class'), atEl=document.getElementById('ci-f-alltime');
  if(startEl && !startEl.value) startEl.value=CI_FILTER.start;
  if(endEl && !endEl.value) endEl.value=CI_FILTER.end;
  if(atEl) atEl.checked=CI_FILTER.allTime;
  if(classEl && !classEl._init){
    const years=[...new Set(D.members.map(m=>m.classYear))].filter(Boolean).sort();
    classEl.innerHTML='<option value="all">All Class Years</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join('');
    classEl._init=true;
  }
  if(classEl) classEl.value=CI_FILTER.classYear;
  const activeEl=document.getElementById('ci-f-active');
  if(activeEl){
    const parts=[];
    if(!CI_FILTER.allTime) parts.push(fds(CI_FILTER.start)+' – '+fds(CI_FILTER.end));
    if(CI_FILTER.classYear!=='all') parts.push(CI_FILTER.classYear);
    activeEl.textContent = parts.length ? 'Active: '+parts.join(' · ') : 'No filters applied';
  }
  const accBtn=document.getElementById('ci-tab-accountability-btn');
  if(accBtn) accBtn.style.display = (typeof jbCanAccess==='function' && jbCanAccess()) ? '' : 'none';
  // Officer Tasks is a full cross-position breakdown (President/VP only) — hidden entirely for
  // everyone else rather than shown-with-a-gate-message, same as Accountability above. Regular
  // officers already have their own position-scoped view on the Tasks & Goals page itself.
  const tasksBtn=document.getElementById('ci-tab-tasks-btn');
  if(tasksBtn) tasksBtn.style.display = isLeadUser() ? '' : 'none';
}

// ── OVERVIEW ──
function ciRenderOverview(){
  ciRenderKpiRow();
  ciRenderHealthLink();
  ciRenderOperationalComparison();
}
function ciRenderKpiRow(){
  const {score}=computeHealthDims();
  const avgAtt=Math.round(D.members.reduce((s,m)=>s+aR(m.id),0)/(D.members.length||1));
  const dn=D.tasks.filter(t=>t.status==='done').length;
  const taskPct=D.tasks.length?Math.round(dn/D.tasks.length*100):null;
  const fin=calcFinanceCollectionRate();
  const rec=calcRecruitmentFunnel();
  const openCases=D.cases.filter(c=>!['resolved','dismissed'].includes(c.status)).length;

  const now=new Date(); const d30=localDateStr(new Date(now-30*86400000)); const d60=localDateStr(new Date(now-60*86400000));
  const recentAtt=calcAttendanceTrend(200).filter(p=>p.date>=d30);
  const priorAtt=calcAttendanceTrend(200).filter(p=>p.date>=d60&&p.date<d30);
  const attTrend = recentAtt.length&&priorAtt.length ? Math.round(recentAtt.reduce((s,p)=>s+p.val,0)/recentAtt.length) - Math.round(priorAtt.reduce((s,p)=>s+p.val,0)/priorAtt.length) : null;
  const recentPay=(D.finance?.payments||[]).filter(p=>p.date>=d30).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  const priorPay=(D.finance?.payments||[]).filter(p=>p.date>=d60&&p.date<d30).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);

  document.getElementById('ci-kpi').innerHTML=
    statStrip('Chapter Health Score',score+'/100',score>=80?'Strong standing':score>=65?'Stable — some gaps':'Needs attention',score>=80?'up':score>=50?'neutral':'down')+
    statStrip('Attendance Rate',avgAtt+'%',attTrend===null?'No 30d comparison yet':(attTrend>=0?'+':'')+attTrend+'pts vs prior 30d',attTrend===null?'neutral':attTrend>=0?'up':'down')+
    statStrip('Task Completion',taskPct===null?'—':taskPct+'%',taskPct===null?'No tasks yet':dn+' of '+D.tasks.length+' done','neutral')+
    statStrip('Financial Collection',fin.rate+'%',recentPay||priorPay?'$'+Math.round(recentPay).toLocaleString()+' collected last 30d ('+(recentPay>=priorPay?'+':'')+Math.round(recentPay-priorPay).toLocaleString()+' vs prior)':fin.paidCount+' / '+fin.total+' paid','neutral')+
    statStrip('Recruitment Conversion',rec.total?rec.conversionRate+'%':'—',rec.total?rec.total+' rushees tracked':'No rushees yet','neutral')+
    statStrip('Open Accountability Cases',openCases,openCases?'Requires attention':'All clear',openCases?'down':'up');
}
function ciRenderHealthLink(){
  const {score,dims}=computeHealthDims();
  const grade=score>=80?'A':score>=65?'B':score>=50?'C':'F';
  const color=score>=80?'var(--gn)':score>=65?'var(--navy)':score>=50?'var(--am)':'var(--rd)';
  const weak=dims.filter(d=>!d.excluded&&d.v<d.target).sort((a,b)=>a.v-b.v).slice(0,2);
  const el=document.getElementById('ci-health-link'); if(!el)return;
  el.innerHTML=`<div style="display:flex;align-items:center;gap:14px">
    <div style="font-size:26px;font-weight:700;color:${color}">${score}<span style="font-size:13px;color:var(--ht);font-weight:500">/100</span></div>
    <div style="flex:1">
      <div style="font-size:12.5px;font-weight:600">Grade ${grade}${weak.length?' — needs attention on '+weak.map(d=>esc(d.k)).join(', '):' — no dimension currently below target'}</div>
      <div style="font-size:10.5px;color:var(--ht)">Full breakdown, trend, and action items on the Health Scorecard page →</div>
    </div>
    <i class="ti ti-arrow-right" style="color:var(--ht)"></i>
  </div>`;
}
function ciRenderOperationalComparison(){
  const {dims}=computeHealthDims();
  const el=document.getElementById('ci-opcompare'); if(!el)return;
  const sorted=[...dims].filter(d=>!d.excluded).sort((a,b)=>b.v-a.v);
  el.innerHTML=sorted.map(d=>`<div class="pr"><span class="pl" style="width:130px">${esc(d.k)}</span><div class="pb"><div class="pf" style="width:${d.v}%;background:${d.color}"></div></div><span class="pv">${d.v}%</span></div>`).join('');
}

// ── ATTENDANCE DEEP DIVE ──
function ciRenderAttendanceTab(){
  const trendEl=document.getElementById('ci-att-trend');
  if(trendEl){
    const pts=calcAttendanceTrend(20).filter(p=>ciInDateRange(p.date));
    trendEl.innerHTML = pts.length>=2 ? ciMiniLineChart(pts) : `<div style="color:var(--ht);font-size:11.5px;padding:10px 0">Not enough mandatory-event history in this range yet.</div>`;
  }
  const cls=CI_FILTER.classYear;
  const members=ciFilterMembers();
  const tot=members.length||1;
  const tiers=[
    {label:'Good (85%+)',min:ATT_TARGET,c:'var(--gn)'},
    {label:'On Track (75–84%)',min:ATT_WARN,max:ATT_TARGET,c:'var(--navy)'},
    {label:'At Risk (65–74%)',min:ATT_LOW,max:ATT_WARN,c:'var(--am)'},
    {label:'Warning (<65%)',min:0,max:ATT_LOW,c:'var(--rd)'},
  ];
  const counts=tiers.map(t=>({...t,n:members.filter(m=>{const r=aR(m.id);return r>=t.min&&(t.max===undefined||r<t.max);}).length}));
  const barsEl=document.getElementById('ci-engagement-tiers');
  if(barsEl) barsEl.innerHTML=counts.map(c=>`<div class="pr"><span class="pl">${c.label}</span><div class="pb"><div class="pf" style="width:${Math.round(c.n/tot*100)}%;background:${c.c}"></div></div><span class="pv">${c.n}</span></div>`).join('');
  const riskEl=document.getElementById('ci-engagement-risk');
  if(riskEl){
    const risk=members.map(m=>({m,r:aR(m.id)})).filter(x=>x.r<ATT_TARGET).sort((a,b)=>mNameCompare(a.m,b.m)).slice(0,8);
    riskEl.innerHTML = risk.length ? risk.map(({m,r})=>{const t=attTier(r);return `<div class="sh-row"><div class="sh-av" style="width:22px;height:22px;font-size:8px">${esc(m.initials)}</div><div style="flex:1;min-width:0;font-size:11.5px">${esc(m.name)}</div><span class="badge ${t.badge}">${r}%</span></div>`;}).join('') : es('ti-circle-check','green','Everyone above target','','');
  }
  const classEl=document.getElementById('ci-engagement-class');
  if(classEl){
    const years=[...new Set(D.members.map(m=>m.classYear))].filter(Boolean).sort();
    classEl.innerHTML=years.map(yr=>{
      const mems=D.members.filter(m=>m.classYear===yr);
      const avg=mems.length?Math.round(mems.reduce((s,m)=>s+aR(m.id),0)/mems.length):0;
      const t=attTier(avg);
      return `<div class="pr"><span class="pl">${esc(yr)} (${mems.length})</span><div class="pb"><div class="pf" style="width:${avg}%;background:${t.color}"></div></div><span class="pv">${avg}%</span></div>`;
    }).join('');
  }
  const tableEl=document.getElementById('ci-att-table');
  if(tableEl){
    tableEl.innerHTML = members.length ? `<thead><tr><th>Member</th><th>Class</th><th>Attendance</th><th>Status</th></tr></thead><tbody>${
      [...members].sort(mNameCompare).map(m=>{const r=aR(m.id);const t=attTier(r);return `<tr><td style="font-weight:500">${esc(m.name)}</td><td>${esc(m.classYear)}</td><td style="color:${t.color};font-weight:600">${r}%</td><td><span class="badge ${t.badge}">${t.label}</span></td></tr>`;}).join('')
    }</tbody>` : `<tbody><tr><td colspan="4" style="text-align:center;color:var(--ht);padding:14px">No members${cls!=='all'?' in '+esc(cls):''}.</td></tr></tbody>`;
  }
}

// ── ACADEMICS DEEP DIVE ──
function ciRenderAcademicsTab(){
  const trendEl=document.getElementById('ci-ac-trend');
  if(trendEl){
    const hist=D.academics?.history||[];
    trendEl.innerHTML = hist.length ? hist.map(h=>`<div class="pr"><span class="pl" style="width:110px">${esc(h.semester)}</span><div class="pb"><div class="pf" style="width:${Math.min(100,parseFloat(h.chapterGpa)/4*100)}%;background:var(--bl)"></div></div><span class="pv">${h.chapterGpa}</span></div>`).join('') : `<div style="color:var(--ht);font-size:11.5px;padding:10px 0">No semester GPA snapshots yet — created when officers save GPAs in Academics.</div>`;
  }
  const members=ciFilterMembers();
  const gpaOf=m=>{const rec=D.academics?.gpas?.[m.id]||{};const v=rec.cumulativeGpa||rec.priorGpa||'';return v?parseFloat(v):null;};
  const distEl=document.getElementById('ci-ac-dist');
  if(distEl){
    const gpas=members.map(gpaOf).filter(g=>g!==null&&!isNaN(g));
    const buckets=[
      {label:"3.50+ (Dean's List)",min:3.5,max:4.01,c:'var(--gn)'},
      {label:'3.00–3.49 (Good)',min:3.0,max:3.5,c:'var(--sky)'},
      {label:'2.75–2.99 (Watch)',min:2.75,max:3.0,c:'var(--am)'},
      {label:'Below 2.75 (Warning)',min:0,max:2.75,c:'var(--rd)'},
    ];
    distEl.innerHTML = gpas.length ? buckets.map(b=>{const n=gpas.filter(g=>g>=b.min&&g<b.max).length;const pct=Math.round(n/gpas.length*100);return `<div class="pr"><span class="pl" style="width:150px">${b.label}</span><div class="pb"><div class="pf" style="width:${pct}%;background:${b.c}"></div></div><span class="pv">${n}</span></div>`;}).join('') : `<div style="color:var(--ht);font-size:11.5px;padding:10px 0">No GPA data yet.</div>`;
  }
  const tableEl=document.getElementById('ci-ac-table');
  if(tableEl){
    const withGpa=[...members].sort(mNameCompare).map(m=>({m,cum:D.academics?.gpas?.[m.id]?.cumulativeGpa||'',sem:D.academics?.gpas?.[m.id]?.semesterGpa||''}));
    tableEl.innerHTML = withGpa.length ? `<thead><tr><th>Member</th><th>Class</th><th>Cumulative GPA</th><th>Semester GPA</th></tr></thead><tbody>${
      withGpa.map(({m,cum,sem})=>`<tr><td style="font-weight:500">${esc(m.name)}</td><td>${esc(m.classYear)}</td><td>${esc(cum)||'—'}</td><td>${esc(sem)||'—'}</td></tr>`).join('')
    }</tbody>` : `<tbody><tr><td colspan="4" style="text-align:center;color:var(--ht);padding:14px">No members in this filter.</td></tr></tbody>`;
  }
}

// ── FINANCE DEEP DIVE ──
function ciRenderFinanceTab(){
  const sem=getSemester();
  const dues=typeof finDuesMapForSemester==='function'?finDuesMapForSemester(sem):(D.finance?.dues||{});
  const budget=typeof finBudgetForSemester==='function'?finBudgetForSemester(sem):(D.finance?.budget||{});
  const fin=calcFinanceCollectionRate();
  const members=ciFilterMembers();
  const owed=members.reduce((s,m)=>{const d=dues[m.id];return s+((d?.semesterDues||0)-(d?.paid||0));},0);
  const kpiEl=document.getElementById('ci-fin-kpi');
  if(kpiEl) kpiEl.innerHTML=
    statStrip('Collection Rate',fin.rate+'%',fin.paidCount+' / '+fin.total+' paid (all members)',fin.rate>=85?'up':fin.rate>=70?'neutral':'down')+
    statStrip('Outstanding Balance','$'+Math.max(0,Math.round(owed)).toLocaleString(),CI_FILTER.classYear==='all'?'Across all members':'Across '+esc(CI_FILTER.classYear),owed>2000?'down':'neutral');
  const budEl=document.getElementById('ci-fin-budget');
  if(budEl && typeof getCatNames==='function'){
    const cats=getCatNames().filter(cat=>{const spent=(D.finance.expenses||[]).filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);return (budget[cat]||0)>0||spent>0;});
    budEl.innerHTML = cats.length ? cats.map(cat=>{
      const spent=(D.finance.expenses||[]).filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);
      const bud=budget[cat]||0; const pct=bud?Math.min(100,Math.round(spent/bud*100)):0;
      return `<div class="pr" style="cursor:pointer" onclick="rbacNav('finance',null)"><span class="pl" style="width:120px">${esc(cat)}</span><div class="pb"><div class="pf" style="width:${pct}%;background:${pct>=90?'var(--rd)':pct>=70?'var(--am)':'var(--gn)'}"></div></div><span class="pv">$${spent}/$${bud}</span></div>`;
    }).join('') : `<div style="color:var(--ht);font-size:11.5px;padding:8px 0">No budget allocated yet.</div>`;
  }
  const trendEl=document.getElementById('ci-fin-trend');
  if(trendEl){
    const payments=(D.finance?.payments||[]).filter(p=>ciInDateRange(p.date));
    const byWeek={};
    payments.forEach(p=>{if(!p.date)return;const d=new Date(p.date+'T12:00:00');const ws=new Date(d);ws.setDate(d.getDate()-d.getDay());const key=localDateStr(ws);byWeek[key]=(byWeek[key]||0)+(parseFloat(p.amount)||0);});
    const wks=Object.keys(byWeek).sort().slice(-10);
    trendEl.innerHTML = wks.length ? ciMiniBarChart(wks.map(w=>({label:mos(w)+' '+dom(w),val:byWeek[w]})),v=>'$'+Math.round(v).toLocaleString()) : `<div style="color:var(--ht);font-size:11.5px;padding:10px 0">No payments in this range.</div>`;
  }
  const tableEl=document.getElementById('ci-fin-table');
  if(tableEl){
    tableEl.innerHTML = members.length ? `<thead><tr><th>Member</th><th>Class</th><th>Owed</th><th>Paid</th><th>Status</th></tr></thead><tbody>${
      [...members].sort(mNameCompare).map(m=>{const d=dues[m.id]||{};const owedM=(d.semesterDues||0)-(d.paid||0);const status=d.status||'Partial';const badgeMap={Paid:'bg2',Partial:'ba2',Overdue:'br2',Unpaid:'br2','Payment Plan':'bb2'};return `<tr><td style="font-weight:500">${esc(m.name)}</td><td>${esc(m.classYear)}</td><td>$${Math.max(0,owedM).toLocaleString()}</td><td>$${(d.paid||0).toLocaleString()}</td><td><span class="badge ${badgeMap[status]||'bm2'}">${esc(status)}</span></td></tr>`;}).join('')
    }</tbody>` : `<tbody><tr><td colspan="5" style="text-align:center;color:var(--ht);padding:14px">No members in this filter.</td></tr></tbody>`;
  }
}

// ── RECRUITMENT DEEP DIVE ──
function ciRenderRecruitmentTab(){
  const f=calcRecruitmentFunnel();
  const kpiEl=document.getElementById('ci-rec-kpi');
  if(kpiEl) kpiEl.innerHTML=
    statStrip('Total Rushees',f.total,'In pipeline','neutral')+
    statStrip('Conversion Rate',f.conversionRate+'%','Bid-ready or further','neutral')+
    statStrip('Accepted',f.accepted,f.total?Math.round(f.acceptRate)+'% of pipeline':'—','up');
  const funnelEl=document.getElementById('ci-rec-funnel');
  if(funnelEl) funnelEl.innerHTML = f.total ? f.counts.map(c=>`<div class="pr" style="cursor:pointer" onclick="rbacNav('recruitment',null)"><span class="pl">${esc(c.stage)}</span><div class="pb"><div class="pf" style="width:${f.total?Math.round(c.count/f.total*100):0}%;background:${c.col}"></div></div><span class="pv">${c.count}</span></div>`).join('') : es('ti-user-plus','blue','No rushees tracked yet','','');
  const recEl=document.getElementById('ci-rec-recruiters');
  if(recEl){
    const perf=calcRecruiterPerformance();
    recEl.innerHTML = perf.length ? perf.map(p=>`<div class="sh-row"><div class="sh-av" style="width:22px;height:22px;font-size:8px">${esc(p.member.initials)}</div><div style="flex:1;min-width:0;font-size:11.5px">${esc(p.member.name)}</div><span style="font-size:11px;color:var(--mt)">${p.bidReadyPlus}/${p.total} (${p.rate}%)</span></div>`).join('') : es('ti-users','blue','No recruiter assignments yet','','');
  }
  const tableEl=document.getElementById('ci-rec-table');
  if(tableEl){
    const rushees=D.recruitment?.rushees||[];
    tableEl.innerHTML = rushees.length ? `<thead><tr><th>Name</th><th>Stage</th><th>Recruiter</th><th>Bid Score</th></tr></thead><tbody>${
      [...rushees].sort((a,b)=>(b.bidScore||0)-(a.bidScore||0)).map(r=>`<tr><td style="font-weight:500">${esc(r.name)}</td><td>${esc(r.stage)}</td><td>${r.recruiter?esc(mB(r.recruiter).name):'—'}</td><td>${r.bidScore??'—'}</td></tr>`).join('')
    }</tbody>` : `<tbody><tr><td colspan="4" style="text-align:center;color:var(--ht);padding:14px">No rushees tracked yet.</td></tr></tbody>`;
  }
}

// ── COMMUNITY SERVICE DEEP DIVE ──
function ciRenderCommunityServiceTab(){
  const logs=D.communityService?.hours||[];
  const members=ciFilterMembers();
  const totalHrs=logs.reduce((s,h)=>s+(parseFloat(h.hours)||0),0);
  const goal=D.communityService?.goals?.totalHrs||500;
  const kpiEl=document.getElementById('ci-cs-kpi');
  if(kpiEl) kpiEl.innerHTML=
    statStrip('Total Hours Logged',Math.round(totalHrs),'Toward '+goal+' hr goal',totalHrs>=goal?'up':'neutral')+
    statStrip('Goal Progress',Math.min(100,Math.round(totalHrs/goal*100))+'%','','neutral')+
    statStrip('Members Logging Hours',new Set(logs.map(l=>l.memberId)).size,'Of '+D.members.length+' total','neutral');
  const trendEl=document.getElementById('ci-cs-trend');
  if(trendEl){
    const filtered=logs.filter(h=>ciInDateRange(h.date));
    const byWeek={};
    filtered.forEach(h=>{if(!h.date)return;const d=new Date(h.date+'T12:00:00');const ws=new Date(d);ws.setDate(d.getDate()-d.getDay());const key=localDateStr(ws);byWeek[key]=(byWeek[key]||0)+(parseFloat(h.hours)||0);});
    const wks=Object.keys(byWeek).sort().slice(-10);
    trendEl.innerHTML = wks.length ? ciMiniBarChart(wks.map(w=>({label:mos(w)+' '+dom(w),val:byWeek[w]})),v=>Math.round(v)+' hrs') : `<div style="color:var(--ht);font-size:11.5px;padding:10px 0">No hours logged in this range.</div>`;
  }
  const tableEl=document.getElementById('ci-cs-table');
  if(tableEl){
    const byMember=members.map(m=>({m,hrs:logs.filter(h=>h.memberId===m.id).reduce((s,h)=>s+(parseFloat(h.hours)||0),0)})).filter(x=>x.hrs>0).sort((a,b)=>mNameCompare(a.m,b.m));
    tableEl.innerHTML = byMember.length ? `<thead><tr><th>Member</th><th>Class</th><th>Hours</th></tr></thead><tbody>${
      byMember.map(({m,hrs})=>`<tr><td style="font-weight:500">${esc(m.name)}</td><td>${esc(m.classYear)}</td><td>${hrs}</td></tr>`).join('')
    }</tbody>` : `<tbody><tr><td colspan="3" style="text-align:center;color:var(--ht);padding:14px">No hours logged${CI_FILTER.classYear!=='all'?' for '+esc(CI_FILTER.classYear):''} yet.</td></tr></tbody>`;
  }
}

// ── SOCIAL DEEP DIVE ──
function ciRenderSocialTab(){
  if(typeof socEvents!=='function') return;
  const events=socEvents();
  const now=localDateStr();
  const upcoming=events.filter(e=>e.date>=now);
  let totalBudget=0,totalActual=0,readinessSum=0,readinessN=0,needsAction=0;
  events.forEach(e=>{
    const plan=socPlan(e.id); plan._eventId=e.id;
    const tot=socBudgetTotals(plan); totalBudget+=tot.est; totalActual+=tot.actual;
    const r=socReadiness(plan); readinessSum+=r.score; readinessN++; if(e.date>=now&&r.missing.length)needsAction++;
  });
  const avgReadiness=readinessN?Math.round(readinessSum/readinessN):null;
  const kpiEl=document.getElementById('ci-soc-kpi');
  if(kpiEl) kpiEl.innerHTML=
    statStrip('Upcoming Events',upcoming.length,'On the calendar','neutral')+
    statStrip('Budget vs Actual','$'+Math.round(totalActual).toLocaleString()+' / $'+Math.round(totalBudget).toLocaleString(),totalActual>totalBudget?'Over budget':'Within budget',totalActual>totalBudget?'down':'up')+
    statStrip('Avg Readiness',avgReadiness===null?'—':avgReadiness+'%','Across active events','neutral');
  const alertEl=document.getElementById('ci-soc-alerts');
  if(alertEl) alertEl.innerHTML = needsAction ? `<div style="cursor:pointer" onclick="rbacNav('social',null)">${kpi('Events Needing Attention',needsAction,'Click to review in Social Events','down')}</div>` : es('ti-circle-check','green','All upcoming events on track','','');
  const bycatEl=document.getElementById('ci-soc-bycat');
  if(bycatEl){
    const byCat={};
    events.forEach(e=>{const cat=socPlan(e.id).eventCategory||'other';byCat[cat]=(byCat[cat]||0)+1;});
    const catEntries=Object.entries(byCat);
    bycatEl.innerHTML = catEntries.length ? catEntries.map(([cat,n])=>`<div class="pr"><span class="pl">${esc(socCatLabel(cat))}</span><div class="pb"><div class="pf" style="width:${Math.round(n/events.length*100)}%;background:var(--sky)"></div></div><span class="pv">${n}</span></div>`).join('') : `<div style="color:var(--ht);font-size:11.5px;padding:8px 0">No events yet.</div>`;
  }
  const tableEl=document.getElementById('ci-soc-table');
  if(tableEl){
    tableEl.innerHTML = events.length ? `<thead><tr><th>Event</th><th>Category</th><th>Date</th><th>Status</th><th>Readiness</th></tr></thead><tbody>${
      [...events].sort((a,b)=>a.date.localeCompare(b.date)).map(e=>{const plan=socPlan(e.id);const r=socReadiness(plan);return `<tr style="cursor:pointer" onclick="rbacNav('social',null)"><td style="font-weight:500">${esc(e.title)}</td><td>${esc(socCatLabel(plan.eventCategory))}</td><td>${fds(e.date)}</td><td><span class="badge ${socStatusClass(plan.status)}">${socStatusLabel(plan.status)}</span></td><td>${r.score}%</td></tr>`;}).join('')
    }</tbody>` : `<tbody><tr><td colspan="5" style="text-align:center;color:var(--ht);padding:14px">No social events yet.</td></tr></tbody>`;
  }
}

// ── ACCOUNTABILITY DEEP DIVE (Judicial Board leads only — same gate as the Judicial Board page) ──
function ciRenderAccountabilityTab(){
  const allowed = typeof jbCanAccess==='function' && jbCanAccess();
  const gate=document.getElementById('ci-acc-gate'), content=document.getElementById('ci-acc-content');
  if(gate) gate.style.display = allowed ? 'none' : 'block';
  if(content) content.style.display = allowed ? '' : 'none';
  if(!allowed) return;
  const cases=D.cases||[];
  const open=cases.filter(c=>!['resolved','dismissed'].includes(c.status));
  const byType={};
  cases.forEach(c=>{byType[c.type||'other']=(byType[c.type||'other']||0)+1;});
  const kpiEl=document.getElementById('ci-acc-kpi');
  if(kpiEl) kpiEl.innerHTML=
    statStrip('Open Cases',open.length,open.length?'Requires attention':'All clear',open.length?'down':'up')+
    statStrip('Total Cases (All Time)',cases.length,'','neutral')+
    statStrip('Most Common Type',Object.keys(byType).length?Object.entries(byType).sort((a,b)=>b[1]-a[1])[0][0]:'—','','neutral');
  const tableEl=document.getElementById('ci-acc-table');
  if(tableEl){
    tableEl.innerHTML = cases.length ? `<thead><tr><th>Case #</th><th>Type</th><th>Status</th><th>Filed By</th></tr></thead><tbody>${
      cases.map(c=>`<tr><td style="font-weight:500">${esc(c.caseNum||c.id)}</td><td>${esc(c.type)}</td><td><span class="badge ${c.status==='open'?'br2':c.status==='resolved'?'bg2':'bm2'}">${esc(c.status)}</span></td><td>${c.filedBy?esc(mB(c.filedBy).name):'—'}</td></tr>`).join('')
    }</tbody>` : `<tbody><tr><td colspan="4" style="text-align:center;color:var(--ht);padding:14px">No cases on record.</td></tr></tbody>`;
  }
}

// ── OFFICER TASKS DEEP DIVE (President/VP leads only — full cross-position breakdown) ──
// Its own filter state, separate from the shared date-range/class-year bar above — officer
// position/committee/status/assignee/due-date aren't the same dimension as attendance-window or
// class year, same reason Recruitment/Social already opt out of that shared bar (see their
// "Not filterable by class year" notes elsewhere in this page).
let CI_TASKS_FILTER = { position:'all', committee:'all', status:'all', assignee:'all', dueBefore:'', semester:null };
function ciTasksSetFilter(){
  CI_TASKS_FILTER.position=document.getElementById('ci-tk-f-position')?.value||'all';
  CI_TASKS_FILTER.committee=document.getElementById('ci-tk-f-committee')?.value||'all';
  CI_TASKS_FILTER.status=document.getElementById('ci-tk-f-status')?.value||'all';
  CI_TASKS_FILTER.assignee=document.getElementById('ci-tk-f-assignee')?.value||'all';
  CI_TASKS_FILTER.dueBefore=document.getElementById('ci-tk-f-due')?.value||'';
  CI_TASKS_FILTER.semester=document.getElementById('ci-tk-f-semester')?.value||'all';
  ciRenderTasksTab();
}
function ciTasksResetFilter(){
  CI_TASKS_FILTER={ position:'all', committee:'all', status:'all', assignee:'all', dueBefore:'', semester:getSemester() };
  ['ci-tk-f-position','ci-tk-f-committee','ci-tk-f-status','ci-tk-f-assignee'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='all';});
  const dueEl=document.getElementById('ci-tk-f-due');if(dueEl)dueEl.value='';
  const semEl=document.getElementById('ci-tk-f-semester');if(semEl)semEl.value=getSemester();
  ciRenderTasksTab();
}
function ciRenderTasksTab(){
  if(!isLeadUser())return; // defense-in-depth — the tab button is already hidden for non-leads
  const posEl=document.getElementById('ci-tk-f-position');
  if(posEl&&!posEl._init){ posEl.innerHTML='<option value="all">All Positions</option>'+chapterPositionTitles().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join(''); posEl._init=true; }
  const commEl=document.getElementById('ci-tk-f-committee');
  if(commEl&&!commEl._init){ commEl.innerHTML='<option value="all">All Committees</option>'+D.committees.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join(''); commEl._init=true; }
  // "Assignee" here filters by task.assignedTo, which is now the delegating position
  // ("Assigned By"), not a member — same chapterPositionTitles() list as the Position filter.
  const asgEl=document.getElementById('ci-tk-f-assignee');
  if(asgEl&&!asgEl._init){ asgEl.innerHTML='<option value="all">All Assigned By</option>'+chapterPositionTitles().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join(''); asgEl._init=true; }
  const semEl=document.getElementById('ci-tk-f-semester');
  if(semEl&&!semEl._init){
    const knownSems=unionKnownSemesters([...D.tasks.map(t=>t.semester),...D.goals.map(g=>g.semester)].filter(Boolean));
    semEl.innerHTML='<option value="all">All Semesters</option>'+knownSems.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
    semEl._init=true;
  }
  if(CI_TASKS_FILTER.semester===null)CI_TASKS_FILTER.semester=getSemester();
  if(semEl)semEl.value=CI_TASKS_FILTER.semester;

  const f=CI_TASKS_FILTER;
  const tasks=(D.tasks||[]).filter(t=>
    (f.position==='all'||t.positionTitle===f.position) &&
    (f.committee==='all'||t.committeeId===f.committee) &&
    (f.status==='all'||t.status===f.status) &&
    (f.assignee==='all'||t.assignedTo===f.assignee) &&
    (!f.dueBefore||(t.dueDate&&t.dueDate<=f.dueBefore)) &&
    (f.semester==='all'||!t.semester||t.semester===f.semester)
  );
  const goals=(D.goals||[]).filter(g=>f.semester==='all'||!g.semester||g.semester===f.semester);

  const dn=tasks.filter(t=>t.status==='done').length;
  const ov=tasks.filter(t=>isOv(t.dueDate)&&t.status!=='done').length;
  const goalPct=goals.length?Math.round(goals.reduce((s,g)=>s+Math.min(pc(g.current,g.target),100),0)/goals.length):null;
  const kpiEl=document.getElementById('ci-tk-kpi');
  if(kpiEl) kpiEl.innerHTML=
    statStrip('Total Assigned',tasks.length,'Matching current filters','neutral')+
    statStrip('Completion Rate',tasks.length?Math.round(dn/tasks.length*100)+'%':'—',dn+' of '+tasks.length+' done','neutral')+
    statStrip('Overdue',ov,ov?'Requires attention':'None',ov?'down':'up')+
    statStrip('Goal Progress',goalPct===null?'—':goalPct+'%','Avg. across '+goals.length+' goal'+(goals.length!==1?'s':''),'neutral');

  // ── Per-position breakdown — only positions with any task/goal activity get a row, same
  // "skip if empty" convention as the Tasks & Goals page's own per-position kanban sections.
  const positions=chapterPositionTitles();
  const posRows=positions.map(p=>{
    const pt=tasks.filter(t=>t.positionTitle===p);
    const pd=pt.filter(t=>t.status==='done').length;
    const po=pt.filter(t=>isOv(t.dueDate)&&t.status!=='done').length;
    const pg=goals.filter(g=>g.positionTitle===p);
    const pgPct=pg.length?Math.round(pg.reduce((s,g)=>s+Math.min(pc(g.current,g.target),100),0)/pg.length):null;
    return {p,total:pt.length,done:pd,pct:pt.length?Math.round(pd/pt.length*100):0,overdue:po,goalPct:pgPct};
  }).filter(r=>r.total>0||r.goalPct!==null);
  const posTableEl=document.getElementById('ci-tk-pos-table');
  if(posTableEl){
    posTableEl.innerHTML = posRows.length ? `<thead><tr><th>Position</th><th>Total Assigned</th><th>Completed</th><th>Completion %</th><th>Overdue</th><th>Goal Progress</th></tr></thead><tbody>${
      posRows.map(r=>`<tr><td style="font-weight:500">${esc(r.p)}</td><td>${r.total}</td><td>${r.done}</td><td>${r.pct}%</td><td style="${r.overdue?'color:var(--rd)':''}">${r.overdue}</td><td>${r.goalPct===null?'—':r.goalPct+'%'}</td></tr>`).join('')
    }</tbody>` : `<tbody><tr><td colspan="6" style="text-align:center;color:var(--ht);padding:14px">No task/goal activity for any position yet.</td></tr></tbody>`;
  }

  const tableEl=document.getElementById('ci-tk-table');
  if(tableEl){
    tableEl.innerHTML = tasks.length ? `<thead><tr><th>Task</th><th>Assigned To</th><th>Assigned By</th><th>Status</th><th>Due</th></tr></thead><tbody>${
      tasks.map(t=>`<tr style="cursor:pointer" onclick="rbacNav('tasks',null)"><td style="font-weight:500">${esc(t.title)}</td><td>${esc(t.positionTitle||'Unassigned')}</td><td>${esc(taskAssignedByLabel(t))}</td><td><span class="badge ${t.status==='done'?'bg2':t.status==='in_progress'?'ba2':t.status==='cant_complete'?'br2':'bm2'}">${esc(t.status)}</span></td><td style="${isOv(t.dueDate)&&t.status!=='done'?'color:var(--rd)':''}">${fds(t.dueDate)}</td></tr>`).join('')
    }</tbody>` : `<tbody><tr><td colspan="5" style="text-align:center;color:var(--ht);padding:14px">No tasks match the current filters.</td></tr></tbody>`;
  }
}

// ── SHARED MINI-CHART HELPERS ──
function ciMiniLineChart(pts){
  const vals=pts.map(p=>p.val); const mn=Math.min(...vals,60), mx=Math.max(...vals,100);
  return `<div style="display:flex;align-items:flex-end;gap:3px;height:60px">${pts.map(p=>{const h=Math.max(4,Math.round((p.val-mn)/((mx-mn)||1)*100));return `<div style="flex:1;height:${h}%;background:${attTier(p.val).color};border-radius:2px 2px 0 0" title="${esc(p.label)}: ${p.val}%"></div>`;}).join('')}</div>
  <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--ht);margin-top:3px">${pts.filter((_,i)=>i%Math.ceil(pts.length/6)===0).map(p=>`<span>${esc(p.label)}</span>`).join('')}</div>`;
}
function ciMiniBarChart(pts,fmt){
  const mx=Math.max(...pts.map(p=>p.val),1);
  return `<div style="display:flex;align-items:flex-end;gap:3px;height:60px">${pts.map(p=>`<div style="flex:1;height:${Math.max(4,Math.round(p.val/mx*100))}%;background:var(--sky);border-radius:2px 2px 0 0" title="${esc(p.label)}: ${fmt(p.val)}"></div>`).join('')}</div>
  <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--ht);margin-top:3px">${pts.map(p=>`<span>${esc(p.label)}</span>`).join('')}</div>`;
}

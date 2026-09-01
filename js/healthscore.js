// ══════════════════════════════════════════════════
// CHAPTER HEALTH SCORECARD
// ══════════════════════════════════════════════════
// Single source of truth for the chapter health score — both the full Health Scorecard page
// (below) and the Dashboard's mini health widget (js/dashboard.js:dashDrawHealth) call this,
// so the two can never show different numbers for the same underlying data again.

// Plain-language "how this dimension is scored" text, shown in Settings → Chapter Health Score.
const HEALTH_DIM_HOW={
  'Attendance':"Chapter-wide attendance rate — the average turnout across this semester's mandatory events (the same number the Attendance tab shows).",
  'Task Completion':"Share of all chapter tasks marked done. Not counted toward the score until at least one task exists.",
  'Academics':"Chapter average cumulative GPA, scaled to 100 (GPA ÷ 4 × 100). Not counted until member GPAs are entered.",
  'Accountability':"Starts at 100 and drops 18 points for each unresolved J-Board case this semester (floors at 0).",
  'Finances':"Share of members whose dues are marked fully Paid this semester. Not counted until dues amounts are configured.",
  'Recruitment':"Rushees tracked ÷ the recruitment season goal. Not counted until rushees are added.",
  'Community Service':"Service hours logged ÷ the community-service hours goal. Not counted until hours are logged.",
};
// Built-in default targets (0–100). A chapter can override any of these in Settings; the
// override lives in D.settings.healthTargets and only changes the "hit / miss" line and the
// marker on each dimension bar, never how the raw dimension value is calculated.
const HEALTH_DIM_DEFAULT_TARGET={
  'Attendance':85,'Task Completion':80,'Academics':90,'Accountability':90,'Finances':85,
  'Recruitment':80,'Community Service':75,
};
function healthTarget(k){
  const t=D.settings?.healthTargets?.[k];
  return (typeof t==='number'&&t>=0&&t<=100)?t:(HEALTH_DIM_DEFAULT_TARGET[k]??85);
}
// How full a dimension's progress bar should be: progress toward that dimension's target,
// capped at 100. Hitting or beating the target fills the bar completely; the raw score is
// still shown as the number beside it. Keeps "I met my goal" from looking half-finished.
function healthDimProgress(d){
  if(!d.target||d.target<=0)return 100;
  return Math.min(100,Math.round((d.v/d.target)*100));
}

function computeHealthDims(){
  const avg=chapterAvgAttendance();
  const sem=typeof getSemester==='function'?getSemester():null;
  const openT=D.tasks.filter(t=>t.status!=='done').length;
  const doneT=D.tasks.filter(t=>t.status==='done').length;
  const taskPct=D.tasks.length?Math.round(doneT/D.tasks.length*100):50;
  // Match the J-Board page's own view (js/judicial.js:jbVisibleCases) — count only this
  // semester's unresolved cases, not every case left open since the chapter started.
  const openCases=(D.cases||[]).filter(c=>!['resolved','dismissed'].includes(c.status)&&(!c.semester||c.semester===sem)).length;
  const caseScore=Math.max(0,100-openCases*18);
  const gpas=D.members.map(m=>{const rec=D.academics?.gpas?.[m.id]||{};const v=rec.priorGpa||'';return v?parseFloat(v):null;}).filter(g=>g!==null&&!isNaN(g));
  const avgGpa=gpas.length?(gpas.reduce((a,b)=>a+b,0)/gpas.length):0;
  const gpaScore=avgGpa?Math.round((avgGpa/4)*100):50;
  // Dues are semester-keyed now ({memberId:{[sem]:{status,...}}}) — reading D.finance.dues[id].status
  // directly always came back undefined, which pinned this dimension at 0 for every chapter.
  // finDuesMapForSemester() flattens it to {memberId:rec} for the current semester.
  const finDues=typeof finDuesMapForSemester==='function'?finDuesMapForSemester(sem):(D.finance?.dues||{});
  const paidCount=D.members.filter(m=>(finDues[m.id]?.status||'Partial')==='Paid').length;
  const finScore=D.members.length?Math.round(paidCount/D.members.length*100):50;
  // "No dues set up for the semester yet" is not "failing finances" — exclude it like the other
  // data-gated dimensions rather than scoring a hard 0.
  const s=D.settings||{};
  const finConfigured=!!(s.duesInHouse||s.duesOutOfHouse||s.duesPledge)&&Object.values(finDues).some(r=>r);
  const rushees=D.recruitment?.rushees||[];
  // Reuse each module's own configurable goal (Recruitment's Season Goal, Community Service's
  // Total Hours goal) instead of a second, hardcoded target that can silently disagree with it.
  const recruitGoal=D.recruitment?.goal?.target||20;
  const recruitScore=Math.min(100,Math.round((rushees.length/recruitGoal)*100));
  const csHrs=D.communityService?.hours?.reduce((s,h)=>s+parseFloat(h.hours||0),0)||0;
  const csGoal=D.communityService?.goals?.totalHrs||500;
  const csScore=Math.min(100,Math.round((csHrs/csGoal)*100));

  // Each dim can be marked `excluded` (no real data yet) — excluded dims are dropped from the
  // weighted average and the remaining weights are renormalized, rather than scoring 0, since
  // "no data yet" (e.g. no rushees before rush season starts) is not the same as "failing."
  const dims=[
    {k:'Attendance',icon:'ti-users',v:avg,w:.23,desc:'Average member attendance rate',target:healthTarget('Attendance'),color:'var(--navy)'},
    {k:'Task Completion',icon:'ti-checkbox',v:taskPct,w:.18,desc:doneT+' of '+D.tasks.length+' tasks done',target:healthTarget('Task Completion'),color:'var(--gn)',excluded:!D.tasks.length},
    {k:'Academics',icon:'ti-school',v:gpaScore,w:.16,desc:avgGpa?('Avg GPA '+avgGpa.toFixed(2)):'No GPA data yet',target:healthTarget('Academics'),color:'var(--bl)',excluded:!gpas.length},
    {k:'Accountability',icon:'ti-scale',v:caseScore,w:.14,desc:openCases+' open J-Board case'+(openCases!==1?'s':''),target:healthTarget('Accountability'),color:caseScore>=80?'var(--gn)':'var(--rd)'},
    {k:'Finances',icon:'ti-cash',v:finScore,w:.12,desc:finConfigured?paidCount+' / '+D.members.length+' members paid':'Dues not set up yet',target:healthTarget('Finances'),color:'var(--am)',excluded:!finConfigured},
    {k:'Recruitment',icon:'ti-user-plus',v:recruitScore,w:.09,desc:rushees.length+' rushees tracked',target:healthTarget('Recruitment'),color:'#7c5cfc',excluded:!rushees.length},
    {k:'Community Service',icon:'ti-heart',v:csScore,w:.08,desc:csHrs.toFixed(0)+' service hours logged',target:healthTarget('Community Service'),color:'#e05fa0',excluded:csHrs===0},
  ];
  const included=dims.filter(d=>!d.excluded);
  const totalW=included.reduce((s,d)=>s+d.w,0)||1;
  const score=Math.round(included.reduce((s,d)=>s+d.v*(d.w/totalW),0));
  return {score,dims,raw:{avg,doneT,taskPct,openCases,paidCount,finScore,finConfigured,csHrs}};
}

function renderHealthScore(){
  const {score,dims:allDims,raw}=computeHealthDims();
  const {avg,doneT,taskPct,openCases,paidCount,finScore,finConfigured,csHrs}=raw;
  // Judicial data is lead-only under the real permission matrix (jbCanAccess()==isLeadUser()) —
  // the Accountability dimension is case-count-derived, so it's dropped from the visible
  // breakdown (and its own KPI stat) for anyone who isn't a lead, same as the Dashboard's mini
  // widget. The composite score itself still factors it in — only the raw case-count detail
  // is hidden.
  const seesJudicial=typeof jbCanAccess==='function'&&jbCanAccess();
  const dims=seesJudicial?allDims:allDims.filter(d=>d.k!=='Accountability');
  // Grade bands are now identical to the color bands (80/65/50) — previously the grade
  // thresholds (90/80/70/60) disagreed with the color thresholds, so e.g. a score of 65 was
  // graded "D" but shown in the neutral (not warning) color. Fixed by aligning both to one set.
  const scoreColor=score>=80?'var(--gn)':score>=65?'var(--navy)':score>=50?'var(--am)':'var(--rd)';
  const grade=score>=80?'A':score>=65?'B':score>=50?'C':'F';
  const gradeStyle=score>=80?'background:var(--gn-bg);color:var(--gn-tx)':score>=65?'background:var(--bl-bg);color:var(--bl-tx)':score>=50?'background:var(--am-bg);color:var(--am-tx)':'background:var(--rd-bg);color:var(--rd-tx)';

  document.getElementById('hs-kpi').innerHTML=
    statStrip('Health Score',score+' / 100',grade+' Grade',score>=80?'up':score>=65?'neutral':'down')+
    statStrip('Attendance',avg+'%',avg>=85?'On target':'Below 85% goal',avg>=85?'up':'down')+
    (seesJudicial?statStrip('Open Cases',openCases,openCases?'Needs attention':'All clear',openCases?'down':'up'):'')+
    statStrip('Tasks Done',taskPct+'%',doneT+' of '+D.tasks.length+' complete',taskPct>=75?'up':'neutral');

  // Ring — same r=28/C=2π×28 geometry as the Dashboard's .d2-health-ring widget (direct
  // extension of that Signature component, not a parallel re-derivation).
  const ring=document.getElementById('hs-ring');
  const C=2*Math.PI*28;
  if(ring){
    ring.style.stroke=scoreColor;
    ring.style.strokeDasharray=C;
    setTimeout(()=>{ring.style.strokeDashoffset=C*(1-score/100);},100);
  }
  const sv=document.getElementById('hs-score-val');if(sv){sv.textContent=score;sv.style.color=scoreColor;}
  const gd=document.getElementById('hs-grade');
  if(gd){
    const gradeCls={A:'bg2',B:'bb2',C:'ba2',F:'br2'}[grade];
    const gradeLabel={A:'A · Excellent',B:'B · Good',C:'C · Developing',F:'F · At Risk'}[grade];
    gd.className='badge '+gradeCls;gd.textContent=gradeLabel;
  }
  const sm=document.getElementById('hs-summary');if(sm)sm.textContent=score>=80?'Chapter is in strong health across all dimensions.':score>=65?'Good standing, a few areas need attention.':score>=50?'Several dimensions below target. Exec focus needed.':'Chapter is at risk. Immediate action required.';
  document.getElementById('hs-updated').textContent='Updated '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});

  // Trend vs. the closest snapshot from ~7 days ago — same calc as the Dashboard widget
  // (js/dashboard.js:dashDrawHealth), reading the same D.healthHistory.
  const trendEl=document.getElementById('hs-trend');
  if(trendEl){
    const hist=D.healthHistory||[];
    const today=localDateStr();
    const past=hist.filter(h=>h.date!==today);
    if(past.length){
      const weekAgo=localDateStr(new Date(Date.now()-7*86400000));
      const ref=past.find(h=>h.date>=weekAgo)||past[0];
      const delta=score-ref.score;
      const dCls=delta>0?'up':delta<0?'down':'neutral';
      const dIco=delta>0?'ti-trending-up':delta<0?'ti-trending-down':'ti-minus';
      trendEl.innerHTML=`<i class="ti ${dIco}"></i>${delta>0?'+':''}${delta} pts vs ${fds(ref.date)}`;
      trendEl.className='d2-hero-trend '+dCls;
      trendEl.style.display='';
    } else {
      trendEl.style.display='none';
    }
  }

  // Hero dims strip — the full dimension set (Dashboard's widget only has room for a subset).
  const heroDimsEl=document.getElementById('hs-hero-dims');
  if(heroDimsEl){
    heroDimsEl.innerHTML=dims.filter(d=>!d.excluded).map(d=>`<div class="d2-dim">
      <span class="d2-dim-lbl">${d.k}</span>
      <div class="d2-dim-bar"><div class="d2-dim-fill" data-w="${healthDimProgress(d)}" style="background:${d.color}"></div></div>
      <span class="d2-dim-val"${d.v>=d.target?' style="color:var(--gn-tx)"':''}>${d.v}%</span>
    </div>`).join('');
    setTimeout(()=>{heroDimsEl.querySelectorAll('[data-w]').forEach(b=>{b.style.transform='scaleX('+(b.dataset.w/100)+')';});},120);
  }

  // Dimension bars — excluded dims (no real data yet, e.g. no rushees before rush season)
  // show "No data yet" instead of a misleading 0% bar, and don't count toward the score.
  document.getElementById('hs-dims').innerHTML=dims.map(d=>{
    if(d.excluded){
      return`<div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:6px"><i class="ti ${d.icon}" style="font-size:12px;color:var(--ht)"></i><span style="font-size:12px;font-weight:500;color:var(--ht)">${d.k}</span><span style="font-size:9.5px;color:var(--ht)">${d.desc}</span></div>
          <span style="font-size:10.5px;color:var(--ht)">No data yet, excluded from score</span>
        </div>
        <div style="height:6px;background:var(--surf2);border-radius:99px"></div>
      </div>`;
    }
    const p=d.v;const hit=p>=d.target;const prog=healthDimProgress(d);
    return`<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:6px"><i class="ti ${d.icon}" style="font-size:12px;color:${d.color}"></i><span style="font-size:12px;font-weight:500">${d.k}</span><span style="font-size:9.5px;color:var(--ht)">${d.desc}</span></div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0"><span style="font-size:11.5px;font-weight:700;color:${hit?'var(--gn)':'var(--rd)'}">${p}%${hit?' <i class="ti ti-check" style="font-size:10px"></i>':''}</span><span style="font-size:9px;color:var(--ht)">/ ${d.target}% goal</span></div>
      </div>
      <div style="height:6px;background:var(--surf2);border-radius:99px;overflow:hidden">
        <div style="height:100%;border-radius:99px;background:${hit?'var(--gn)':d.color};width:100%;transform-origin:left;transform:scaleX(${prog/100});transition:transform .7s ease"></div>
      </div>
    </div>`;
  }).join('');

  // Strengths / improvements / actions — excluded (no-data) dims don't count as either
  const scored=dims.filter(d=>!d.excluded);
  const strong=scored.filter(d=>d.v>=d.target).sort((a,b)=>b.v-a.v);
  const weak=scored.filter(d=>d.v<d.target).sort((a,b)=>a.v-b.v);
  document.getElementById('hs-strengths').innerHTML=strong.length?strong.map(d=>`<div class="al-row"><div class="al-ic" style="background:var(--gn-bg);color:var(--gn-tx)"><i class="ti ${d.icon}"></i></div><div><div style="font-size:12px;font-weight:500">${d.k}</div><div style="font-size:10.5px;color:var(--mt)">${d.v}%, ${d.v-d.target}pts above target</div></div></div>`).join(''):es('ti-mood-happy','green','All areas at target!','Keep it up.','');
  document.getElementById('hs-improvements').innerHTML=weak.length?weak.map(d=>`<div class="al-row"><div class="al-ic" style="background:var(--rd-bg);color:var(--rd-tx)"><i class="ti ${d.icon}"></i></div><div><div style="font-size:12px;font-weight:500">${d.k}</div><div style="font-size:10.5px;color:var(--mt)">${d.v}%, needs ${d.target-d.v}pts to hit target</div></div></div>`).join(''):es('ti-circle-check','green','All dimensions on target!','','');
  const actions=[];
  if(avg<85)actions.push({icon:'ti-users',txt:'Mark attendance for recent mandatory events to improve tracking accuracy.'});
  if(taskPct<75)actions.push({icon:'ti-checkbox',txt:'Review overdue tasks with officers. Consider reassigning stalled items.'});
  if(openCases>2)actions.push({icon:'ti-scale',txt:'Schedule J-Board hearings for the '+openCases+' open cases.'});
  if(finConfigured&&finScore<70)actions.push({icon:'ti-cash',txt:'Send dues reminder to '+((D.members.length)-paidCount)+' members with outstanding balances.'});
  if(csHrs<200)actions.push({icon:'ti-heart',txt:'Schedule a service event. Chapter is behind on service hour goals.'});
  if(!actions.length)actions.push({icon:'ti-sparkles',txt:'Chapter is in strong shape! Focus on maintaining momentum into finals.'});
  document.getElementById('hs-actions').innerHTML=actions.map(a=>`<div class="al-row"><div class="al-ic" style="background:var(--bl-bg);color:var(--bl-tx)"><i class="ti ${a.icon}"></i></div><div style="font-size:11.5px;line-height:1.5">${a.txt}</div></div>`).join('');

  // Passively record today's snapshot (deduped — at most one per calendar day), then render
  // the real trend from it. Starts sparse and genuinely grows; no history is invented. Records
  // the full, unfiltered dimension set (allDims) regardless of which role happened to open this
  // page today — the stored history must not vary depending on who triggered the snapshot.
  hsRecordSnapshot(score,allDims);
  hsRenderHistory();
}
// Writes one {date,score,dims} snapshot per calendar day to D.healthHistory. This is the ONLY
// place any historical record of the composite score is created — previously no such record
// existed anywhere, and the old "history" chart here was secretly just re-deriving attendance.
function hsRecordSnapshot(score,dims){
  if(!D.healthHistory)D.healthHistory=[];
  const today=localDateStr();
  if(D.healthHistory.length && D.healthHistory[D.healthHistory.length-1].date===today) return;
  const dimSnapshot={};
  dims.forEach(d=>{dimSnapshot[d.k]=d.excluded?null:d.v;});
  D.healthHistory.push({date:today,score,dims:dimSnapshot});
  if(D.healthHistory.length>180)D.healthHistory=D.healthHistory.slice(-180);
  saveD('healthHistory');
}
function hsRenderHistory(){
  const history=(D.healthHistory||[]).slice(-30);
  if(history.length<2){
    document.getElementById('hs-history-chart').innerHTML=`<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:11.5px;color:var(--ht)">Tracking started ${(D.healthHistory||[]).length?fds(D.healthHistory[0].date):'today'}. Check back as this page is viewed over time to see a real trend build up.</div>`;
    document.getElementById('hs-history-labels').innerHTML='';
    return;
  }
  const data=history.map(h=>h.score);
  const labels=history.map(h=>mos(h.date)+' '+dom(h.date));
  const mx=Math.max(...data,1);
  document.getElementById('hs-history-chart').innerHTML=data.map((v,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px"><div style="font-size:9px;color:var(--mt)">${v}</div><div style="flex:1;width:100%;background:${i===data.length-1?'var(--gold)':v>=80?'var(--gn)':v>=65?'var(--sky)':'var(--rd)'};border-radius:3px 3px 0 0;min-height:4px;height:${Math.round(v/mx*100)}%" title="${labels[i]}: ${v}"></div></div>`).join('');
  document.getElementById('hs-history-labels').innerHTML=labels.map(l=>`<span style="color:var(--ht)">${l}</span>`).join('');
}

// ── SETTINGS: CHAPTER HEALTH SCORE ── (Settings page card, chapter-lead editable)
// Shows every dimension's weight and how it's scored, with an editable target. Targets only
// move the "hit / miss" line — they never change how a dimension's raw value is computed.
function seRenderHealthConfig(){
  const el=document.getElementById('se-health-config');
  if(!el)return;
  const canEdit=typeof isLeadUser==='function'&&isLeadUser();
  const {dims}=computeHealthDims();
  const ro=canEdit?'':' disabled style="opacity:.55;cursor:not-allowed"';
  const rows=dims.map(d=>{
    const tgtId='se-ht-'+d.k.replace(/[^a-z]/gi,'');
    const now=d.excluded?'<span style="color:var(--ht)">no data</span>':`<span style="font-weight:600;color:${d.v>=d.target?'var(--gn)':'var(--rd)'}">${d.v}%</span>`;
    return`<div style="padding:10px 0;border-bottom:1px solid var(--bdr)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:3px">
        <span style="font-size:12.5px;font-weight:600"><i class="ti ${d.icon}" style="font-size:12px;color:${d.color};margin-right:5px"></i>${esc(d.k)}</span>
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--mt);background:var(--surf2);padding:2px 7px;border-radius:99px;flex-shrink:0">${Math.round(d.w*100)}% weight</span>
      </div>
      <div style="font-size:11px;color:var(--mt);line-height:1.5;margin-bottom:7px">${esc(HEALTH_DIM_HOW[d.k]||'')}</div>
      <div style="display:flex;align-items:center;gap:8px;font-size:11.5px">
        <span style="color:var(--mt)">Current: ${now}</span>
        <span style="color:var(--bdr)">·</span>
        <label for="${tgtId}" style="color:var(--mt)">Target</label>
        <input id="${tgtId}" data-dim="${esc(d.k)}" type="number" min="0" max="100" value="${d.target}"${ro}
          style="width:64px;height:26px;padding:0 7px;border:1px solid var(--bdr);border-radius:6px;font-size:12px;font-family:inherit;text-align:center;outline:none">
        <span style="color:var(--mt)">%</span>
        ${d.target!==(HEALTH_DIM_DEFAULT_TARGET[d.k])?`<span style="font-size:10px;color:var(--ht)">(default ${HEALTH_DIM_DEFAULT_TARGET[d.k]})</span>`:''}
      </div>
    </div>`;
  }).join('');
  const totalW=Math.round(dims.reduce((s,d)=>s+d.w,0)*100);
  const totalLine=`<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0 2px;font-size:11.5px;font-weight:600">
    <span style="color:var(--mt)">Total weight</span>
    <span style="color:${totalW===100?'var(--gn-tx)':'var(--rd-tx)'}">${totalW}%${totalW===100?'':' — should be 100%'}</span>
  </div>`;
  el.innerHTML=`
    <div style="font-size:11px;color:var(--mt);line-height:1.55;margin-bottom:6px">
      The score is the <strong>weighted average</strong> of the dimensions below that currently have data.
      Dimensions with no data yet are dropped and the remaining weights are re-scaled, so "no rushees before
      rush" never counts as failing. Targets set the pass/fail line and the marker on each bar — they don't
      change the underlying numbers.
    </div>
    ${rows}
    ${totalLine}
    ${canEdit
      ? `<div style="display:flex;gap:7px;margin-top:11px"><button class="btn btn-p" onclick="saveHealthTargets()"><i class="ti ti-device-floppy"></i>Save Targets</button><button class="btn" onclick="resetHealthTargets()">Reset to defaults</button></div>`
      : `<div style="font-size:11.5px;color:var(--mt);margin-top:9px"><i class="ti ti-lock" style="font-size:12px;margin-right:4px"></i>Only a chapter lead can edit health-score targets.</div>`}
  `;
}

function saveHealthTargets(){
  if(!(typeof isLeadUser==='function'&&isLeadUser())){toast('Only a chapter lead can edit health-score targets.','error');return;}
  if(!D.settings)D.settings={};
  const targets={};
  document.querySelectorAll('#se-health-config input[data-dim]').forEach(inp=>{
    const n=parseInt(inp.value,10);
    if(!isNaN(n)&&n>=0&&n<=100)targets[inp.dataset.dim]=n;
  });
  D.settings.healthTargets=targets;
  saveD('settings');
  seRenderHealthConfig();
  if(typeof renderHealthScore==='function')renderHealthScore();
  if(typeof renderDash==='function')renderDash();
  toast('Health-score targets saved','success');
}

function resetHealthTargets(){
  if(!(typeof isLeadUser==='function'&&isLeadUser())){toast('Only a chapter lead can edit health-score targets.','error');return;}
  if(!D.settings)D.settings={};
  D.settings.healthTargets={};   // empty -> healthTarget() falls back to the built-in default for every dimension
  saveD('settings');
  seRenderHealthConfig();
  if(typeof renderHealthScore==='function')renderHealthScore();
  if(typeof renderDash==='function')renderDash();
  toast('Health-score targets reset to defaults','success');
}

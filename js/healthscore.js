// ══════════════════════════════════════════════════
// CHAPTER HEALTH SCORECARD
// ══════════════════════════════════════════════════
// Single source of truth for the chapter health score — both the full Health Scorecard page
// (below) and the Dashboard's mini health widget (js/dashboard.js:dashDrawHealth) call this,
// so the two can never show different numbers for the same underlying data again.
function computeHealthDims(){
  const tot=D.members.length||1;
  const avg=Math.round(D.members.reduce((s,m)=>s+aR(m.id),0)/tot);
  const openT=D.tasks.filter(t=>t.status!=='done').length;
  const doneT=D.tasks.filter(t=>t.status==='done').length;
  const taskPct=D.tasks.length?Math.round(doneT/D.tasks.length*100):50;
  const openCases=D.cases.filter(c=>!['resolved','dismissed'].includes(c.status)).length;
  const caseScore=Math.max(0,100-openCases*18);
  const gpas=D.members.map(m=>{const rec=D.academics?.gpas?.[m.id]||{};const v=rec.cumulativeGpa||rec.priorGpa||'';return v?parseFloat(v):null;}).filter(g=>g!==null&&!isNaN(g));
  const avgGpa=gpas.length?(gpas.reduce((a,b)=>a+b,0)/gpas.length):0;
  const gpaScore=avgGpa?Math.round((avgGpa/4)*100):50;
  const finDues=D.finance?.dues||{};
  const paidCount=D.members.filter(m=>(finDues[m.id]?.status||'Partial')==='Paid').length;
  const finScore=D.members.length?Math.round(paidCount/D.members.length*100):50;
  const rushees=D.recruitment?.rushees||[];
  // Reuse each module's own configurable goal (Recruitment's Season Goal, Community Service's
  // Total Hours goal) instead of a second, hardcoded target that can silently disagree with it.
  const recruitGoal=D.recruitment?.goal?.target||20;
  const recruitScore=Math.min(100,Math.round((rushees.length/recruitGoal)*100));
  const csHrs=D.communityService?.hours?.reduce((s,h)=>s+parseFloat(h.hours||0),0)||0;
  const csGoal=D.communityService?.goals?.totalHrs||500;
  const csScore=Math.min(100,Math.round((csHrs/csGoal)*100));
  const alumCount=D.alumni?.contacts?.length||0;
  const alumScore=Math.min(100,Math.round((alumCount/20)*100));
  // Social Events (uses Milestone 1's real data — js/social.js) — average readiness across
  // non-cancelled events in the current/upcoming window. Reuses socReadiness()/socEvents()
  // directly rather than reimplementing the math.
  let socialScore=null, socialDesc='No social events yet';
  if(typeof socEvents==='function'){
    const now=localDateStr();
    const relevant=socEvents().filter(e=>{const p=socPlan(e.id);return p.status!=='cancelled'&&(e.date>=localDateStr(new Date(Date.now()-30*86400000)));});
    if(relevant.length){
      const scores=relevant.map(e=>socReadiness(socPlan(e.id)).score);
      socialScore=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
      socialDesc=relevant.length+' event'+(relevant.length!==1?'s':'')+' — avg readiness';
    }
  }

  // Each dim can be marked `excluded` (no real data yet) — excluded dims are dropped from the
  // weighted average and the remaining weights are renormalized, rather than scoring 0, since
  // "no data yet" (e.g. no rushees before rush season starts) is not the same as "failing."
  const dims=[
    {k:'Attendance',icon:'ti-users',v:avg,w:.20,desc:'Average member attendance rate',target:85,color:'var(--navy)'},
    {k:'Task Completion',icon:'ti-checkbox',v:taskPct,w:.16,desc:doneT+' of '+D.tasks.length+' tasks done',target:80,color:'var(--gn)',excluded:!D.tasks.length},
    {k:'Academics',icon:'ti-school',v:gpaScore,w:.14,desc:avgGpa?('Avg GPA '+avgGpa.toFixed(2)):'No GPA data yet',target:90,color:'var(--bl)',excluded:!gpas.length},
    {k:'Accountability',icon:'ti-scale',v:caseScore,w:.12,desc:openCases+' open J-Board case'+(openCases!==1?'s':''),target:90,color:caseScore>=80?'var(--gn)':'var(--rd)'},
    {k:'Finances',icon:'ti-cash',v:finScore,w:.11,desc:paidCount+' / '+D.members.length+' members paid',target:85,color:'var(--am)'},
    {k:'Recruitment',icon:'ti-user-plus',v:recruitScore,w:.08,desc:rushees.length+' rushees tracked',target:80,color:'#7c5cfc',excluded:!rushees.length},
    {k:'Community Service',icon:'ti-heart',v:csScore,w:.07,desc:csHrs.toFixed(0)+' service hours logged',target:75,color:'#e05fa0',excluded:csHrs===0},
    {k:'Social Events',icon:'ti-confetti',v:socialScore??0,w:.07,desc:socialDesc,target:80,color:'#c0345a',excluded:socialScore===null},
    {k:'Alumni',icon:'ti-users-group',v:alumScore,w:.05,desc:alumCount+' alumni in directory',target:70,color:'#0ea5a0',excluded:alumCount===0},
  ];
  const included=dims.filter(d=>!d.excluded);
  const totalW=included.reduce((s,d)=>s+d.w,0)||1;
  const score=Math.round(included.reduce((s,d)=>s+d.v*(d.w/totalW),0));
  return {score,dims,raw:{avg,doneT,taskPct,openCases,paidCount,finScore,csHrs,alumCount}};
}

function renderHealthScore(){
  const {score,dims,raw}=computeHealthDims();
  const {avg,doneT,taskPct,openCases,paidCount,finScore,csHrs,alumCount}=raw;
  // Grade bands are now identical to the color bands (80/65/50) — previously the grade
  // thresholds (90/80/70/60) disagreed with the color thresholds, so e.g. a score of 65 was
  // graded "D" but shown in the neutral (not warning) color. Fixed by aligning both to one set.
  const scoreColor=score>=80?'var(--gn)':score>=65?'var(--navy)':score>=50?'var(--am)':'var(--rd)';
  const grade=score>=80?'A':score>=65?'B':score>=50?'C':'F';
  const gradeStyle=score>=80?'background:var(--gn-bg);color:var(--gn-tx)':score>=65?'background:var(--bl-bg);color:var(--bl-tx)':score>=50?'background:var(--am-bg);color:var(--am-tx)':'background:var(--rd-bg);color:var(--rd-tx)';

  document.getElementById('hs-kpi').innerHTML=
    statStrip('Health Score',score+' / 100',grade+' Grade',score>=80?'up':score>=65?'neutral':'down')+
    statStrip('Attendance',avg+'%',avg>=85?'On target':'Below 85% goal',avg>=85?'up':'down')+
    statStrip('Open Cases',openCases,openCases?'Needs attention':'All clear',openCases?'down':'up')+
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
  const sm=document.getElementById('hs-summary');if(sm)sm.textContent=score>=80?'Chapter is in strong health across all dimensions.':score>=65?'Good standing — a few areas need attention.':score>=50?'Several dimensions below target. Exec focus needed.':'Chapter is at risk. Immediate action required.';
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
      <div class="d2-dim-bar"><div class="d2-dim-fill" data-w="${d.v}" style="background:${d.color}"></div></div>
      <span class="d2-dim-val">${d.v}%</span>
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
          <span style="font-size:10.5px;color:var(--ht)">No data yet — excluded from score</span>
        </div>
        <div style="height:6px;background:var(--surf2);border-radius:99px"></div>
      </div>`;
    }
    const p=d.v;const hit=p>=d.target;
    return`<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:6px"><i class="ti ${d.icon}" style="font-size:12px;color:${d.color}"></i><span style="font-size:12px;font-weight:500">${d.k}</span><span style="font-size:9.5px;color:var(--ht)">${d.desc}</span></div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0"><span style="font-size:11.5px;font-weight:700;color:${hit?'var(--gn)':'var(--rd)'}">${p}%</span><span style="font-size:9px;color:var(--ht)">/ ${d.target}%</span></div>
      </div>
      <div style="height:6px;background:var(--surf2);border-radius:99px;overflow:hidden;position:relative">
        <div style="height:100%;border-radius:99px;background:${d.color};width:100%;transform-origin:left;transform:scaleX(${p/100});transition:transform .7s ease"></div>
        <div style="position:absolute;top:0;bottom:0;left:${d.target}%;width:2px;background:var(--ht);border-radius:1px"></div>
      </div>
    </div>`;
  }).join('');

  // Strengths / improvements / actions — excluded (no-data) dims don't count as either
  const scored=dims.filter(d=>!d.excluded);
  const strong=scored.filter(d=>d.v>=d.target).sort((a,b)=>b.v-a.v);
  const weak=scored.filter(d=>d.v<d.target).sort((a,b)=>a.v-b.v);
  document.getElementById('hs-strengths').innerHTML=strong.length?strong.map(d=>`<div class="al-row"><div class="al-ic" style="background:var(--gn-bg);color:var(--gn-tx)"><i class="ti ${d.icon}"></i></div><div><div style="font-size:12px;font-weight:500">${d.k}</div><div style="font-size:10.5px;color:var(--mt)">${d.v}% — ${d.v-d.target}pts above target</div></div></div>`).join(''):es('ti-mood-happy','green','All areas at target!','Keep it up.','');
  document.getElementById('hs-improvements').innerHTML=weak.length?weak.map(d=>`<div class="al-row"><div class="al-ic" style="background:var(--rd-bg);color:var(--rd-tx)"><i class="ti ${d.icon}"></i></div><div><div style="font-size:12px;font-weight:500">${d.k}</div><div style="font-size:10.5px;color:var(--mt)">${d.v}% — needs ${d.target-d.v}pts to hit target</div></div></div>`).join(''):es('ti-circle-check','green','All dimensions on target!','','');
  const actions=[];
  if(avg<85)actions.push({icon:'ti-users',txt:'Mark attendance for recent mandatory events to improve tracking accuracy.'});
  if(taskPct<75)actions.push({icon:'ti-checkbox',txt:'Review overdue tasks with officers. Consider reassigning stalled items.'});
  if(openCases>2)actions.push({icon:'ti-scale',txt:'Schedule J-Board hearings for the '+openCases+' open cases.'});
  if(finScore<70)actions.push({icon:'ti-cash',txt:'Send dues reminder to '+((D.members.length)-paidCount)+' members with outstanding balances.'});
  if(csHrs<200)actions.push({icon:'ti-heart',txt:'Schedule a service event — chapter is behind on service hour goals.'});
  if(alumCount<10)actions.push({icon:'ti-users-group',txt:'Reach out to known alumni and add them to the directory.'});
  if(!actions.length)actions.push({icon:'ti-sparkles',txt:'Chapter is in strong shape! Focus on maintaining momentum into finals.'});
  document.getElementById('hs-actions').innerHTML=actions.map(a=>`<div class="al-row"><div class="al-ic" style="background:var(--bl-bg);color:var(--bl-tx)"><i class="ti ${a.icon}"></i></div><div style="font-size:11.5px;line-height:1.5">${a.txt}</div></div>`).join('');

  // Passively record today's snapshot (deduped — at most one per calendar day), then render
  // the real trend from it. Starts sparse and genuinely grows; no history is invented.
  hsRecordSnapshot(score,dims);
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
    document.getElementById('hs-history-chart').innerHTML=`<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:11.5px;color:var(--ht)">Tracking started ${(D.healthHistory||[]).length?fds(D.healthHistory[0].date):'today'} — check back as this page is viewed over time to see a real trend build up.</div>`;
    document.getElementById('hs-history-labels').innerHTML='';
    return;
  }
  const data=history.map(h=>h.score);
  const labels=history.map(h=>mos(h.date)+' '+dom(h.date));
  const mx=Math.max(...data,1);
  document.getElementById('hs-history-chart').innerHTML=data.map((v,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px"><div style="font-size:9px;color:var(--mt)">${v}</div><div style="flex:1;width:100%;background:${i===data.length-1?'var(--gold)':v>=80?'var(--gn)':v>=65?'var(--sky)':'var(--rd)'};border-radius:3px 3px 0 0;min-height:4px;height:${Math.round(v/mx*100)}%" title="${labels[i]}: ${v}"></div></div>`).join('');
  document.getElementById('hs-history-labels').innerHTML=labels.map(l=>`<span style="color:var(--ht)">${l}</span>`).join('');
}

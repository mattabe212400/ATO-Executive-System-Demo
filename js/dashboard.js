function renderDash(){
  // General Members (role:'viewer') see this same Dashboard page (it's always in VIEWER_PAGES),
  // but several widgets below are exec-facing: judicial case counts, the Finances health
  // dimension, individual officers' performance, and other members' attendance/task standing by
  // name. Same privacy stance already established for viewers on the Attendance page (see
  // renderAttendanceOwnOnly's own comment about hiding Risk Stratification) — applied here too.
  const isViewer=!!(CURRENT_USER&&CURRENT_USER.role==='viewer');

  const tot=D.members.length||1;
  const avg=Math.round(D.members.reduce((s,m)=>s+aR(m.id),0)/tot);
  const openT=D.tasks.filter(t=>t.status!=='done').length;
  const ovT=D.tasks.filter(t=>isOv(t.dueDate)&&t.status!=='done').length;
  const cas=D.cases.filter(c=>!['resolved','dismissed'].includes(c.status)).length;
  const dn=D.tasks.filter(t=>t.status==='done').length;
  const taskPct=D.tasks.length?Math.round(dn/D.tasks.length*100):0;

  // ── KPI STAT STRIP ── (one bordered strip with internal dividers, not four identical cards)
  document.getElementById('d-kpi').innerHTML=
    statStrip('Chapter Attendance',avg+'%',avg>=85?'Above 85% target':'Below 85% target',avg>=85?'up':'down')+
    statStrip('Active Members',tot,getSemester()+' roster','neutral')+
    statStrip('Open Tasks',openT,ovT>0?ovT+' overdue':'All on track',ovT>0?'down':'neutral')+
    (isViewer?'':statStrip('Active Cases',cas,cas>0?'Requires attention':'No open cases',cas?'down':'neutral'));

  // ── QUICK ACTIONS ──
  dashBuildQuickActions(isViewer);

  // ── CHAPTER HEALTH SCORE ──
  dashDrawHealth(isViewer);

  // ── INTELLIGENCE ALERTS ──
  dashBuildAlerts(avg,isViewer);
  const alertsLink=document.getElementById('d-alerts-analytics-link');if(alertsLink)alertsLink.style.display=isViewer?'none':'';

  // ── OFFICER KPIs (exec-only: individual officer performance) ──
  const offCard=document.getElementById('d-officers-card');if(offCard)offCard.style.display=isViewer?'none':'';

  // ── SEMESTER GOALS link (Tasks page isn't viewer-accessible) ──
  const goalsLink=document.getElementById('d-goals-tasks-link');if(goalsLink)goalsLink.style.display=isViewer?'none':'';

  // ── OVERDUE TASKS (names individual assignees; Tasks page isn't viewer-accessible) ──
  if(isViewer){const ovEl=document.getElementById('d-overdue');if(ovEl)ovEl.closest('.card').style.display='none';}
  else dashBuildOverdue();

  // ── ATTENDANCE RISK (names other members — same privacy stance as renderAttendanceOwnOnly) ──
  if(isViewer){const arEl=document.getElementById('d-att-risk');if(arEl)arEl.closest('.card').style.display='none';}
  else dashBuildAttRisk();

  // ── UPCOMING EVENTS WITH COUNTDOWN ──
  dashBuildEvents();

  // ── SOBER BROS ──
  const ws=sbFlatSlots().filter(s=>isUp(s.date)).slice(0,4);
  document.getElementById('d-sober').innerHTML=ws.map(s=>{const m=s.memberId?mB(s.memberId):null;return`<div class="sh-row"><div class="sh-av">${m?m.initials:'??'}</div><div style="flex:1"><div style="font-size:12px;font-weight:500;color:${m?'var(--tx)':'var(--rd)'}">${m?m.name:'Unassigned'}</div><div style="font-size:10.5px;color:var(--ht)">${fds(s.date)} · ${esc(s.label)}</div></div><span class="dot ${!m?'dr':'dg'}"></span></div>`;}).join('')||es('ti-shield-check','green','No shifts scheduled','Shifts appear here.',`<button class="btn" onclick="rbacNav('sober',null)">View schedule</button>`);

  // ── OFFICER KPI CARDS ── (card itself hidden above for viewers; skip populating its DOM too)
  const offs=isViewer?[]:sortedMembers().filter(m=>m.role!=='Member');
  const offV2=document.getElementById('d-officers-v2');
  if(offV2&&!isViewer){
    if(!offs.length){
      offV2.innerHTML=`<div style="padding:16px;text-align:center;color:var(--ht);font-size:11.5px">No officers found. Assign roles in Members.</div>`;
    } else {
      offV2.innerHTML=offs.map(m=>{
        // Shared with the Analytics page's officer matrix and the Weekly Report's Officer
        // Accountability table (js/analytics.js:calcOfficerEngagement) so a given officer's
        // status can never read differently across the three places that show it.
        const eng=calcOfficerEngagement(m.id);
        const badgeMap={on_track:'bg2',behind:'ba2',at_risk:'br2'};
        return`<div class="d2-off-card">
          <div><div class="d2-off-name">${esc(m.name)}</div><div class="d2-off-role">${esc(m.role)}</div></div>
          <div class="d2-off-stat">
            <div class="d2-off-stat-val" style="color:${attTier(eng.attendanceRate).color}">${eng.attendanceRate}%</div>
            <div class="d2-off-stat-lbl">Attend</div>
          </div>
          <div class="d2-off-stat">
            <div class="d2-off-stat-val">${eng.taskDone}/${eng.taskTotal}</div>
            <div class="d2-off-stat-lbl">Tasks</div>
          </div>
          <div class="d2-off-status"><span class="badge ${badgeMap[eng.status]}">${eng.statusMeta.label}</span></div>
        </div>`;
      }).join('');
    }
  }

  // ── ATTENDANCE BAR CHART ──
  const mandPast=D.events.filter(e=>e.mandatory&&!isUp(e.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-8);
  const chartEl=document.getElementById('d-chart');
  const labEl=document.getElementById('d-chart-labels');
  if(mandPast.length>=2){
    const chartData=mandPast.map(ev=>{const att=D.attendance[ev.id]||{};const pres=Object.values(att).filter(v=>v==='present'||v==='excused').length;return tot?Math.round(pres/tot*100):0;});
    const chartLabels=mandPast.map(ev=>mos(ev.date)+' '+dom(ev.date));
    const mx=Math.max(...chartData,1);
    if(chartEl)chartEl.innerHTML=chartData.map((v,i)=>`<div class="mb" style="flex:1;height:${Math.round(v/mx*100)}%;background:${v<75?'var(--rd)':v<85?'var(--am)':i===chartData.length-1?'var(--navy)':'var(--sky-bg)'};border-radius:3px 3px 0 0;transition:height .4s ease" title="${chartLabels[i]}: ${v}%"></div>`).join('');
    if(labEl)labEl.innerHTML=chartLabels.map(l=>`<span>${l}</span>`).join('');
  } else {
    if(chartEl)chartEl.innerHTML=`<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--ht)">No attendance data yet</div>`;
    if(labEl)labEl.innerHTML='';
  }
  const r=24,cv=2*Math.PI*r;
  const rc=document.getElementById('ring-c');if(rc){rc.style.strokeDasharray=cv;rc.style.strokeDashoffset=cv*(1-avg/100);}
  const rv=document.getElementById('ring-v');if(rv)rv.textContent=avg+'%';
  const rv2=document.getElementById('ring-v2');if(rv2)rv2.textContent=avg+'%';
  const rs=document.getElementById('ring-s');if(rs)rs.textContent=Math.round(tot*avg/100)+' / '+tot+' members';

  // ── GOALS ──
  document.getElementById('d-goals').innerHTML=D.goals.map(g=>{const p=Math.min(pc(g.current,g.target),100);return`<div class="pr"><span class="pl">${esc(g.title)}</span><div class="pb"><div class="pf" style="width:${p}%;background:${pgc(p)}"></div></div><span class="pv">${p}%</span></div>`;}).join('')||'<div style="color:var(--ht);font-size:12px;padding:8px 0">No goals yet.</div>';

  // ── NOTES ──
  const notesEl=document.getElementById('d-notes');
  if(notesEl)notesEl.innerHTML=D.notes.slice(0,3).map(n=>`<div style="padding:7px 0;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="rbacNav('notes',null)"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${esc(n.title)}</span><span style="font-size:10px;color:var(--ht);flex-shrink:0">${fds(n.date)}</span></div><div style="font-size:10.5px;color:var(--mt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((n.body||'').slice(0,80))}</div></div>`).join('')||es('ti-notes','slate','No meeting notes','Chapter meeting notes will appear here.','');

  updateBadges();
}

// ── QUICK ACTIONS ── (secondary utility row; each action reuses the same modal/open functions
// the target page's own toolbar uses, gated by the same canEditPage() check that page enforces)
function dashBuildQuickActions(isViewer){
  const el=document.getElementById('d-quickbar');if(!el)return;
  if(isViewer){el.style.display='none';return;}
  const actions=[];
  if(canEditPage('tasks'))actions.push({label:'New Task',icon:'ti-plus',fn:"openM('m-addtask')"});
  if(canEditPage('calendar'))actions.push({label:'Add Event',icon:'ti-calendar-plus',fn:"openM('m-addevent')"});
  if(canEditPage('tasks'))actions.push({label:'Add Goal',icon:'ti-target-arrow',fn:"openM('m-addgoal')"});
  if(canEditPage('notes'))actions.push({label:'New Note',icon:'ti-note',fn:"openAddNote()"});
  if(!actions.length){el.style.display='none';return;}
  el.style.display='';
  el.innerHTML=`<span class="d2-quickbar-label">Quick actions</span>`+
    actions.map(a=>`<button class="btn" onclick="${a.fn}"><i class="ti ${a.icon}"></i>${a.label}</button>`).join('');
}

// ── CHAPTER HEALTH SCORE ──
// Sources the exact same score/dimensions as the full Health Scorecard page
// (js/healthscore.js:computeHealthDims) so the two never disagree — shows a subset of the
// canonical 8 dimensions (dropped Recruitment/Community Service/Alumni to fit the widget).
function dashDrawHealth(isViewer){
  const {score,dims:allDims}=computeHealthDims();
  const find=k=>allDims.find(d=>d.k===k);
  // Shorter labels for the widget's tight layout; values/colors come straight from the
  // canonical dims so they always match the full Scorecard page. Finances is exec-only data —
  // dropped for General Members (role:'viewer'), same as the Active Cases KPI above.
  const dims=[
    {...find('Attendance'),k:'Attendance'},
    {...find('Task Completion'),k:'Tasks'},
    {...find('Academics'),k:'GPA'},
    {...find('Accountability'),k:'Accountability'},
    ...(isViewer?[]:[{...find('Finances'),k:'Finances'}]),
  ];
  const scoreColor=score>=80?'var(--gn)':score>=65?'var(--navy)':score>=50?'var(--am)':'var(--rd)';

  const valEl=document.getElementById('d-health-val');
  const ringEl=document.getElementById('d-health-ring');
  if(valEl){valEl.textContent=score;valEl.style.color=scoreColor;}
  if(ringEl){
    const C=2*Math.PI*28;
    ringEl.style.stroke=scoreColor;
    ringEl.style.strokeDasharray=C;
    setTimeout(()=>{ringEl.style.strokeDashoffset=C*(1-score/100);},80);
  }

  // Grade + one-line summary — identical thresholds and copy to the full Health Scorecard page
  // (js/healthscore.js:renderHealthScore) so the two never disagree.
  const grade=score>=80?'A':score>=65?'B':score>=50?'C':'F';
  const gradeCls={A:'bg2',B:'bb2',C:'ba2',F:'br2'}[grade];
  const gradeLabel={A:'A · Excellent',B:'B · Good',C:'C · Developing',F:'F · At Risk'}[grade];
  const gEl=document.getElementById('d-health-grade');
  if(gEl){gEl.className='badge '+gradeCls;gEl.textContent=gradeLabel;}
  const summary=score>=80?'Strong across all dimensions.':score>=65?'Good standing, a few areas need attention.':score>=50?'Several dimensions below target. Exec focus needed.':'At risk, immediate action required.';
  const sumEl=document.getElementById('d-health-summary');if(sumEl)sumEl.textContent=summary;

  // Trend vs. the closest snapshot from ~7 days ago. D.healthHistory is written once per calendar
  // day, solely by js/healthscore.js:hsRecordSnapshot — read-only here, never written on the
  // Dashboard, so history only exists once someone has actually opened the Scorecard page.
  const trendEl=document.getElementById('d-health-trend');
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

  // Full Scorecard page isn't in VIEWER_PAGES — hide the deep-link for General Members.
  const scEl=document.getElementById('d-health-scorecard-link');
  if(scEl)scEl.style.display=isViewer?'none':'';

  const dimsEl=document.getElementById('d-health-dims');
  if(dimsEl){
    dimsEl.innerHTML=dims.map(d=>`<div class="d2-dim">
      <span class="d2-dim-lbl">${d.k}</span>
      <div class="d2-dim-bar"><div class="d2-dim-fill" data-w="${d.v}"></div></div>
      <span class="d2-dim-val">${d.v}%</span>
    </div>`).join('');
    setTimeout(()=>{dimsEl.querySelectorAll('[data-w]').forEach(b=>{b.style.transform='scaleX('+(b.dataset.w/100)+')';});},100);
  }
}

// ── INTELLIGENCE ALERTS ──
// isViewer (General Member) suppresses alerts that name individual members/assignees — same
// privacy stance as the Attendance Risk widget and renderAttendanceOwnOnly's Risk Stratification.
function dashBuildAlerts(avg,isViewer){
  const alerts=[];
  const ovT=D.tasks.filter(t=>isOv(t.dueDate)&&t.status!=='done');
  if(ovT.length&&!isViewer){
    const top=ovT.sort((a,b)=>({urgent:0,high:1,medium:2,low:3}[a.priority]||2)-({urgent:0,high:1,medium:2,low:3}[b.priority]||2))[0];
    alerts.push({type:'task',icon:'ti-clock',bg:'background:var(--am-bg)',ic:'color:var(--am-tx)',title:`${ovT.length} overdue task${ovT.length>1?'s':''}`,body:`Highest: "${top.title}", ${top.positionTitle||'Unassigned'}`});
  }
  // Aligned to the canonical ATT_LOW/ATT_WARN thresholds (65/75) — previously hardcoded to
  // 70 and 65-75 here, a third disagreeing threshold scheme from the rest of the app.
  const lowAtt=D.members.filter(m=>aR(m.id)<ATT_LOW);
  if(lowAtt.length&&!isViewer){
    alerts.push({type:'attendance',icon:'ti-alert-circle',bg:'background:var(--rd-bg)',ic:'color:var(--rd-tx)',title:`${lowAtt.length} member${lowAtt.length>1?'s':''} below ${ATT_LOW}% attendance`,body:`${lowAtt.slice(0,2).map(m=>m.name.split(' ')[0]).join(', ')}${lowAtt.length>2?` +${lowAtt.length-2} more`:''}`});
  }
  const probation=D.members.filter(m=>{const r=aR(m.id);return r>=ATT_LOW&&r<ATT_WARN;});
  if(probation.length&&!isViewer){
    alerts.push({type:'attendance',icon:'ti-alert-triangle',bg:'background:var(--am-bg)',ic:'color:var(--am-tx)',title:`${probation.length} member${probation.length>1?'s':''} nearing probation threshold`,body:probation.slice(0,2).map(m=>m.name.split(' ')[0]).join(', ')+(probation.length>2?' +'+(probation.length-2)+' more':'')+`, between ${ATT_LOW}–${ATT_WARN}%`});
  }
  const unassigned=sbFlatSlots().filter(s=>isUp(s.date)&&!s.memberId);
  if(unassigned.length){
    alerts.push({type:'sober',icon:'ti-shield-exclamation',bg:'background:var(--bl-bg)',ic:'color:var(--bl-tx)',title:`${unassigned.length} unassigned social monitor shift${unassigned.length>1?'s':''}`,body:`Next: ${fds(unassigned[0].date)} · Needs coverage`});
  }
  const openCases=D.cases.filter(c=>!['resolved','dismissed'].includes(c.status));
  if(openCases.length&&!isViewer&&jbCanAccess&&jbCanAccess()){
    alerts.push({type:'judicial',icon:'ti-scale',bg:'background:var(--rd-bg)',ic:'color:var(--rd-tx)',title:`${openCases.length} open Judicial Board case${openCases.length>1?'s':''}`,body:'Review required, view J-Board for details'});
  }
  if(avg<85){
    alerts.push({type:'attendance',icon:'ti-trending-down',bg:'background:#F1F3F6',ic:'color:var(--mt)',title:`Chapter attendance at ${avg}%, below 85% target`,body:'Update attendance records to stay accurate'});
  }

  const dotEl=document.getElementById('d-alerts-dot');
  if(dotEl){
    dotEl.style.background=alerts.length?'var(--rd)':'var(--gn)';
    if(alerts.length)dotEl.classList.add('active'); else dotEl.classList.remove('active');
  }

  const el=document.getElementById('d-alerts');
  if(!el)return;
  if(!alerts.length){
    el.innerHTML=`<div class="es-inline ok"><i class="ti ti-circle-check"></i>All clear, no active alerts</div>`;
    return;
  }
  el.innerHTML=alerts.slice(0,4).map(a=>`<div class="d-alert-row"><div class="d-alert-icon" style="${a.bg}"><i class="ti ${a.icon}" style="${a.ic}"></i></div><div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:500;line-height:1.4">${esc(a.title)}</div><div style="font-size:10.5px;color:var(--mt);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.body)}</div></div></div>`).join('');
}

// ── OVERDUE TASKS ──
function dashBuildOverdue(){
  const el=document.getElementById('d-overdue');if(!el)return;
  const ov=D.tasks.filter(t=>isOv(t.dueDate)&&t.status!=='done')
    .sort((a,b)=>({urgent:0,high:1,medium:2,low:3}[a.priority]||2)-({urgent:0,high:1,medium:2,low:3}[b.priority]||2));
  if(!ov.length){
    el.innerHTML=`<div class="es-inline ok"><i class="ti ti-circle-check"></i>No overdue tasks</div>`;
    return;
  }
  const pcl={urgent:'var(--rd)',high:'var(--rd)',medium:'var(--am)',low:'var(--mt)'};
  el.innerHTML=ov.slice(0,4).map(t=>{
    const daysOv=Math.round((new Date()-new Date(t.dueDate+'T12:00:00'))/(1000*86400));
    return`<div class="d-overdue-card" tabindex="0" role="button" onclick="openEditTask('${t.id}')" style="cursor:pointer">
      <div style="flex:1;min-width:0">
        <div style="font-size:11.5px;font-weight:600;color:var(--rd-tx);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div>
        <div style="font-size:10.5px;color:var(--rd-tx);opacity:.75">${daysOv}d overdue · ${esc(t.positionTitle||'Unassigned')} · <span style="font-weight:600;text-transform:capitalize">${esc(t.priority)}</span></div>
      </div>
      <button class="btn btn-d" style="height:23px;font-size:10px;padding:0 7px;flex-shrink:0" onclick="event.stopPropagation();toggleTask('${t.id}')"><i class="ti ti-check"></i>Done</button>
    </div>`;
  }).join('');
  if(ov.length>4)el.innerHTML+=`<div style="font-size:11px;color:var(--mt);text-align:center;padding:7px 0;cursor:pointer" onclick="rbacNav('tasks',null)">+${ov.length-4} more overdue tasks →</div>`;
}

// ── ATTENDANCE RISK ──
function dashBuildAttRisk(){
  const el=document.getElementById('d-att-risk');if(!el)return;
  const risk=D.members.map(m=>({m,r:aR(m.id)})).filter(x=>x.r<80).sort((a,b)=>mNameCompare(a.m,b.m));
  if(!risk.length){
    el.innerHTML=`<div class="es-inline ok"><i class="ti ti-circle-check"></i>All members above 80%</div>`;
    return;
  }
  const cat=r=>r<65?{label:'Warning',bg:'var(--rd-bg)',tc:'var(--rd-tx)'}:r<70?{label:'At Risk',bg:'var(--rd-bg)',tc:'var(--rd-tx)'}:r<75?{label:'Watch',bg:'var(--am-bg)',tc:'var(--am-tx)'}:{label:'Monitor',bg:'#F1F3F6',tc:'var(--mt)'};
  el.innerHTML=`<div style="font-size:10px;color:var(--mt);margin-bottom:8px">${risk.length} member${risk.length>1?'s':''} below 80%, ${risk.filter(x=>x.r<70).length} require attention</div>`+
    risk.slice(0,6).map(({m,r})=>{const c=cat(r);return`<div class="d-risk-row">
      <div class="sh-av" style="width:24px;height:24px;font-size:8px;background:${c.bg};color:${c.tc}">${m.initials}</div>
      <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div></div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:50px;height:5px;background:#F1F3F6;border-radius:99px;overflow:hidden"><div style="height:100%;width:${r}%;background:${r<70?'var(--rd)':'var(--am)'};border-radius:99px"></div></div>
        <span style="font-size:11px;font-weight:700;color:${r<70?'var(--rd)':'var(--am-tx)'};width:28px;text-align:right">${r}%</span>
      </div>
    </div>`;}).join('');
  if(risk.length>6)el.innerHTML+=`<div style="font-size:11px;color:var(--mt);text-align:center;padding:7px 0;cursor:pointer" onclick="rbacNav('attendance',null)">+${risk.length-6} more →</div>`;
}

// ── UPCOMING EVENTS WITH COUNTDOWN ──
function dashBuildEvents(){
  const el=document.getElementById('d-events');if(!el)return;
  const ups=D.events.filter(e=>isUp(e.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
  if(!ups.length){el.innerHTML=es('ti-calendar-off','blue','No upcoming events','Add events to the calendar.',`<button class="btn" onclick="openM('m-addevent')"><i class="ti ti-plus"></i>Add Event</button>`);return;}
  el.innerHTML=ups.map(e=>{
    const days=Math.max(0,Math.round((new Date(e.date+'T12:00:00')-new Date())/(1000*86400)));
    const cls=days===0?'urgent':days<=3?'soon':'';
    const cdLabel=days===0?'Today':days===1?'Tomorrow':`${days}d`;
    return`<div class="ev-row">
      <div class="ev-dt"><div class="ev-day">${dom(e.date)}</div><div class="ev-mo">${mos(e.date)}</div></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.title)}</div>
        <div style="font-size:10.5px;color:var(--mt);margin-top:1px">${to12h(e.start)||'TBD'}${e.endTime?'–'+to12h(e.endTime):''}${e.location?' · '+esc(e.location):''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
        <span class="d-countdown ${cls}"><i class="ti ti-clock" style="font-size:9px"></i>${cdLabel}</span>
        ${e.mandatory?'<span class="badge br2" style="font-size:8.5px">Required</span>':''}
      </div>
    </div>`;
  }).join('');
}

function renderAttendanceOwnOnly(){
  const attHd=document.getElementById('att-hd');if(attHd)attHd.textContent='My Attendance: '+getSemester();
  // Hide entire toolbar (tabs + action buttons) — viewer only sees their own row
  const toolbar=document.getElementById('att-toolbar');if(toolbar)toolbar.style.display='none';
  // Show only Members tab content; hide Analytics (privacy: Risk Stratification names other members) and Events
  ['att-analytics','att-events'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const membersTab=document.getElementById('att-members');if(membersTab)membersTab.style.display='block';

  const me=(typeof _myMemberRecord==='function')?_myMemberRecord():null;
  if(!me){
    document.getElementById('a-kpi').innerHTML=statStrip('My Attendance','N/A','No record linked','neutral')+statStrip('Events Attended','N/A','N/A','neutral')+statStrip('Standing','N/A','N/A','neutral')+statStrip('Threshold','75%','Chapter requirement','neutral');
    document.getElementById('a-table').innerHTML='<thead><tr><th>Member</th><th>Class</th><th>Attendance</th><th>Status</th></tr></thead><tbody><tr><td colspan="4" style="text-align:center;color:var(--mt);padding:14px;font-size:12px">No attendance record linked to your account yet. Contact an officer.</td></tr></tbody>';
    document.getElementById('a-mobile-cards').innerHTML='<div style="color:var(--ht);font-size:12px;padding:20px;text-align:center">No attendance record linked to your account yet. Contact an officer.</div>';
    return;
  }
  const r=aR(me.id);
  const evCount=Object.keys(D.attendance||{}).length;
  const present=Object.values(D.attendance||{}).filter(ev=>ev[me.id]==='present').length;
  // Shared attTier() (js/analytics.js) instead of an inline tier list — the previous version
  // here gave the 75-84% band the exact same label ("Good Standing") as 85%+, so the two tiers
  // were visually indistinguishable regardless of which one a member was actually in.
  const _t=attTier(r);
  const status=[_t.label,_t.badge];
  const col=r>=85?'var(--gn)':r>=75?'var(--navy)':r>=65?'var(--am)':'var(--rd)';
  document.getElementById('a-kpi').innerHTML=
    kpi('My Attendance',r+'%',getSemester(),r>=75?'up':'down')+
    kpi('Events Attended',present,'of '+evCount+' total','neutral')+
    kpi('Standing','<span class="badge '+status[1]+'">'+status[0]+'</span>',r>=75?'On track':'Below 75%','neutral')+
    kpi('Chapter Threshold','75%','Minimum required','neutral');
  document.getElementById('a-table').innerHTML=`<thead><tr><th>Member</th><th>Class</th><th>Attendance Rate</th><th>Status</th></tr></thead><tbody><tr><td><div style="display:flex;align-items:center;gap:7px"><div class="sh-av" style="width:25px;height:25px;font-size:8.5px;flex-shrink:0">${esc(me.initials)}</div><span style="font-weight:500">${esc(me.name)}</span></div></td><td style="color:var(--mt);font-size:11.5px">${esc(me.classYear||'N/A')}</td><td style="font-weight:500;color:${col}">${r}%</td><td><span class="badge ${status[1]}">${esc(status[0])}</span></td></tr></tbody>`;
  document.getElementById('a-mobile-cards').innerHTML=`<div class="mob-card card">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div class="sh-av" style="width:38px;height:38px;font-size:13px;flex-shrink:0">${esc(me.initials)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(me.name)}</div>
        <div style="font-size:11px;color:var(--mt)">${esc(me.classYear||'N/A')}</div>
      </div>
      <span class="badge ${status[1]}" style="font-size:9.5px;white-space:nowrap">${esc(status[0])}</span>
    </div>
    <div style="display:flex;align-items:center;gap:7px">
      <div style="flex:1;height:4px;background:var(--bdr);border-radius:2px;overflow:hidden"><div style="height:100%;width:${r}%;background:${col};border-radius:2px"></div></div>
      <span style="font-size:11px;font-weight:600;color:${col};min-width:32px;text-align:right">${r}%</span>
    </div>
  </div>`;
  updateBadges();
}

function renderAttendance(){
  if(typeof _attUpdateToolbar==='function')_attUpdateToolbar();
  if(CURRENT_USER&&CURRENT_USER.role==='viewer'){renderAttendanceOwnOnly();return;}
  const sem=ATT_SELECTED_SEM||getSemester();
  const range=semesterDateRange(sem);
  const semEvents=range?D.events.filter(e=>e.date>=range.start&&e.date<=range.end):D.events;
  const semEventIds=new Set(semEvents.map(e=>e.id));
  const tot=D.members.length;const avg=Math.round(D.members.reduce((s,m)=>s+aRForSemester(m.id,sem),0)/tot);
  const excused=Object.entries(D.attendance||{}).filter(([evId])=>semEventIds.has(evId)).reduce((s,[,ev])=>s+Object.values(ev).filter(v=>v==='excused').length,0);
  const absent=Object.entries(D.attendance||{}).filter(([evId])=>semEventIds.has(evId)).reduce((s,[,ev])=>s+Object.values(ev).filter(v=>v==='absent').length,0);
  const attHd=document.getElementById('att-hd');if(attHd)attHd.textContent='Member Attendance: '+sem;
  document.getElementById('a-kpi').innerHTML=statStrip('Semester avg',avg+'%',sem,avg>=85?'up':'down')+statStrip('Excused Misses',excused,sem+' total','neutral')+statStrip('Unexcused Misses',absent,sem+' total',absent>20?'down':'neutral')+statStrip('Warnings issued',D.members.filter(m=>aRForSemester(m.id,sem)<75).length,'Below 75%',D.members.filter(m=>aRForSemester(m.id,sem)<75).length>0?'down':'neutral');
  document.getElementById('a-table').innerHTML=`<thead><tr><th>Member</th><th>Class</th><th>Attendance Rate</th><th>Status</th><th></th></tr></thead><tbody>${D.members.length?sortedMembers().map(m=>{const r=aRForSemester(m.id,sem);const t=attTier(r);return`<tr><td><div style="display:flex;align-items:center;gap:7px"><div class="sh-av" style="width:25px;height:25px;font-size:8.5px;flex-shrink:0">${esc(m.initials)}</div><span style="font-weight:500">${esc(m.name)}</span></div></td><td style="color:var(--mt);font-size:11.5px">${esc(m.classYear)}</td><td style="font-weight:500;color:${t.color}">${r}%</td><td><span class="badge ${t.badge}">${t.label}</span></td><td><button class="btn" style="height:23px;font-size:10.5px" aria-label="Edit ${esc(m.name)}" onclick="openEditMember('${m.id}')"><i class="ti ti-pencil"></i></button></td></tr>`;}).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--mt);padding:14px;font-size:12px">No members yet. Add members to start tracking attendance.</td></tr>'}</tbody>`;
  document.getElementById('a-mobile-cards').innerHTML=D.members.length?sortedMembers().map(m=>{
    const r=aRForSemester(m.id,sem);const t=attTier(r);
    return`<div class="mob-card card clickable" tabindex="0" role="button" aria-label="Edit ${esc(m.name)}" onclick="openEditMember('${m.id}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="sh-av" style="width:38px;height:38px;font-size:13px;flex-shrink:0">${esc(m.initials)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
          <div style="font-size:11px;color:var(--mt)">${esc(m.classYear)}</div>
        </div>
        <span class="badge ${t.badge}" style="font-size:9.5px;white-space:nowrap">${t.label}</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px">
        <div style="flex:1;height:4px;background:var(--bdr);border-radius:2px;overflow:hidden"><div style="height:100%;width:${r}%;background:${t.color};border-radius:2px"></div></div>
        <span style="font-size:11px;font-weight:600;color:${t.color};min-width:32px;text-align:right">${r}%</span>
      </div>
    </div>`;
  }).join(''):'<div style="color:var(--ht);font-size:12px;padding:20px;text-align:center">No members yet. Add members to start tracking attendance.</div>';
  // Attendance can be marked for a mandatory event any time — before it happens (e.g. pre-marking
  // a known absence) or after — so the only gates here are "is this event mandatory" and "is the
  // semester it falls in still editable," not whether the event date has already passed.
  document.getElementById('a-events').innerHTML=`<thead><tr><th>Event</th><th>Type</th><th>Date</th><th>Mandatory</th><th></th></tr></thead><tbody>${semEvents.length?semEvents.map(e=>`<tr><td style="font-weight:500">${esc(e.title)}</td><td><span class="badge" style="${evCS(e.type)}">${esc(e.type)}</span></td><td>${fd(e.date)}</td><td>${e.mandatory?'<span class="badge br2">Required</span>':'N/A'}</td><td>${e.mandatory&&isCurrentSemester(sem)?`<button class="btn" style="height:23px;font-size:10.5px" onclick="openMarkAttEv('${e.id}')"><i class="ti ti-checkbox"></i>Mark</button>`:'N/A'}</td></tr>`).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--mt);padding:14px;font-size:12px">No events yet. Create an event to start tracking attendance.</td></tr>'}</tbody>`;
  const evMobEl=document.getElementById('a-events-mobile-cards');
  if(evMobEl)evMobEl.innerHTML=semEvents.length?semEvents.map(e=>`<div class="mob-card card">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
      <div style="font-weight:600;font-size:13px">${esc(e.title)}</div>
      ${e.mandatory?'<span class="badge br2" style="flex-shrink:0">Required</span>':''}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:${e.mandatory&&isCurrentSemester(sem)?'10px':'0'}">
      <span class="badge" style="${evCS(e.type)}">${esc(e.type)}</span>
      <span style="font-size:11px;color:var(--mt)">${fd(e.date)}</span>
    </div>
    ${e.mandatory&&isCurrentSemester(sem)?`<button class="btn" style="height:26px;font-size:11px;width:100%" onclick="openMarkAttEv('${e.id}')"><i class="ti ti-checkbox"></i>Mark Attendance</button>`:''}
  </div>`).join(''):'<div style="grid-column:1/-1;color:var(--ht);font-size:12px;padding:20px;text-align:center">No events yet. Create an event to start tracking attendance.</div>';
  attRenderAnalytics();
  updateBadges();
}

// ── TAB SWITCHER ──
function attTab(btn,tabId){
  document.querySelectorAll('.att-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  ['att-analytics','att-members','att-events'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.display=id===tabId?'':'none';
  });
  if(tabId==='att-analytics')attRenderAnalytics();
}


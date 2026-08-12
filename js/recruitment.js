// ═══════════════════════════════════════════
// RECRUITMENT CRM
// ═══════════════════════════════════════════

const RC_STAGES=['New Lead','Contacted','Attended Event','Active Rush','Interviewed','Bid Ready','Bid Extended','Accepted'];
const RC_STAGE_COLORS=['#4FB6EC','#4FB6EC','#F5A623','#22C55E','#7b5ea7','#F0554A','#D6AD4E','#22C55E'];
const RC_TAGS=['Athlete','Legacy','Leadership','Good Fit','Needs Follow-up','Academics','Social Fit','Hot Prospect','Greek Life','Community'];
const RC_TAG_CLASSES={Athlete:'athlete',Legacy:'legacy',Leadership:'leader','Hot Prospect':'hot','Good Fit':'active','Needs Follow-up':'dnb'};

let RC_DRAG_ID=null;
let RC_ACTIVE_TAB='rc-overview';
let RC_SELECTED_SEM=null;
function rcSem(){ return RC_SELECTED_SEM||getSemester(); }

// Rushees have no natural date field (no "date added to pipeline" — see rcAddRushee, which now
// stamps one), so known semesters come purely from whatever .semester values already exist plus
// the goal's own semester keys — unlike Attendance/Community Service, which can derive from real
// event/log dates instead.
function rcKnownSemesters(){
  return unionKnownSemesters([...(D.recruitment.rushees||[]).map(r=>r.semester),...Object.keys(D.recruitment.goal||{})].filter(Boolean));
}
function rcSemesterChanged(){
  RC_SELECTED_SEM=document.getElementById('rc-semester-select').value;
  if(RC_ACTIVE_TAB==='rc-overview')rcRenderOverview();
  else if(RC_ACTIVE_TAB==='rc-rushees')rcRenderTable();
  else if(RC_ACTIVE_TAB==='rc-pipeline')rcRenderKanban();
  else if(RC_ACTIVE_TAB==='rc-events')rcRenderEvents();
}
// Rushees created before this feature shipped have no .semester at all — treated as belonging
// to whichever semester is currently selected (never hidden), same "don't vanish" fallback used
// for Tasks & Goals.
function rcVisibleRushees(){
  const sem=rcSem();
  return (D.recruitment.rushees||[]).filter(r=>!r.semester||r.semester===sem);
}
// One-time migration: the recruitment goal used to be one flat {target,label} object — wrap it
// into the current semester's slot the first time it's encountered, mirroring finance.js's
// finEnsureDuesMigrated() for the exact same reason (don't lose an already-set goal).
function rcEnsureGoalMigrated(){
  const g=D.recruitment.goal;
  if(g&&('target' in g)){
    D.recruitment.goal={[getSemester()]:g};
  }
}

function rcOpenGoalEdit(){
  const g=(D.recruitment.goal||{})[rcSem()]||{target:20,label:'New Members This Semester'};
  document.getElementById('rcg-label').value=g.label||'New Members This Semester';
  document.getElementById('rcg-target').value=g.target||20;
  openM('m-rc-goal');
}
function rcSaveGoal(){
  if(!canEditPage('recruitment')){toast('You do not have permission to edit the recruitment goal.','error');return;}
  if(!isCurrentSemester(rcSem())){toast('This semester is read-only.','error');return;}
  const target=parseInt(document.getElementById('rcg-target').value);
  const label=document.getElementById('rcg-label').value.trim()||'New Members This Semester';
  if(!target||target<1){toast('Enter a valid target','error');return;}
  if(!D.recruitment.goal)D.recruitment.goal={};
  if(!D.recruitment.goal[rcSem()])D.recruitment.goal[rcSem()]={};
  D.recruitment.goal[rcSem()].target=target;
  D.recruitment.goal[rcSem()].label=label;
  saveD('recruitment');
  closeM(null,document.getElementById('m-rc-goal'));
  renderRecruitment();
  toast('Recruitment goal updated','success');
}

// ── BID SCORE HELPERS ──
function rcScoreBadge(score){
  if(score>=85)return{cls:'hot',label:'Strong Bid'};
  if(score>=70)return{cls:'good',label:'Possible Bid'};
  if(score>=50)return{cls:'mid',label:'Needs Eval'};
  if(score>=30)return{cls:'low',label:'Monitor'};
  return{cls:'dnb',label:'Do Not Bid'};
}
function rcScoreEl(score){const b=rcScoreBadge(score);return`<span class="rc-score ${b.cls}">${score}</span>`;}
function rcStageColor(stage){const i=RC_STAGES.indexOf(stage);return RC_STAGE_COLORS[i]||'#9CA3AF';}
function rcStageBadgeStyle(stage){return`background:${rcStageColor(stage)}22;color:${rcStageColor(stage)};font-size:9.5px;font-weight:600;padding:2px 8px;border-radius:99px`;}

// ── TAB SWITCHER ──
function rcTab(btn,tabId){
  document.querySelectorAll('.rc-tab').forEach(t=>t.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('#page-recruitment > div[id^="rc-"]').forEach(d=>{
    if(d.id==='rc-tabs-bar')return; // never hide the tab bar
    d.style.display='none';
  });
  const el=document.getElementById(tabId);if(el)el.style.display='block';
  RC_ACTIVE_TAB=tabId;
  if(tabId==='rc-overview')rcRenderOverview();
  if(tabId==='rc-rushees')rcRenderTable();
  if(tabId==='rc-pipeline')rcRenderKanban();
  if(tabId==='rc-events')rcRenderEvents();
}

// ── MAIN RENDER ──
async function renderRecruitment(){
  await rcMigrateLegacyEvents();
  rcEnsureGoalMigrated();
  if(!RC_SELECTED_SEM)RC_SELECTED_SEM=getSemester();
  initSemesterSelect('rc-semester-select',rcKnownSemesters(),rcSemesterChanged,RC_SELECTED_SEM);
  // Reset to overview tab
  document.querySelectorAll('.rc-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  document.querySelectorAll('#page-recruitment > div[id^="rc-"]').forEach(d=>{
    if(d.id==='rc-tabs-bar')return;
    d.style.display=d.id==='rc-overview'?'block':'none';
  });
  RC_ACTIVE_TAB='rc-overview';
  // "Add Rushee"/"Add Rush Event" only make sense for editors on the CURRENT semester — a
  // view-only grant (e.g. Treasurer, who can see the CRM but not touch it), or a past semester
  // being viewed, would otherwise show a fully clickable button that just errors on save, which
  // reads as broken rather than as "no access."
  const canEdit=canEditPage('recruitment')&&isCurrentSemester(RC_SELECTED_SEM);
  ['rc-add-btn','rc-add-btn-2','rc-event-add-btn'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.display=canEdit?'':'none';
  });
  rcRenderOverview();
}

// ── OVERVIEW ──
function rcRenderOverview(){
  const rushees=rcVisibleRushees();
  const hot=rushees.filter(r=>r.bidScore>=70).length;
  const bidReady=rushees.filter(r=>['Bid Ready','Bid Extended','Accepted'].includes(r.stage)).length;
  const totalEvAtt=rushees.reduce((s,r)=>s+r.eventsAttended,0);
  const RCG=(D.recruitment.goal||{})[rcSem()]||{target:20,label:'New Members This Semester'};
  document.getElementById('rc-kpi').innerHTML=
    statStrip('Total Rushees',rushees.length,`${rushees.length} of ${RCG.target} goal`,rushees.length>=RCG.target?'up':'neutral')+
    statStrip('Hot Prospects',hot,'Score 70+',hot>0?'up':'neutral')+
    statStrip('Event Attendances',totalEvAtt,'Across all rushees','neutral')+
    statStrip('Bid Ready',bidReady,'Ready to extend',bidReady>0?'up':'neutral');

  rcDrawFunnel(rushees);
  rcDrawConversion(rushees);
  rcDrawAlerts(rushees);
  rcDrawUpcomingEvents();
  rcDrawQuality(rushees);
  rcDrawGoal(rushees, RCG);
}

// ── FUNNEL: horizontal SVG ──
function rcDrawFunnel(rushees){
  const el=document.getElementById('rc-funnel-wrap');
  const totEl=document.getElementById('rc-funnel-total');
  if(!el)return;
  const stageCounts=RC_STAGES.map((s,i)=>({stage:s,count:rushees.filter(r=>r.stage===s).length,col:RC_STAGE_COLORS[i]}));
  if(totEl)totEl.textContent=rushees.length+' total rushees';

  // Build visual funnel as stacked horizontal bars with stage labels
  const total=rushees.length||1;
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:4px;padding:4px 0">
    ${stageCounts.map((s,i)=>{
      const pct=Math.round(s.count/total*100);
      const prev=i>0?stageCounts[i-1].count:null;
      const convRate=prev&&prev>0?Math.round(s.count/prev*100):null;
      const barW=Math.max(10,Math.round(s.count/total*100));
      return`<div class="rc-hfunnel-row" tabindex="0" role="button" onclick="rcFilterToStage('${s.stage}')" title="${s.stage}: ${s.count} rushees">
        <div class="rc-hfunnel-label">${s.stage}</div>
        <div class="rc-hfunnel-track">
          <div class="rc-hfunnel-fill" style="width:0%;background:${s.col}" data-w="${barW}">
            <span class="rc-hfunnel-count">${s.count}</span>
          </div>
        </div>
        <div class="rc-hfunnel-meta">
          ${convRate!==null?`<span class="rc-hfunnel-conv" style="color:${convRate>=50?'var(--gn-tx)':convRate>=25?'var(--am-tx)':'var(--rd-tx)'}">↓ ${convRate}%</span>`:'<span style="font-size:9.5px;color:var(--ht)">N/A</span>'}
          <span class="rc-hfunnel-pct">${pct}%</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
  setTimeout(()=>el.querySelectorAll('[data-w]').forEach(b=>{b.style.width=b.dataset.w+'%';}),60);
}

// ── STAGE CONVERSION RATES ──
function rcDrawConversion(rushees){
  const el=document.getElementById('rc-conversion');if(!el)return;
  if(!rushees.length){el.innerHTML=`<div style="color:var(--ht);font-size:12px;padding:14px 0;text-align:center">No rushees yet.</div>`;return;}
  const pairs=[];
  for(let i=0;i<RC_STAGES.length-1;i++){
    const from=rushees.filter(r=>RC_STAGES.indexOf(r.stage)>=i).length;
    const to=rushees.filter(r=>RC_STAGES.indexOf(r.stage)>=i+1).length;
    if(from===0)continue;
    const rate=Math.round(to/from*100);
    pairs.push({from:RC_STAGES[i],to:RC_STAGES[i+1],rate,fromN:from,toN:to});
  }
  el.innerHTML=pairs.map(p=>{
    const col=p.rate>=60?'var(--gn)':p.rate>=35?'var(--am)':'var(--rd)';
    return`<div style="display:flex;align-items:center;gap:7px;padding:3px 0">
      <div style="font-size:10px;color:var(--mt);width:80px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${p.from} → ${p.to}">${p.from} <i class="ti ti-arrow-right" style="font-size:9px"></i></div>
      <div style="flex:1;height:12px;background:#F1F3F6;border-radius:3px;overflow:hidden">
        <div style="height:100%;background:${col};border-radius:3px;width:100%;transform-origin:0 0;transform:scaleX(0);transition:transform .65s ease" data-w="${p.rate}"></div>
      </div>
      <span style="font-size:10.5px;font-weight:700;color:${col};width:28px;text-align:right">${p.rate}%</span>
    </div>`;
  }).join('');
  setTimeout(()=>el.querySelectorAll('[data-w]').forEach(b=>{b.style.transform='scaleX('+(b.dataset.w/100)+')';}),80);
}

// Rush events live in the shared D.events calendar (type:'recruitment'), same pattern as
// Chaplain Hub's Brotherhood Events (js/ritual.js's chEvents()) — so scheduling one here always
// shows up on the Calendar too, and editing/deleting from either place is the same record instead
// of two stores that could drift apart. The rush-event-specific "type" dropdown (Open House, Rush
// Dinner, etc.) rides along inline as rcEventType, distinct from the shared type:'recruitment'
// calendar category.
function rcEvents(){ return (D.events||[]).filter(e=>e.type==='recruitment'); }

// One-time migration: rush events used to live in their own D.recruitment.events array before
// this shared-storage model existed. Moves anything still sitting there into D.events and clears
// the old array — a no-op on every render after the first successful save for a given chapter.
async function rcMigrateLegacyEvents(){
  const legacy=D.recruitment.events||[];
  if(!legacy.length)return;
  const migrated=legacy.map(e=>({id:uid(),title:e.name,type:'recruitment',rcEventType:e.type,date:e.date,endDate:e.date,start:e.time,location:e.location,mandatory:false,notes:e.notes||''}));
  const prevEventsLen=D.events.length;
  const prevLegacy=D.recruitment.events;
  D.events.push(...migrated);
  D.recruitment.events=[];
  try{
    await saveD('recruitment','events');
  }catch(err){
    D.events.length=prevEventsLen;
    D.recruitment.events=prevLegacy;
    toast('Could not migrate legacy rush events. Please try again.','error');
  }
}

// ── ALERTS ──
function rcDrawAlerts(rushees){
  const alertsEl=document.getElementById('rc-alerts');if(!alertsEl)return;
  const alerts=[];
  const stale=rushees.filter(r=>{if(!r.lastContact)return r.stage!=='New Lead';const days=Math.round((new Date()-new Date(r.lastContact+'T12:00:00'))/(86400000));return days>5&&!['Accepted','Bid Extended'].includes(r.stage);});
  if(stale.length)alerts.push({icon:'ti-clock',bg:'background:var(--am-bg)',ic:'color:var(--am-tx)',title:`${stale.length} not contacted in 5+ days`,body:stale.slice(0,2).map(r=>esc(r.name)).join(', ')+(stale.length>2?` +${stale.length-2} more`:'')});
  const br=rushees.filter(r=>r.stage==='Bid Ready');
  if(br.length)alerts.push({icon:'ti-star',bg:'background:var(--gn-bg)',ic:'color:var(--gn-tx)',title:`${br.length} rushee${br.length>1?'s':''} Bid Ready`,body:br.map(r=>esc(r.name)).join(', ')});
  const nextEv=rcEvents().filter(e=>isUp(e.date)).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(nextEv){const days=Math.round((new Date(nextEv.date+'T12:00:00')-new Date())/86400000);if(days<=2)alerts.push({icon:'ti-calendar-event',bg:'background:var(--bl-bg)',ic:'color:var(--bl-tx)',title:`"${esc(nextEv.title)}" ${days===0?'is today':days===1?'is tomorrow':'in '+days+' days'}`,body:to12h(nextEv.start)+(nextEv.location?' · '+esc(nextEv.location):'')});}
  const newNoContact=rushees.filter(r=>r.stage==='New Lead'&&!r.lastContact);
  if(newNoContact.length)alerts.push({icon:'ti-user-question',bg:'background:var(--rd-bg)',ic:'color:var(--rd-tx)',title:`${newNoContact.length} new lead${newNoContact.length>1?'s':''} never contacted`,body:'Assign recruiters and start conversations'});
  alertsEl.innerHTML=alerts.length?alerts.map(a=>`<div class="d-alert-row"><div class="d-alert-icon" style="${a.bg}"><i class="ti ${a.icon}" style="${a.ic}"></i></div><div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:500;line-height:1.4">${a.title}</div><div style="font-size:10.5px;color:var(--mt);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.body}</div></div></div>`).join(''):`<div style="padding:16px;text-align:center;color:var(--mt);font-size:11.5px"><i class="ti ti-circle-check" style="color:var(--gn);font-size:18px;display:block;margin:0 auto 5px"></i>No urgent alerts</div>`;
}

// ── UPCOMING EVENTS ──
function rcDrawUpcomingEvents(){
  const upEvEl=document.getElementById('rc-upcoming-events');if(!upEvEl)return;
  const upEv=rcEvents().filter(e=>isUp(e.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  upEvEl.innerHTML=upEv.length?upEv.map(e=>{const days=Math.max(0,Math.round((new Date(e.date+'T12:00:00')-new Date())/86400000));const cls=days===0?'urgent':days<=3?'soon':'';return`<div class="ev-row"><div class="ev-dt"><div class="ev-day">${dom(e.date)}</div><div class="ev-mo">${mos(e.date)}</div></div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.title)}</div><div style="font-size:10.5px;color:var(--mt)">${to12h(e.start)}${e.location?' · '+esc(e.location):''}</div></div><span class="d-countdown ${cls}"><i class="ti ti-clock" style="font-size:9px"></i>${days===0?'Today':days===1?'Tomorrow':days+'d'}</span></div>`;}).join(''):es('ti-calendar-off','blue','No rush events scheduled','Add upcoming rush events.',canEditPage('recruitment')?`<button class="btn" onclick="rcOpenAddEvent()"><i class="ti ti-plus"></i>Add Event</button>`:'');
}

// ── PROSPECT QUALITY: BID SCORE DISTRIBUTION ──
function rcDrawQuality(rushees){
  const el=document.getElementById('rc-quality');if(!el)return;
  if(!rushees.length){el.innerHTML=`<div style="color:var(--ht);font-size:12px;padding:14px 0;text-align:center">No rushees yet.</div>`;return;}
  const tiers=[
    {label:'Strong Bid',sub:'85+',min:85,c:'#22C55E'},
    {label:'Possible Bid',sub:'70–84',min:70,c:'#4FB6EC'},
    {label:'Needs Eval',sub:'50–69',min:50,c:'#F5A623'},
    {label:'Monitor',sub:'30–49',min:30,c:'#9b59b6'},
    {label:'Do Not Bid',sub:'<30',min:0,c:'#F0554A'},
  ];
  const tot=rushees.length;
  const avgScore=Math.round(rushees.reduce((s,r)=>s+(r.bidScore||0),0)/tot);
  el.innerHTML=`<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:11px">
    <span style="font-size:24px;font-weight:700;color:var(--tx)">${avgScore}</span>
    <span style="font-size:11px;color:var(--mt)">avg bid score</span>
  </div>`+tiers.map(t=>{
    const n=rushees.filter(r=>{const s=r.bidScore||0;return s>=t.min&&(t===tiers[tiers.length-1]||s<tiers[tiers.indexOf(t)-1]?.min+100);}).length;
    // Recompute cleanly by building buckets
    return{t,n};
  }).map(({t})=>{
    const maxMin=tiers[tiers.indexOf(t)-1]?.min||101;
    const n=rushees.filter(r=>{const s=r.bidScore||0;return s>=t.min&&s<maxMin;}).length;
    const pct=Math.round(n/tot*100);
    return`<div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
        <span style="font-size:11px;font-weight:500">${t.label} <span style="font-size:9.5px;color:var(--ht)">${t.sub}</span></span>
        <span style="font-size:10.5px;font-weight:600;color:${t.c}">${n}</span>
      </div>
      <div style="height:7px;background:#F1F3F6;border-radius:99px;overflow:hidden">
        <div style="height:100%;background:${t.c};border-radius:99px;width:100%;transform-origin:0 0;transform:scaleX(0);transition:transform .6s ease" data-w="${pct}"></div>
      </div>
    </div>`;
  }).join('');
  setTimeout(()=>el.querySelectorAll('[data-w]').forEach(b=>{b.style.transform='scaleX('+(b.dataset.w/100)+')';}),80);
}

// ── GOAL PANEL ──
function rcDrawGoal(rushees, RCG){
  const el=document.getElementById('rc-goal-panel');if(!el)return;
  const editBtn=document.getElementById('rc-goal-edit-btn');
  if(editBtn)editBtn.style.display=(canEditPage('recruitment')&&isCurrentSemester(rcSem()))?'':'none';
  const accepted=rushees.filter(r=>r.stage==='Accepted').length;
  const bidExt=rushees.filter(r=>r.stage==='Bid Extended').length;
  const bidReady=rushees.filter(r=>r.stage==='Bid Ready').length;
  const pct=Math.min(100,Math.round(rushees.length/RCG.target*100));
  const closePct=Math.min(100,Math.round((accepted+bidExt)/RCG.target*100));

  // Number capped at the system's 26px Headline max (DESIGN.md: no larger display tier exists) —
  // was 32px, the same over-scale mistake fixed elsewhere. Sub-stats are divided list rows now,
  // not three separately-boxed chips, so the panel doesn't nest card-like surfaces inside a card.
  el.innerHTML=`
    <div style="text-align:center;margin-bottom:14px;padding:12px;background:radial-gradient(140% 160% at 0% 0%,rgba(214,173,78,.16) 0%,transparent 50%),linear-gradient(135deg,var(--surf2) 0%,var(--bg) 100%);border:1px solid var(--bdr2);border-radius:10px;color:var(--tx)">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.7;margin-bottom:4px">${esc(RCG.label)}</div>
      <div style="font-size:26px;font-weight:700;line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums">${rushees.length}<span style="font-size:13px;opacity:.6"> / ${RCG.target}</span></div>
      <div style="height:5px;background:rgba(0,0,0,.08);border-radius:99px;overflow:hidden;margin:8px 0 5px">
        <div style="height:100%;background:var(--gold);border-radius:99px;width:100%;transform-origin:left;transform:scaleX(${pct/100});transition:transform .7s ease"></div>
      </div>
      <div style="font-size:10px;opacity:.75">${pct}% of goal · ${Math.max(0,RCG.target-rushees.length)} to go</div>
    </div>
    <div>
      ${[
        {label:'Accepted',n:accepted,c:'var(--gn)',icon:'ti-check'},
        {label:'Bid Extended',n:bidExt,c:'var(--bl)',icon:'ti-mail'},
        {label:'Bid Ready',n:bidReady,c:'var(--am)',icon:'ti-star'},
      ].map(s=>`<div class="rc-stat">
        <span style="display:flex;align-items:center;gap:8px;color:var(--tx)"><i class="ti ${s.icon}" style="font-size:12px;color:${s.c}"></i>${s.label}</span>
        <span style="font-weight:700;color:${s.c}">${s.n}</span>
      </div>`).join('')}
    </div>`;
}

// ── RUSHEE TABLE ──
function rcFilterToStage(stage){
  rcTab(document.querySelector('[data-tab="rc-rushees"]'),'rc-rushees');
  setTimeout(()=>{document.getElementById('rc-filter-status').value=stage;rcFilterRushees();},50);
}

function rcRenderTable(){
  const rushees=rcGetFiltered();
  const el=document.getElementById('rc-table');
  if(!el)return;
  const canEdit=canEditPage('recruitment');
  const scoreTip='Reflects event attendance, engagement, and stage progress';
  // The whole row already opens the profile (role="button" below) — no separate trailing view
  // button duplicating that, same fix applied to Members/Finance's row-clickable tables.
  el.innerHTML=`<thead><tr><th>Name</th><th>Year</th><th>Major</th><th>Recruiter</th><th>Stage</th><th>Events</th><th>Score</th><th>Last Contact</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${rushees.map(r=>{
    const recName=r.recruiter?mB(r.recruiter).name.split(' ')[0]:'N/A';
    const daysSince=r.lastContact?Math.round((new Date()-new Date(r.lastContact+'T12:00:00'))/86400000):null;
    const contactColor=daysSince===null?'var(--ht)':daysSince>7?'var(--rd)':daysSince>4?'var(--am)':'var(--gn)';
    return`<tr style="cursor:pointer" tabindex="0" role="button" aria-label="Open ${esc(r.name)}" onclick="rcOpenProfile('${r.id}')">
      <td><div style="display:flex;align-items:center;gap:7px"><div class="sh-av" style="width:24px;height:24px;font-size:8.5px">${esc(r.initials)}</div><span style="font-weight:500">${esc(r.name)}</span></div></td>
      <td style="color:var(--mt)">${esc(r.year)}</td>
      <td style="color:var(--mt);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.major)}</td>
      <td style="color:var(--mt)">${esc(recName)}</td>
      <td><span style="${rcStageBadgeStyle(r.stage)}">${esc(r.stage)}</span></td>
      <td style="text-align:center">${r.eventsAttended}</td>
      <td title="${scoreTip}">${rcScoreEl(r.bidScore)}</td>
      <td style="color:${contactColor};font-size:11px">${r.lastContact?daysSince+'d ago':'Never'}</td>
      ${canEdit?`<td><button class="btn btn-d" style="height:23px;font-size:10px;padding:0 7px" onclick="event.stopPropagation();deleteRushee('${r.id}')" aria-label="Delete ${esc(r.name)}"><i class="ti ti-trash"></i></button></td>`:''}
    </tr>`;
  }).join('')||`<tr><td colspan="${canEdit?9:8}" style="text-align:center;padding:22px;color:var(--mt)">No rushees found</td></tr>`}</tbody>`;

  const mobEl=document.getElementById('rc-mobile-cards');
  if(mobEl)mobEl.innerHTML=rushees.map(r=>{
    const recName=r.recruiter?mB(r.recruiter).name.split(' ')[0]:'Unassigned';
    const daysSince=r.lastContact?Math.round((new Date()-new Date(r.lastContact+'T12:00:00'))/86400000):null;
    const contactColor=daysSince===null?'var(--ht)':daysSince>7?'var(--rd)':daysSince>4?'var(--am)':'var(--gn)';
    return`<div class="mob-card card clickable" tabindex="0" role="button" aria-label="Open ${esc(r.name)}" onclick="rcOpenProfile('${r.id}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="sh-av" style="width:38px;height:38px;font-size:13px;flex-shrink:0">${esc(r.initials)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div>
          <div style="font-size:11px;color:var(--mt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.year)} · ${esc(r.major)}</div>
        </div>
        <span title="${scoreTip}">${rcScoreEl(r.bidScore)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="${rcStageBadgeStyle(r.stage)}">${esc(r.stage)}</span></div>
      <div style="font-size:11px;color:var(--mt)">${r.eventsAttended} event${r.eventsAttended!==1?'s':''} · ${esc(recName)} · <span style="color:${contactColor}">${r.lastContact?daysSince+'d ago':'Never contacted'}</span></div>
    </div>`;
  }).join('')||`<div style="grid-column:1/-1;color:var(--ht);font-size:12px;padding:20px;text-align:center">No rushees found</div>`;
}

function rcGetFiltered(){
  const q=(document.getElementById('rc-search')||{value:''}).value.toLowerCase();
  const st=(document.getElementById('rc-filter-status')||{value:''}).value;
  const sort=(document.getElementById('rc-sort')||{value:'score'}).value;
  let rushees=rcVisibleRushees();
  if(q)rushees=rushees.filter(r=>r.name.toLowerCase().includes(q)||r.major.toLowerCase().includes(q)||r.hometown.toLowerCase().includes(q));
  if(st)rushees=rushees.filter(r=>r.stage===st);
  if(sort==='score')rushees.sort((a,b)=>b.bidScore-a.bidScore);
  else if(sort==='name')rushees.sort((a,b)=>a.name.localeCompare(b.name));
  else if(sort==='last')rushees.sort((a,b)=>(b.lastContact||'').localeCompare(a.lastContact||''));
  else if(sort==='events')rushees.sort((a,b)=>b.eventsAttended-a.eventsAttended);
  return rushees;
}

function rcFilterRushees(){rcRenderTable();}

// ── KANBAN ──
function rcRenderKanban(){
  const KANBAN_STAGES=['New Lead','Contacted','Active Rush','Interviewed','Bid Ready','Bid Extended'];
  const kanban=document.getElementById('rc-kanban');
  if(!kanban)return;
  const stageColors={};
  RC_STAGES.forEach((s,i)=>{stageColors[s]=RC_STAGE_COLORS[i];});
  const semRushees=rcVisibleRushees();
  const scoreTip='Reflects event attendance, engagement, and stage progress';
  kanban.innerHTML=KANBAN_STAGES.map(stage=>{
    const rushees=semRushees.filter(r=>r.stage===stage);
    const col=stageColors[stage]||'#9CA3AF';
    return`<div class="rc-col">
      <div class="rc-col-head" style="border-top-color:${col}">
        <span style="font-size:11.5px;font-weight:500">${stage}</span>
        <span class="rc-col-count">${rushees.length}</span>
      </div>
      <div class="rc-col-body rc-col-drop" id="kd-${stage.replace(/ /g,'_')}"
        ondragover="event.preventDefault();this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="rcDrop(event,'${stage}')">
        ${rushees.map(r=>{
          const recruiterChip=r.recruiter
            ?`<span class="sh-av" style="width:14px;height:14px;font-size:6px;flex-shrink:0">${esc(mB(r.recruiter).initials)}</span><span>${esc(mB(r.recruiter).name.split(' ')[0])}</span>`
            :`<i class="ti ti-user-question" style="font-size:10px;color:var(--am-tx)"></i><span style="color:var(--am-tx)">Unassigned</span>`;
          return`<div class="rc-card" draggable="${canEditPage('recruitment')&&isCurrentSemester(rcSem())}" id="kc-${r.id}" tabindex="0" role="button" aria-label="Open ${esc(r.name)}"
          ondragstart="rcDragStart('${r.id}')"
          ondragend="document.querySelectorAll('.rc-col-drop').forEach(c=>c.classList.remove('drag-over'))"
          onclick="rcOpenProfile('${r.id}')">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:5px">
            <div style="display:flex;align-items:center;gap:6px;min-width:0">
              <div class="sh-av" style="width:22px;height:22px;font-size:8px;flex-shrink:0">${esc(r.initials)}</div>
              <span style="font-size:12px;font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</span>
            </div>
            <span title="${scoreTip}">${rcScoreEl(r.bidScore)}</span>
          </div>
          <div style="font-size:10.5px;color:var(--mt);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.year)} · ${esc(r.major)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
            <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--ht);min-width:0;overflow:hidden;white-space:nowrap">
              <span style="flex-shrink:0">${r.eventsAttended} ev ·</span>
              ${recruiterChip}
            </div>
            ${r.tags.length?`<span class="rc-tag ${RC_TAG_CLASSES[r.tags[0]]||''}" style="font-size:9px;flex-shrink:0">${esc(r.tags[0])}</span>`:''}
          </div>
        </div>`;
        }).join('')||`<div class="rc-col-empty">Drop here</div>`}
      </div>
    </div>`;
  }).join('');
}

function rcDragStart(id){RC_DRAG_ID=id;}
function rcDrop(event,stage){
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if(!canEditPage('recruitment')){toast('You do not have permission to move rushees.','error');return;}
  if(!isCurrentSemester(rcSem())){toast('This semester is read-only.','error');return;}
  if(!RC_DRAG_ID)return;
  const r=D.recruitment.rushees.find(x=>x.id===RC_DRAG_ID);
  if(r&&r.stage!==stage){
    r.stage=stage;
    // Recalculate bid score when moving stages
    const baseScores={'New Lead':10,'Contacted':25,'Attended Event':45,'Active Rush':60,'Interviewed':72,'Bid Ready':82,'Bid Extended':88,'Accepted':92};
    if(baseScores[stage])r.bidScore=Math.max(r.bidScore,baseScores[stage]);
    r.lastContact=localDateStr();
    saveD('recruitment');rcRenderKanban();
    toast(r.name+' moved to '+stage,'success');
  }
  RC_DRAG_ID=null;
}

// ── RUSH EVENTS ──
function rcRenderEvents(){
  const sem=rcSem();
  const range=semesterDateRange(sem);
  const events=rcEvents().filter(e=>!range||(e.date>=range.start&&e.date<=range.end));
  const total=events.length;
  const upcoming=events.filter(e=>isUp(e.date)).length;
  const past=events.filter(e=>!isUp(e.date)).length;
  document.getElementById('rc-event-kpi').innerHTML=
    statStrip('Total Events',total,sem,'neutral')+
    statStrip('Upcoming',upcoming,'Scheduled','neutral')+
    statStrip('Completed',past,'Past events','neutral');
  // Fixed set of event types (not a customizable categorical system) — 'Invite Only'/'Rush
  // Dinner' previously used gold/navy with no brand/primary-action reason; reassigned to keep
  // gold reserved for primary actions per the Two-Accent Rule.
  const typeColors={'Open House':'var(--bl)','Brotherhood Event':'var(--gn)','Invite Only':'var(--mt)','Philanthropy':'var(--rd)','Athletics':'var(--am)','Study Event':'var(--mt)','Rush Dinner':'var(--bl)','IFC Event':'var(--mt)'};
  const canEdit=canEditPage('recruitment')&&isCurrentSemester(sem);
  document.getElementById('rc-events-table').innerHTML=`<thead><tr><th>Event</th><th>Type</th><th>Date</th><th>Time</th><th>Location</th><th></th></tr></thead><tbody>${events.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>`<tr><td style="font-weight:500">${esc(e.title)}</td><td><span class="badge" style="background:${typeColors[e.rcEventType]||'#F1F3F6'}22;color:${typeColors[e.rcEventType]||'var(--mt)'}">${esc(e.rcEventType||'N/A')}</span></td><td>${fd(e.date)}</td><td style="color:var(--mt)">${to12h(e.start)}</td><td style="color:var(--mt)">${esc(e.location)||'N/A'}</td><td style="white-space:nowrap">${canEdit?`<button class="btn" style="height:23px;font-size:10.5px" aria-label="Edit ${esc(e.title)}" onclick="rcOpenEditEvent('${e.id}')"><i class="ti ti-pencil"></i></button> <button class="btn btn-d" style="height:23px;font-size:10.5px" aria-label="Delete ${esc(e.title)}" onclick="rcDeleteEvent('${e.id}')"><i class="ti ti-trash"></i></button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:22px;color:var(--mt)">No events yet</td></tr>'}</tbody>`;
}

// ── RUSHEE PROFILE ──
function rcOpenProfile(id){
  const r=D.recruitment.rushees.find(x=>x.id===id);
  if(!r)return;
  const modal=document.getElementById('m-rc-profile');
  document.getElementById('rcp-av').textContent=r.initials;
  document.getElementById('rcp-name').textContent=r.name;
  document.getElementById('rcp-sub').textContent=r.year+' · '+r.major+(r.hometown?' · '+r.hometown:'');
  const sb=document.getElementById('rcp-stage-badge');
  sb.textContent=r.stage;sb.style.cssText=rcStageBadgeStyle(r.stage);
  const scoreEl=document.getElementById('rcp-score-badge');
  const bd=rcScoreBadge(r.bidScore);
  scoreEl.textContent=r.bidScore+', '+bd.label;scoreEl.className='rc-score '+bd.cls;

  const recName=r.recruiter?mB(r.recruiter).name:'Unassigned';
  const daysSince=r.lastContact?Math.round((new Date()-new Date(r.lastContact+'T12:00:00'))/86400000):null;
  const pastEvents=rcEvents().filter(e=>!isUp(e.date)).slice(0,r.eventsAttended);
  const canEdit=canEditPage('recruitment');

  document.getElementById('rcp-body').innerHTML=`
    <div class="rc-profile-grid" style="margin-bottom:16px">
      <!-- Left: Info + scoring -->
      <div>
        <div class="card-t" style="margin-bottom:8px">Basic Info</div>
        <div class="rc-stat"><span style="color:var(--mt)">Year</span><span style="font-weight:500">${esc(r.year)}</span></div>
        <div class="rc-stat"><span style="color:var(--mt)">Major</span><span style="font-weight:500">${esc(r.major)}</span></div>
        <div class="rc-stat"><span style="color:var(--mt)">Hometown</span><span style="font-weight:500">${esc(r.hometown)||'N/A'}</span></div>
        <div class="rc-stat"><span style="color:var(--mt)">Interests</span><span style="font-weight:500;font-size:11px">${esc(r.interests)||'N/A'}</span></div>
        <div class="rc-stat"><span style="color:var(--mt)">Recruiter</span><span style="font-weight:500">${esc(recName)}</span></div>
        <div class="rc-stat"><span style="color:var(--mt)">Last Contact</span><span style="font-weight:500;color:${daysSince===null?'var(--ht)':daysSince>7?'var(--rd)':'var(--tx)'}">${daysSince===null?'Never':daysSince+'d ago'}</span></div>
        <div style="margin-top:11px"><div class="card-t" style="margin-bottom:7px">Tags</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">${(r.tags||[]).map(t=>`<span class="rc-tag ${RC_TAG_CLASSES[t]||''}">${esc(t)}</span>`).join('')||'<span style="font-size:11px;color:var(--ht)">No tags</span>'}
            ${canEdit?`<button class="rc-tag" onclick="rcOpenAddTag('${r.id}')" aria-label="Add tag"><i class="ti ti-plus" style="font-size:9px"></i></button>`:''}
          </div>
        </div>
      </div>
      <!-- Right: Scoring breakdown -->
      <div>
        <div class="card-t" style="margin-bottom:8px">Bid Score Breakdown</div>
        <div style="text-align:center;margin-bottom:11px">
          <div style="font-size:32px;font-weight:700;color:${rcStageColor(r.stage)}">${r.bidScore}</div>
          <div style="font-size:11px;color:var(--mt)">${rcScoreBadge(r.bidScore).label}</div>
        </div>
        ${[
          {l:'Event Attendance',v:Math.min(100,r.eventsAttended*20)},
          {l:'Engagement',v:Math.min(100,(r.notes||[]).length*25)},
          {l:'Stage Progress',v:Math.round(RC_STAGES.indexOf(r.stage)/RC_STAGES.length*100)},
        ].map(x=>`<div class="pr"><span class="pl" style="width:120px">${x.l}</span><div class="pb"><div class="pf" style="width:${x.v}%;background:${rcStageColor(r.stage)}"></div></div><span class="pv">${x.v}%</span></div>`).join('')}
        <div style="margin-top:13px">
          <select id="rcp-stage-sel" ${canEdit?'':'disabled'} style="width:100%;height:29px;padding:0 9px;border:1px solid var(--bdr);border-radius:7px;font-size:12px;font-family:inherit;background:var(--surf);color:var(--tx);outline:none;margin-bottom:6px" onchange="rcUpdateStage('${r.id}',this.value)">
            ${RC_STAGES.map(s=>`<option value="${s}"${s===r.stage?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <!-- Events attended -->
    <div style="margin-bottom:14px">
      <div class="card-t" style="margin-bottom:8px">Event Attendance (${r.eventsAttended})</div>
      ${pastEvents.length?pastEvents.map(e=>`<div class="d-feed-row"><div class="d-feed-av" style="background:var(--bl-bg);color:var(--bl)"><i class="ti ti-calendar-check" style="font-size:11px"></i></div><div style="flex:1"><div style="font-size:11.5px;font-weight:500">${esc(e.title)}</div><div style="font-size:10px;color:var(--ht)">${fd(e.date)} · ${esc(e.rcEventType)}</div></div></div>`).join(''):`<div style="font-size:11.5px;color:var(--ht)">No events attended yet</div>`}
    </div>
    <!-- Notes -->
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="card-t">Conversation Notes</div>
        ${canEdit?`<button class="btn" style="height:24px;font-size:10.5px" onclick="rcOpenAddNote('${r.id}')"><i class="ti ti-plus"></i>Add Note</button>`:''}
      </div>
      <div id="rcp-notes">${(r.notes||[]).length?(r.notes||[]).slice().reverse().map(n=>`<div class="rc-note" style="margin-bottom:7px"><div class="rc-note-meta"><span>${esc(mB(n.by).name)}</span><span>${fds(n.date)}</span></div>${esc(n.text)}</div>`).join(''):`<div style="font-size:11.5px;color:var(--ht)">No notes yet. Add your first observation.</div>`}
      </div>
    </div>`;

  modal.classList.add('open');
}

function rcUpdateStage(id,stage){
  if(!canEditPage('recruitment')){toast('You do not have permission to update rushee stage.','error');return;}
  const r=D.recruitment.rushees.find(x=>x.id===id);
  if(!r)return;
  if(r.semester&&!isCurrentSemester(r.semester)){toast('This semester is read-only.','error');return;}
  r.stage=stage;r.lastContact=localDateStr();
  saveD('recruitment');
  // Update badge in modal header
  const sb=document.getElementById('rcp-stage-badge');
  if(sb){sb.textContent=stage;sb.style.cssText=rcStageBadgeStyle(stage);}
  toast(r.name+' stage updated to '+stage,'success');
  if(RC_ACTIVE_TAB==='rc-rushees')rcRenderTable();
  if(RC_ACTIVE_TAB==='rc-pipeline')rcRenderKanban();
}

function rcOpenAddNote(rusheeId){
  if(!canEditPage('recruitment')){toast('You do not have permission to add notes.','error');return;}
  document.getElementById('rcn-rushee-id').value=rusheeId;
  document.getElementById('rcn-text').value='';
  openM('m-rc-note');
}
function rcSaveNote(){
  if(!canEditPage('recruitment')){toast('You do not have permission to add notes.','error');return;}
  const rusheeId=document.getElementById('rcn-rushee-id').value;
  const text=document.getElementById('rcn-text').value.trim();
  if(!text){toast('Note text is required','error');return;}
  const r=D.recruitment.rushees.find(x=>x.id===rusheeId);
  if(!r)return;
  if(r.semester&&!isCurrentSemester(r.semester)){toast('This semester is read-only.','error');return;}
  if(!r.notes)r.notes=[];
  r.notes.push({text,by:CURRENT_USER?CURRENT_USER.mid:null,date:localDateStr()});
  r.lastContact=localDateStr();
  saveD('recruitment');closeM(null,document.getElementById('m-rc-note'));rcOpenProfile(rusheeId);toast('Note added','success');
}

function rcOpenAddTag(rusheeId){
  if(!canEditPage('recruitment')){toast('You do not have permission to add tags.','error');return;}
  const r=D.recruitment.rushees.find(x=>x.id===rusheeId);
  if(!r)return;
  const available=RC_TAGS.filter(t=>!(r.tags||[]).includes(t));
  if(!available.length){toast('All tags already added','info');return;}
  document.getElementById('rct-rushee-id').value=rusheeId;
  document.getElementById('rct-tag').innerHTML=available.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  openM('m-rc-tag');
}
function rcSaveTag(){
  if(!canEditPage('recruitment')){toast('You do not have permission to add tags.','error');return;}
  const rusheeId=document.getElementById('rct-rushee-id').value;
  const tag=document.getElementById('rct-tag').value;
  const r=D.recruitment.rushees.find(x=>x.id===rusheeId);
  if(!r||!tag)return;
  if(r.semester&&!isCurrentSemester(r.semester)){toast('This semester is read-only.','error');return;}
  if(!r.tags)r.tags=[];
  r.tags.push(tag);saveD('recruitment');closeM(null,document.getElementById('m-rc-tag'));rcOpenProfile(rusheeId);
}

// ── ADD RUSHEE ──
function rcOpenAdd(){
  const tagsEl=document.getElementById('rca-tags');
  tagsEl.innerHTML=RC_TAGS.map(t=>`<span class="rc-tag" onclick="this.classList.toggle('active')" data-tag="${t}">${t}</span>`).join('');
  ['rca-name','rca-major','rca-home','rca-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openM('m-rc-add');
}

function rcAddRushee(){
  if(!canEditPage('recruitment')){toast('Only officers with Recruitment access can add rushees.','error');return;}
  if(!isCurrentSemester(rcSem())){toast('This semester is read-only.','error');return;}
  const name=document.getElementById('rca-name').value.trim();
  if(!name){toast('Name is required','error');return;}
  const tags=[...document.getElementById('rca-tags').querySelectorAll('.rc-tag.active')].map(t=>t.dataset.tag);
  const ini=name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  const stage=document.getElementById('rca-stage').value;
  const scoreMap={'New Lead':10,'Contacted':25,'Attended Event':45,'Active Rush':60,'Interviewed':72,'Bid Ready':82,'Bid Extended':88,'Accepted':92};
  // semester is stamped once at creation and never recomputed later — rushees have no other date
  // field to derive it from, matching how Tasks & Goals treats "semester" as an immutable snapshot.
  D.recruitment.rushees.push({id:'r'+uid(),name,firstName:name.split(' ')[0],lastName:name.split(' ').slice(1).join(' '),initials:ini,year:document.getElementById('rca-year').value,major:document.getElementById('rca-major').value,hometown:document.getElementById('rca-home').value,stage,recruiter:'',eventsAttended:0,bidScore:scoreMap[stage]||10,lastContact:'',notes:document.getElementById('rca-notes').value.trim()?[{text:document.getElementById('rca-notes').value.trim(),by:CURRENT_USER?CURRENT_USER.mid:null,date:localDateStr()}]:[],tags,interests:'',semester:getSemester()});
  saveD('recruitment');closeM(null,document.getElementById('m-rc-add'));
  if(RC_ACTIVE_TAB==='rc-rushees')rcRenderTable();
  else if(RC_ACTIVE_TAB==='rc-pipeline')rcRenderKanban();
  else rcRenderOverview();
  toast(name+' added to recruitment pipeline','success');
}

// ── ADD/EDIT/DELETE RUSH EVENT ──
function rcOpenAddEvent(){
  document.getElementById('rce-id').value='';
  document.getElementById('rce-type').value='Open House';
  const dateEl=document.getElementById('rce-date');if(dateEl)dateEl.value=localDateStr();
  ['rce-name','rce-time','rce-loc','rce-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openM('m-rc-event');
}

function rcOpenEditEvent(id){
  if(!canEditPage('recruitment')){toast('Only officers with Recruitment access can edit rush events.','error');return;}
  const e=rcEvents().find(x=>x.id===id);if(!e)return;
  if(!isCurrentSemester(semesterLabelForDate(e.date))){toast('This event is in a past semester and is read-only.','error');return;}
  document.getElementById('rce-id').value=e.id;
  document.getElementById('rce-name').value=e.title||'';
  document.getElementById('rce-type').value=e.rcEventType||'Open House';
  document.getElementById('rce-date').value=e.date||'';
  document.getElementById('rce-time').value=e.start||'';
  document.getElementById('rce-loc').value=e.location||'';
  document.getElementById('rce-notes').value=e.notes||'';
  openM('m-rc-event');
}

async function rcSaveEvent(){
  if(!canEditPage('recruitment')){toast('Only officers with Recruitment access can save rush events.','error');return;}
  const title=document.getElementById('rce-name').value.trim();
  if(!title){toast('Event name is required','error');return;}
  const id=document.getElementById('rce-id').value;
  const date=document.getElementById('rce-date').value;
  const fields={title,type:'recruitment',rcEventType:document.getElementById('rce-type').value,date,endDate:date,start:document.getElementById('rce-time').value,location:document.getElementById('rce-loc').value,notes:document.getElementById('rce-notes').value.trim()};
  let prev=null;
  if(id){
    const ev=D.events.find(x=>x.id===id);
    if(!ev)return;
    if(!isCurrentSemester(semesterLabelForDate(ev.date))){toast('This event is in a past semester and is read-only.','error');return;}
    prev={...ev};Object.assign(ev,fields);
  }else{
    D.events.push({id:uid(),mandatory:false,...fields});
  }
  try{
    await saveD('events');
    closeM(null,document.getElementById('m-rc-event'));
    if(RC_ACTIVE_TAB==='rc-events')rcRenderEvents();
    else rcRenderOverview();
    if(typeof renderCalendar==='function')renderCalendar();
    toast(id?'Rush event updated':'Rush event added','success');
  }catch(err){
    if(id&&prev){const ev=D.events.find(x=>x.id===id);if(ev)Object.assign(ev,prev);}
    else{D.events=D.events.filter(x=>x.title!==title||x.date!==date);}
    toast('Failed to save. Please try again.','error');
  }
}

async function rcDeleteEvent(id){
  if(!canEditPage('recruitment')){toast('Only officers with Recruitment access can delete rush events.','error');return;}
  const target=D.events.find(x=>x.id===id);
  if(!isCurrentSemester(semesterLabelForDate(target?.date))){toast('This event is in a past semester and is read-only.','error');return;}
  const ok=await confirmDialog('Delete Rush Event','Delete this rush event? This cannot be undone.');
  if(!ok)return;
  const removed=D.events.find(x=>x.id===id);
  const removedAtt=D.attendance[id];
  D.events=D.events.filter(x=>x.id!==id);
  delete D.attendance[id];
  const keys=['events'];
  if(canEditPage('attendance'))keys.push('attendance');
  try{
    await saveD(...keys);
    if(RC_ACTIVE_TAB==='rc-events')rcRenderEvents();
    else rcRenderOverview();
    if(typeof renderCalendar==='function')renderCalendar();
    toast('Rush event deleted','info');
  }catch(err){
    if(removed)D.events.push(removed);
    if(removedAtt)D.attendance[id]=removedAtt;
    toast('Failed to delete. Please try again.','error');
  }
}


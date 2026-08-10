// ══════════════════════════════════════════════
// SOBER BROS — weekly shift grid
// ══════════════════════════════════════════════
// Mirrors the chapter's real sober-monitor spreadsheet: one row per weekend, Thu/Fri/Sat
// columns, 3 assignable slots per day by default. Once D.shifts.pledgeShadowStart is reached,
// each day drops to (slotCount-1) active-member dropdowns plus a multi-select pledge/new-member
// picker (unlimited pledges) — reusing the checkbox-dropdown pattern from js/kcrew.js's chore
// assignment picker (same .kcp-drop class, so its existing outside-click-to-close listener
// applies here too).

// Thu/Fri/Sat are the regular weekend pattern, always shown. Wed/Sun are occasional extra
// event days — hidden by default (slotCount:0, sbDayIsActive() below filters them out of the
// rendered grid) until a weekend explicitly needs one, via the "+ Wednesday Event"/"+ Sunday
// Event" buttons on that weekend's card.
const SB_DAY_KEYS   = ['wed','thu','fri','sat','sun'];
const SB_DAY_LABEL  = {wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday'};
const SB_DAY_OFFSET = {wed:-1,thu:0,fri:1,sat:2,sun:3};
const SB_EXTRA_DAYS = ['wed','sun'];

// ── SOBER BRO ACCESS ──
function canEditSober(){
  return canEditPage('sober');
}

function sbDenied(){
  toast('Only the President, Vice President, and Risk Manager can edit the social monitor schedule.','error');
}

// ── DEFAULTS & MIGRATION ──
// D.shifts used to be a flat array of {id,event,date,start,end,memberId,confirmed,noShow}.
// That shape can't express "3 people on Thursday", so it's preserved read-only under .legacy
// rather than silently discarded.
function sbEnsureDefaults(){
  if(Array.isArray(D.shifts)){
    const legacy=D.shifts;
    D.shifts={pledgeShadowStart:'',weekends:[],legacy};
  }
  if(!D.shifts)D.shifts={pledgeShadowStart:'',weekends:[]};
  if(!D.shifts.weekends)D.shifts.weekends=[];
  if(D.shifts.pledgeShadowStart==null)D.shifts.pledgeShadowStart='';
  D.shifts.weekends.forEach(w=>{
    if(!w.id)w.id=uid();
    if(!w.days)w.days={};
    SB_DAY_KEYS.forEach(dk=>{
      const defaultSlotCount=SB_EXTRA_DAYS.includes(dk)?0:3;
      if(!w.days[dk])w.days[dk]={name:'',slotCount:defaultSlotCount,memberIds:[],pledgeIds:[]};
      const day=w.days[dk];
      if(day.slotCount==null)day.slotCount=defaultSlotCount;
      if(!Array.isArray(day.memberIds))day.memberIds=[];
      while(day.memberIds.length<day.slotCount)day.memberIds.push(null);
      if(day.memberIds.length>day.slotCount)day.memberIds.length=day.slotCount;
      if(!Array.isArray(day.pledgeIds))day.pledgeIds=[];
      if(day.name==null)day.name='';
    });
  });
  D.shifts.weekends.sort((a,b)=>(a.thuDate||'').localeCompare(b.thuDate||''));
}

function sbDayDate(weekend,dayKey){
  if(!weekend.thuDate)return'';
  const d=new Date(weekend.thuDate+'T12:00:00');
  d.setDate(d.getDate()+SB_DAY_OFFSET[dayKey]);
  return localDateStr(d);
}

// Pledge shadows only ever cover Thursday and Friday shifts — Saturday, and the occasional
// Wednesday/Sunday extra event, always stay full active-member coverage regardless of the
// pledge-shadow start date.
function sbPledgeActive(dateStr,dayKey){
  if(dayKey!=='thu'&&dayKey!=='fri')return false;
  return !!(D.shifts.pledgeShadowStart && dateStr && dateStr>=D.shifts.pledgeShadowStart);
}

function sbActiveMembers(){
  return sortedMembers().filter(m=>(m.memberStatus||'Active')!=='New Member');
}
function sbPledgeMembers(){
  return sortedMembers().filter(m=>(m.memberStatus||'Active')==='New Member');
}

// Flattened list of assignable ACTIVE slots (excludes pledge slots and slotCount:0 "no coverage
// needed" days) — the single source of truth for coverage KPIs/alerts, here and in
// dashboard.js/helpers.js/reports.js.
function sbFlatSlots(){
  sbEnsureDefaults();
  const out=[];
  D.shifts.weekends.forEach(w=>{
    SB_DAY_KEYS.forEach(dk=>{
      const day=w.days[dk];
      if(!day||!day.slotCount)return;
      const date=sbDayDate(w,dk);
      const activeCount=sbPledgeActive(date,dk)?Math.max(day.slotCount-1,0):day.slotCount;
      for(let i=0;i<activeCount;i++){
        out.push({date,weekendId:w.id,dayKey:dk,label:day.name||SB_DAY_LABEL[dk],memberId:day.memberIds[i]||null});
      }
    });
  });
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}

// ── RENDER ──
function renderSober(){
  sbEnsureDefaults();
  const ro=!canEditSober();
  const addBtn=document.getElementById('sober-add-btn');
  const impBtn=document.getElementById('sober-import-btn');
  if(addBtn)addBtn.style.display=ro?'none':'';
  if(impBtn)impBtn.style.display=ro?'none':'';

  const pledgeDateInput=document.getElementById('sb-pledge-date');
  if(pledgeDateInput){
    pledgeDateInput.value=D.shifts.pledgeShadowStart||'';
    pledgeDateInput.disabled=ro;
  }

  sbUpdateKpiOnly();
  sbRenderSchedule();
}

function sbUpdateKpiOnly(){
  const slots=sbFlatSlots();
  const today=localDateStr();
  const upcoming=slots.filter(s=>s.date>=today);
  const unassigned=upcoming.filter(s=>!s.memberId);
  const filled=upcoming.length-unassigned.length;

  document.getElementById('s-kpi').innerHTML=
    statStrip('Weekends Scheduled',D.shifts.weekends.length,getSemester(),'neutral')+
    statStrip('Active Slots Filled',filled+'/'+upcoming.length,'Upcoming coverage','neutral')+
    statStrip('Unassigned',unassigned.length,unassigned.length>0?'Need coverage':'All covered',unassigned.length>0?'down':'neutral')+
    statStrip('New Member Training',D.shifts.pledgeShadowStart?('Since '+fds(D.shifts.pledgeShadowStart)):'Not started','Thu/Fri: 2 active + new members','neutral');

  document.getElementById('s-alert').innerHTML=unassigned.length>0
    ?`<div class="bnr danger"><i class="ti ti-alert-circle" style="font-size:13px"></i>${unassigned.length} slot${unassigned.length>1?'s':''} need${unassigned.length===1?'s':''} coverage before the event.</div>`
    :'';
}

function sbRenderSchedule(){
  const ro=!canEditSober();
  const el=document.getElementById('s-schedule');
  if(!el)return;
  if(!D.shifts.weekends.length){
    el.innerHTML=es('ti-shield-check','green','No weekends scheduled','Add a weekend to start building the social monitor schedule.',
      ro?'':`<button class="btn btn-p" onclick="openM('m-addweekend')"><i class="ti ti-plus"></i>Add Weekend</button>`);
    return;
  }
  el.innerHTML=D.shifts.weekends.map(w=>sbWeekendCard(w,ro)).join('');
}

// Wed/Sun only render once they have real content — an empty, never-activated extra day would
// otherwise clutter every weekend card. "+ Wednesday Event"/"+ Sunday Event" reveals one;
// sbClearDay ("No party this day") already clears it back to inactive/hidden.
function sbDayIsActive(w,dk){
  if(!SB_EXTRA_DAYS.includes(dk))return true;
  const day=w.days[dk];
  return !!(day&&(day.slotCount>0||day.name||(day.memberIds&&day.memberIds.some(Boolean))||(day.pledgeIds&&day.pledgeIds.length)));
}
function sbAddExtraDay(weekendId,dayKey){
  if(!canEditSober()){sbDenied();return;}
  const w=D.shifts.weekends.find(x=>x.id===weekendId);if(!w)return;
  const day=w.days[dayKey];
  day.slotCount=3;
  day.memberIds=[null,null,null];
  saveD('shifts');
  renderSober();
}

function sbWeekendCard(w,ro){
  const satDate=sbDayDate(w,'sat');
  const isPast=satDate&&satDate<localDateStr();
  const rangeLabel=w.thuDate?`${fds(w.thuDate)} – ${fds(satDate)}`:'Undated weekend';
  const visibleDays=SB_DAY_KEYS.filter(dk=>sbDayIsActive(w,dk));
  const addExtraBtns=ro?'':SB_EXTRA_DAYS.filter(dk=>!sbDayIsActive(w,dk)).map(dk=>
    `<button class="btn" style="height:24px;font-size:10.5px;padding:0 7px" onclick="sbAddExtraDay('${w.id}','${dk}')"><i class="ti ti-plus"></i>${SB_DAY_LABEL[dk]} Event</button>`
  ).join('');
  return`<div class="card" style="margin-bottom:13px${isPast?';opacity:.6':''}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-weight:600;font-size:13px">${esc(rangeLabel)}</span>
        ${isPast?'<span class="badge bm2" style="font-size:9px">Past</span>':''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${addExtraBtns}
        ${ro?'':`<button class="btn btn-d" style="height:24px;font-size:10.5px;padding:0 7px" onclick="sbDeleteWeekend('${w.id}')" aria-label="Delete weekend"><i class="ti ti-trash"></i></button>`}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
      ${visibleDays.map(dk=>sbDayColumn(w,dk,ro)).join('')}
    </div>
  </div>`;
}

function sbDayColumn(w,dk,ro){
  const day=w.days[dk];
  const date=sbDayDate(w,dk);
  const pledgeOn=sbPledgeActive(date,dk);
  const activeCount=day.slotCount===0?0:(pledgeOn?Math.max(day.slotCount-1,0):day.slotCount);
  const fieldStyle=`width:100%;font-size:11.5px;padding:4px 6px;border:1px solid var(--bdr);border-radius:5px;outline:none;font-family:inherit;background:var(--surf);color:var(--tx)${ro?';opacity:.6;cursor:not-allowed':''}`;

  let body;
  if(day.slotCount===0){
    body=`<div style="font-size:11px;color:var(--ht);padding:6px 0">No coverage needed</div>`;
  }else{
    const memberOpts=sel=>['<option value="">— Unassigned —</option>',...sbActiveMembers().map(m=>`<option value="${m.id}"${sel===m.id?' selected':''}>${esc(m.name)}</option>`)].join('');
    const dropdowns=Array.from({length:activeCount}).map((_,i)=>
      `<select ${ro?'disabled':`onchange="sbSlotChange('${w.id}','${dk}',${i},this.value)"`} style="${fieldStyle};margin-bottom:4px">${memberOpts(day.memberIds[i]||'')}</select>`
    ).join('');
    const addSlotBtn=(ro||day.slotCount>=8)?'':`<button onclick="sbAddSlot('${w.id}','${dk}')" style="font-size:10.5px;background:none;border:none;color:var(--sky-tx);cursor:pointer;padding:3px 0 6px;display:flex;align-items:center;gap:3px"><i class="ti ti-plus" style="font-size:10px"></i>Add social monitor</button>`;

    let pledgeBlock='';
    if(pledgeOn){
      const key=w.id+'-'+dk;
      const lbl=day.pledgeIds.length?esc(day.pledgeIds.map(id=>mB(id).name.split(' ')[0]).join(', ')):'— Select new members —';
      if(ro){
        pledgeBlock=`<div style="font-size:11.5px;padding:4px 0;color:${day.pledgeIds.length?'var(--tx)':'var(--ht)'}">${lbl}</div>`;
      }else{
        const pledgeChecks=sbPledgeMembers().map(m=>{
          const checked=day.pledgeIds.includes(m.id)?'checked':'';
          return`<label style="display:flex;align-items:center;gap:7px;padding:5px 10px;cursor:pointer;font-size:11.5px;white-space:nowrap" onmouseover="this.style.background='rgba(0,0,0,.04)'" onmouseout="this.style.background=''">
            <input type="checkbox" ${checked} onchange="sbPledgeToggle('${w.id}','${dk}','${m.id}',this.checked)" style="accent-color:var(--sky);width:14px;height:14px;flex-shrink:0">
            ${esc(m.name)}
          </label>`;
        }).join('');
        pledgeBlock=`<div style="position:relative;margin-top:2px">
          <div onclick="sbPledgePickerToggle(event,'${key}')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:4px 7px;border:1px dashed var(--bdr);border-radius:5px;background:var(--surf);min-height:28px;gap:5px;font-size:11.5px;color:${day.pledgeIds.length?'var(--tx)':'var(--ht)'}">
            <span id="sbp-lbl-${key}" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lbl}</span>
            <i class="ti ti-chevron-down" style="font-size:9px;color:var(--mt);flex-shrink:0"></i>
          </div>
          <div id="sbp-${key}" class="kcp-drop" style="display:none;position:absolute;top:calc(100% + 2px);left:0;right:0;z-index:200;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.12);max-height:180px;overflow-y:auto;padding:3px 0">
            ${pledgeChecks||'<div style="padding:8px 10px;font-size:11.5px;color:var(--ht)">No new members yet</div>'}
          </div>
        </div>`;
      }
    }
    body=dropdowns+addSlotBtn+pledgeBlock;
  }

  const clearBtn=(ro||day.slotCount===0)?'':`<button onclick="sbClearDay('${w.id}','${dk}')" title="No party this ${SB_DAY_LABEL[dk]}" aria-label="Remove ${SB_DAY_LABEL[dk]}" style="background:none;border:none;cursor:pointer;color:var(--ht);padding:2px;line-height:0"><i class="ti ti-trash" style="font-size:12px"></i></button>`;

  return`<div style="border:1px solid var(--bdr);border-radius:8px;padding:9px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--mt)">${SB_DAY_LABEL[dk]}${date?' · '+fds(date):''}</span>
      ${clearBtn}
    </div>
    <input value="${esc(day.name)}" placeholder="Event title" ${ro?'disabled':`onchange="sbUpdateDayLabel('${w.id}','${dk}',this.value)"`} style="${fieldStyle};margin-bottom:6px;font-weight:500">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:10px;color:var(--ht)">Slots needed</span>
      <input type="number" min="0" max="8" value="${day.slotCount}" ${ro?'disabled':`onchange="sbUpdateSlotCount('${w.id}','${dk}',this.value)"`} style="width:48px;font-size:11px;padding:3px 5px;border:1px solid var(--bdr);border-radius:5px;background:var(--surf);color:var(--tx)${ro?';opacity:.6':''}">
      ${pledgeOn&&day.slotCount>0?`<span style="font-size:9.5px;color:var(--mt)">(${activeCount} active + new members)</span>`:''}
    </div>
    ${body}
  </div>`;
}

// ── EDITING ──
function sbUpdateDayLabel(weekendId,dayKey,value){
  if(!canEditSober()){sbDenied();return;}
  const w=D.shifts.weekends.find(x=>x.id===weekendId);if(!w)return;
  w.days[dayKey].name=(value||'').trim();
  saveD('shifts');
}

function sbUpdateSlotCount(weekendId,dayKey,value){
  if(!canEditSober()){sbDenied();return;}
  const w=D.shifts.weekends.find(x=>x.id===weekendId);if(!w)return;
  const day=w.days[dayKey];
  let n=parseInt(value,10);
  if(isNaN(n)||n<0)n=0;
  if(n>8)n=8;
  day.slotCount=n;
  while(day.memberIds.length<n)day.memberIds.push(null);
  if(day.memberIds.length>n)day.memberIds.length=n;
  saveD('shifts');
  renderSober();
}

// Quick "one more sober bro needed this day" — bumps the slot count by one without having to
// go find the Slots number input (works the same whether or not pledge-shadow mode is on, since
// it's the active-slot count, slotCount-1 when pledges are active, that grows by one).
function sbAddSlot(weekendId,dayKey){
  if(!canEditSober()){sbDenied();return;}
  const w=D.shifts.weekends.find(x=>x.id===weekendId);if(!w)return;
  const day=w.days[dayKey];
  if(day.slotCount>=8){toast('Max 8 slots per day','error');return;}
  day.slotCount++;
  day.memberIds.push(null);
  saveD('shifts');
  renderSober();
}

// "No party this day" — clears the day's label, slots, and any assignments (slotCount 0 already
// renders as "No coverage needed"; type a number back into Slots to bring it back).
async function sbClearDay(weekendId,dayKey){
  if(!canEditSober()){sbDenied();return;}
  const w=D.shifts.weekends.find(x=>x.id===weekendId);if(!w)return;
  const day=w.days[dayKey];
  const hasData=day.name||day.memberIds.some(Boolean)||day.pledgeIds.length;
  if(hasData){
    const ok=await confirmDialog('Remove '+SB_DAY_LABEL[dayKey],'No party this '+SB_DAY_LABEL[dayKey].toLowerCase()+'? This clears its label and assignments.','Remove');
    if(!ok)return;
  }
  day.name='';
  day.slotCount=0;
  day.memberIds=[];
  day.pledgeIds=[];
  saveD('shifts');
  renderSober();
}

function sbSlotChange(weekendId,dayKey,slotIndex,value){
  if(!canEditSober()){sbDenied();return;}
  const w=D.shifts.weekends.find(x=>x.id===weekendId);if(!w)return;
  w.days[dayKey].memberIds[slotIndex]=value||null;
  saveD('shifts');
  sbUpdateKpiOnly();
}

function sbPledgePickerToggle(e,key){
  if(!canEditSober())return;
  e.stopPropagation();
  document.querySelectorAll('.kcp-drop').forEach(el=>{
    if(el.id!=='sbp-'+key)el.style.display='none';
  });
  const el=document.getElementById('sbp-'+key);
  if(el)el.style.display=el.style.display==='none'?'block':'none';
}

function sbPledgeToggle(weekendId,dayKey,memberId,checked){
  if(!canEditSober()){sbDenied();return;}
  const w=D.shifts.weekends.find(x=>x.id===weekendId);if(!w)return;
  const day=w.days[dayKey];
  if(checked){if(!day.pledgeIds.includes(memberId))day.pledgeIds.push(memberId);}
  else{day.pledgeIds=day.pledgeIds.filter(id=>id!==memberId);}
  const key=weekendId+'-'+dayKey;
  const lbl=document.getElementById('sbp-lbl-'+key);
  if(lbl){
    const text=day.pledgeIds.length?esc(day.pledgeIds.map(id=>mB(id).name.split(' ')[0]).join(', ')):'— Select new members —';
    lbl.textContent=text;
    lbl.style.color=day.pledgeIds.length?'var(--tx)':'var(--ht)';
  }
  saveD('shifts');
}

// ── WEEKEND CRUD ──
function sbAddWeekend(){
  if(!canEditSober()){sbDenied();return;}
  const dateInput=document.getElementById('nw-date');
  const weeksInput=document.getElementById('nw-weeks');
  const thuDate=dateInput?dateInput.value:'';
  if(!thuDate){toast('Pick a starting Thursday date','error');return;}
  let weeks=parseInt(weeksInput?weeksInput.value:'1',10);
  if(isNaN(weeks)||weeks<1)weeks=1;
  if(weeks>26)weeks=26;
  const base=new Date(thuDate+'T12:00:00');
  let added=0;
  for(let i=0;i<weeks;i++){
    const d=new Date(base);
    d.setDate(d.getDate()+i*7);
    const ds=localDateStr(d);
    if(D.shifts.weekends.some(w=>w.thuDate===ds))continue;
    D.shifts.weekends.push({
      id:uid(),
      thuDate:ds,
      days:{
        wed:{name:'',slotCount:0,memberIds:[],pledgeIds:[]},
        thu:{name:'',slotCount:3,memberIds:[null,null,null],pledgeIds:[]},
        fri:{name:'',slotCount:3,memberIds:[null,null,null],pledgeIds:[]},
        sat:{name:'',slotCount:3,memberIds:[null,null,null],pledgeIds:[]},
        sun:{name:'',slotCount:0,memberIds:[],pledgeIds:[]},
      }
    });
    added++;
  }
  if(!added){toast('Those weekends are already on the schedule','error');return;}
  saveD('shifts');
  closeM(null,document.getElementById('m-addweekend'));
  if(dateInput)dateInput.value='';
  if(weeksInput)weeksInput.value='1';
  renderSober();
  toast(added+' weekend'+(added>1?'s':'')+' added','success');
}

async function sbDeleteWeekend(id){
  if(!canEditSober()){sbDenied();return;}
  const ok=await confirmDialog('Delete Weekend','Remove this weekend and all its shift assignments?');
  if(!ok)return;
  const idx=D.shifts.weekends.findIndex(w=>w.id===id);
  const removed=idx>=0?D.shifts.weekends[idx]:null;
  D.shifts.weekends=D.shifts.weekends.filter(w=>w.id!==id);
  try{
    await saveD('shifts');
    renderSober();
    renderDash();
    toast('Weekend removed','info');
  }catch(e){
    if(removed)D.shifts.weekends.splice(idx,0,removed);
    toast('Failed to remove weekend. Please try again.','error');
  }
}

function sbSetPledgeShadowStart(value){
  if(!canEditSober()){sbDenied();return;}
  D.shifts.pledgeShadowStart=value||'';
  saveD('shifts');
  renderSober();
}

// ── IMPORT ──
// Columns: Thursday Date, Thu Event, Thu Members, Fri Event, Fri Members, Sat Event, Sat Members
// "Members" cells are semicolon-separated names, matched against the roster the same
// substring-match way the old single-member import did.
function sbHandleImport(input){
  if(!canEditSober()){sbDenied();return;}
  const f=input.files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=function(e){
    const lines=e.target.result.split('\n').map(l=>l.replace(/\r$/,'')).filter(Boolean);
    let added=0;
    lines.slice(1).forEach(line=>{
      const cols=line.split(',').map(s=>s.trim().replace(/^"|"$/g,''));
      const thuDate=cols[0];
      if(!thuDate)return;
      let w=D.shifts.weekends.find(x=>x.thuDate===thuDate);
      if(!w){
        w={id:uid(),thuDate,days:{
          wed:{name:'',slotCount:0,memberIds:[],pledgeIds:[]},
          thu:{name:'',slotCount:3,memberIds:[null,null,null],pledgeIds:[]},
          fri:{name:'',slotCount:3,memberIds:[null,null,null],pledgeIds:[]},
          sat:{name:'',slotCount:3,memberIds:[null,null,null],pledgeIds:[]},
          sun:{name:'',slotCount:0,memberIds:[],pledgeIds:[]},
        }};
        D.shifts.weekends.push(w);
      }
      const dayCols={thu:[1,2],fri:[3,4],sat:[5,6]};
      Object.keys(dayCols).forEach(dk=>{
        const[nameIdx,membersIdx]=dayCols[dk];
        const name=cols[nameIdx]||'';
        const names=(cols[membersIdx]||'').split(';').map(s=>s.trim()).filter(Boolean);
        if(!name&&!names.length)return;
        const ids=names.map(n=>{
          const m=D.members.find(mm=>mm.name.toLowerCase().includes(n.toLowerCase()));
          return m?m.id:null;
        }).filter(Boolean);
        const day=w.days[dk];
        if(name)day.name=name;
        day.slotCount=Math.max(day.slotCount,ids.length,3);
        while(day.memberIds.length<day.slotCount)day.memberIds.push(null);
        ids.forEach((id,i)=>{day.memberIds[i]=id;});
      });
      added++;
    });
    if(added){
      saveD('shifts');
      renderSober();
      toast(added+' weekend'+(added>1?'s':'')+' imported','success');
      closeM(null,document.getElementById('m-simport'));
    }else{
      document.getElementById('si-prev').innerHTML=`<div class="bnr danger"><i class="ti ti-alert-circle" style="font-size:13px"></i>Could not parse file. Expected columns: Thursday Date, Thu Event, Thu Members, Fri Event, Fri Members, Sat Event, Sat Members</div>`;
    }
  };
  reader.readAsText(f);
}

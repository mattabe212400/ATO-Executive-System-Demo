// ══════════════════════════════════════════════
// KCREW & CHORES
// ══════════════════════════════════════════════

const KC_DAYS_LUNCH  = ['mon','tue','wed','thu','fri'];
const KC_DAYS_DINNER = ['mon','tue','wed','thu'];
const KC_DAY_SHORT   = {mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri'};
const KC_LUNCH_SLOTS  = 2;
const KC_DINNER_SLOTS = 4;

// Example chore checklist for demo purposes — not any specific chapter's actual list.
const KC_DEFAULT_CHORES = [
  // 2nd Floor
  {id:'c2f-bath',  area:'2nd Floor',        chore:'Sweep and mop bathroom',                    notes:'Standard cleaning supplies', day:'both'},
  {id:'c2f-hall',  area:'2nd Floor',        chore:'Sweep and mop hallways',                    notes:'Sweep before mopping', day:'both'},
  {id:'c2f-tolT',  area:'2nd Floor',        chore:'Clean toilets and urinals (Tuesday)',       notes:'', day:'tuesday'},
  {id:'c2f-tolH',  area:'2nd Floor',        chore:'Clean toilets and urinals (Thursday)',      notes:'', day:'thursday'},
  {id:'c2f-sink',  area:'2nd Floor',        chore:'Sinks, counters, and mirrors',              notes:'', day:'both'},
  {id:'c2f-garb',  area:'2nd Floor',        chore:'Take out and re-bag garbage',               notes:'Once a day', day:'daily'},
  // Stairwells
  {id:'cfsT',      area:'Stairwells',       chore:'Sweep and mop front stairwell (Tuesday)',   notes:'Wipe down handrails', day:'tuesday'},
  {id:'cfsH',      area:'Stairwells',       chore:'Sweep and mop front stairwell (Thursday)',  notes:'Wipe down handrails', day:'thursday'},
  {id:'cbsT',      area:'Stairwells',       chore:'Sweep and mop back stairwell (Tuesday)',    notes:'Wipe down handrails', day:'tuesday'},
  {id:'cbsH',      area:'Stairwells',       chore:'Sweep and mop back stairwell (Thursday)',   notes:'Wipe down handrails', day:'thursday'},
  // Common Areas & Outside
  {id:'cfoy',      area:'Common Areas',     chore:'Front entryway',                            notes:'Sweep or vacuum and mop', day:'both'},
  {id:'cbfoy',     area:'Common Areas',     chore:'Back entryway',                             notes:'Sweep or vacuum and mop', day:'both'},
  {id:'cout-f',    area:'Common Areas',     chore:'Outside (front)',                           notes:'Pick up trash, take out front porch trash', day:'both'},
  {id:'cout-b',    area:'Common Areas',     chore:'Outside (back)',                            notes:'Pick up trash, take out back lot trash', day:'both'},
  // Dining Room
  {id:'cdrS',      area:'Dining Room',      chore:'Sweep dining room',                         notes:'After dinner, chairs up', day:'both'},
  {id:'cdrM',      area:'Dining Room',      chore:'Mop dining room',                           notes:'After dinner, chairs up', day:'both'},
  // 3rd Floor
  {id:'c3f-bath',  area:'3rd Floor',        chore:'Sweep and mop bathroom',                    notes:'Standard cleaning supplies', day:'both'},
  {id:'c3f-hall',  area:'3rd Floor',        chore:'Sweep and mop hallways',                    notes:'Sweep before mopping', day:'both'},
  {id:'c3f-tolT',  area:'3rd Floor',        chore:'Clean toilets and urinals (Tuesday)',       notes:'', day:'tuesday'},
  {id:'c3f-tolH',  area:'3rd Floor',        chore:'Clean toilets and urinals (Thursday)',      notes:'', day:'thursday'},
  {id:'c3f-sink',  area:'3rd Floor',        chore:'Sinks, mirrors, and counters',              notes:'', day:'both'},
  {id:'c3f-garb',  area:'3rd Floor',        chore:'Take out and re-bag garbage',               notes:'Once a day', day:'daily'},
  // Basement
  {id:'cbasT',     area:'Basement',         chore:'Clean bathrooms (Tuesday)',                 notes:'Toilets, sinks, mirrors, countertops, trash', day:'tuesday'},
  {id:'cbasH',     area:'Basement',         chore:'Clean bathrooms (Thursday)',                notes:'Toilets, sinks, mirrors, countertops, trash', day:'thursday'},
  {id:'cbasHall',  area:'Basement',         chore:'Sweep and mop hallway',                     notes:'', day:'both'},
  {id:'cbasLaun',  area:'Basement',         chore:'Laundry room',                              notes:'Sweep, take out trash, tidy folding area', day:'both'},
];

// ── RBAC: lead positions + whichever positions were granted the 'kcrew' page ──
function canEditKcrew(){
  return canEditPage('kcrew');
}

// ISO week key — resets chore checks each Monday
function kcWeekKey(){
  const d=new Date();
  const jan1=new Date(d.getFullYear(),0,1);
  const week=Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
  return d.getFullYear()+'-W'+String(week).padStart(2,'0');
}

function kcEnsureDefaults(){
  if(!D.kcrew)D.kcrew={};
  if(!D.kcrew.schedule)D.kcrew.schedule={};
  if(!D.kcrew.schedule.lunch)D.kcrew.schedule.lunch={};
  if(!D.kcrew.schedule.dinner)D.kcrew.schedule.dinner={};
  KC_DAYS_LUNCH.forEach(d=>{if(!D.kcrew.schedule.lunch[d])D.kcrew.schedule.lunch[d]=[];});
  KC_DAYS_DINNER.forEach(d=>{if(!D.kcrew.schedule.dinner[d])D.kcrew.schedule.dinner[d]=[];});

  if(!D.chores)D.chores={};
  if(!D.chores.list||D.chores.list.length===0){
    D.chores.list=KC_DEFAULT_CHORES.map(c=>({...c,memberIds:[]}));
  }else{
    // Migrate old single memberId to memberIds array
    D.chores.list.forEach(c=>{
      if(!c.memberIds){
        c.memberIds=c.memberId?[c.memberId]:[];
        delete c.memberId;
      }
    });
    KC_DEFAULT_CHORES.forEach(def=>{
      if(!D.chores.list.find(x=>x.id===def.id)){
        D.chores.list.push({...def,memberIds:[]});
      }
    });
  }
  if(!D.chores.checks)D.chores.checks={};
}

// Close all open member pickers when clicking outside
document.addEventListener('click',()=>{
  document.querySelectorAll('.kcp-drop').forEach(el=>el.style.display='none');
});

function renderKcrew(){
  kcEnsureDefaults();
  const wk=kcWeekKey();
  const checks=D.chores.checks[wk]||{};
  const list=D.chores.list;
  const assigned=list.filter(c=>c.memberIds&&c.memberIds.length>0).length;
  const tueChores=list.filter(c=>c.day==='both'||c.day==='tuesday'||c.day==='daily');
  const thuChores=list.filter(c=>c.day==='both'||c.day==='thursday'||c.day==='daily');
  const doneT=tueChores.filter(c=>checks[c.id+'_tue']).length;
  const doneH=thuChores.filter(c=>checks[c.id+'_thu']).length;

  document.getElementById('kc-kpi').innerHTML=
    statStrip('Chore Assignments',assigned+'/'+list.length,'Members assigned this semester','neutral')+
    statStrip('Tuesday Check-ins',doneT+'/'+tueChores.length,'Week of '+wk,'neutral')+
    statStrip('Thursday Check-ins',doneH+'/'+thuChores.length,'Week of '+wk,'neutral');

  const roBar=document.getElementById('kc-ro-bar');
  if(roBar)roBar.style.display=canEditKcrew()?'none':'flex';

  renderKcSchedule();
  renderKcChores(wk);
  kcRenderChoreManager();
}

function renderKcSchedule(){
  const ro=!canEditKcrew();
  const memberOpts=()=>['<option value="">— Unassigned —</option>',...sortedMembers().map(m=>`<option value="${m.id}">${esc(m.name)}</option>`)].join('');
  const selStyle=`width:100%;font-size:11.5px;padding:4px 6px;border:1px solid var(--bdr);border-radius:5px;outline:none;font-family:inherit;background:var(--surf);color:var(--tx)${ro?';opacity:.6;cursor:not-allowed':''}`;

  let html='';

  // ── LUNCH ──
  html+=`<div style="margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--mt);margin-bottom:10px;display:flex;align-items:center;gap:8px">
      <i class="ti ti-sun" style="font-size:13px"></i> Lunch
      <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">Mon – Fri &nbsp;·&nbsp; 2 members per day</span>
    </div>
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
    <table style="width:100%;border-collapse:collapse;min-width:520px">
      <thead><tr>
        <th style="text-align:left;padding:5px 8px;font-size:10.5px;color:var(--ht);font-weight:600;width:70px">Slot</th>
        ${KC_DAYS_LUNCH.map(d=>`<th style="padding:5px 8px;font-size:10.5px;color:var(--ht);font-weight:600">${KC_DAY_SHORT[d]}</th>`).join('')}
      </tr></thead><tbody>`;
  for(let i=0;i<KC_LUNCH_SLOTS;i++){
    html+=`<tr>
      <td style="font-size:11.5px;color:var(--mt);padding:4px 8px">Member ${i+1}</td>
      ${KC_DAYS_LUNCH.map(d=>`<td style="padding:4px 5px"><select class="kc-sel" data-meal="lunch" data-day="${d}" data-slot="${i}" ${ro?'disabled':'onchange="kcUpdateSlot(this)"'} style="${selStyle}">${memberOpts()}</select></td>`).join('')}
    </tr>`;
  }
  html+=`</tbody></table></div></div>`;

  // ── DINNER ──
  html+=`<div>
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--mt);margin-bottom:10px;display:flex;align-items:center;gap:8px">
      <i class="ti ti-moon" style="font-size:13px"></i> Dinner
      <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">Mon – Thu &nbsp;·&nbsp; 4 members per day</span>
    </div>
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
    <table style="width:100%;border-collapse:collapse;min-width:420px">
      <thead><tr>
        <th style="text-align:left;padding:5px 8px;font-size:10.5px;color:var(--ht);font-weight:600;width:70px">Slot</th>
        ${KC_DAYS_DINNER.map(d=>`<th style="padding:5px 8px;font-size:10.5px;color:var(--ht);font-weight:600">${KC_DAY_SHORT[d]}</th>`).join('')}
      </tr></thead><tbody>`;
  for(let i=0;i<KC_DINNER_SLOTS;i++){
    html+=`<tr>
      <td style="font-size:11.5px;color:var(--mt);padding:4px 8px">Member ${i+1}</td>
      ${KC_DAYS_DINNER.map(d=>`<td style="padding:4px 5px"><select class="kc-sel" data-meal="dinner" data-day="${d}" data-slot="${i}" ${ro?'disabled':'onchange="kcUpdateSlot(this)"'} style="${selStyle}">${memberOpts()}</select></td>`).join('')}
    </tr>`;
  }
  html+=`</tbody></table></div></div>`;

  document.getElementById('kc-schedule').innerHTML=html;

  document.querySelectorAll('.kc-sel').forEach(sel=>{
    const meal=sel.dataset.meal;
    const day=sel.dataset.day;
    const slot=parseInt(sel.dataset.slot);
    const ids=(D.kcrew.schedule[meal]&&D.kcrew.schedule[meal][day])||[];
    if(ids[slot])sel.value=ids[slot];
  });
}

function kcUpdateSlot(sel){
  if(!canEditKcrew()){toast('Only the President, VP, House Manager, or House Manager Assistant can edit Meal Duties.','error');return;}
  const meal=sel.dataset.meal;
  const day=sel.dataset.day;
  const slot=parseInt(sel.dataset.slot);
  const slots=meal==='lunch'?KC_LUNCH_SLOTS:KC_DINNER_SLOTS;
  if(!D.kcrew.schedule[meal][day]||D.kcrew.schedule[meal][day].length<slots){
    D.kcrew.schedule[meal][day]=Array(slots).fill(null);
  }
  D.kcrew.schedule[meal][day][slot]=sel.value||null;
  saveD('kcrew');
}

function kcChoreLabel(memberIds){
  if(!memberIds||!memberIds.length)return'— Unassigned —';
  return esc(memberIds.map(id=>mB(id).name.split(' ')[0]).join(', '));
}

// Chores only ever concern members who actually live in the house (the "Live-in" field on the
// Members tab) — non-live-in members have no chore to do. `existingIds` (a chore's currently
// assigned members) are unioned in even if not live-in, so an existing assignment never
// silently drops off the picker — e.g. a member who moved out still shows up (and stays
// checked) until someone unchecks them.
function kcLiveInMembers(existingIds){
  const liveIn=sortedMembers().filter(m=>m.liveIn);
  const ids=new Set(liveIn.map(m=>m.id));
  const extra=(existingIds||[]).map(id=>D.members.find(m=>m.id===id)).filter(m=>m&&!ids.has(m.id));
  return [...liveIn,...extra];
}

function renderKcChores(wk){
  const ro=!canEditKcrew();
  const checks=D.chores.checks[wk]||{};
  const dayBadge={
    both:    '<span class="badge bb2" style="font-size:9px">Both</span>',
    tuesday: '<span class="badge ba2" style="font-size:9px">Tue</span>',
    thursday:'<span class="badge bm2" style="font-size:9px">Thu</span>',
    daily:   '<span class="badge bg2" style="font-size:9px">Daily</span>',
  };
  const areas=[...new Set(KC_DEFAULT_CHORES.map(c=>c.area))];

  let html='<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">';
  areas.forEach(area=>{
    const areaChores=D.chores.list.filter(c=>c.area===area);
    if(!areaChores.length)return;
    html+=`<div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--mt);padding:6px 0 7px;border-bottom:2px solid var(--bdr);margin-bottom:0">${area}</div>
      <table style="width:100%;border-collapse:collapse;min-width:680px">
        <thead><tr style="background:var(--surf)">
          <th style="text-align:left;padding:6px 8px;font-size:10.5px;color:var(--ht);font-weight:600">Chore</th>
          <th style="text-align:left;padding:6px 8px;font-size:10.5px;color:var(--ht);font-weight:600;width:210px">Notes</th>
          <th style="padding:6px 8px;font-size:10.5px;color:var(--ht);font-weight:600;width:50px;text-align:center">Day</th>
          <th style="text-align:left;padding:6px 8px;font-size:10.5px;color:var(--ht);font-weight:600;width:180px">Assigned To</th>
          <th style="text-align:center;padding:6px 8px;font-size:10.5px;color:var(--ht);font-weight:600;width:52px">Tue <i class="ti ti-check" style="font-size:10px"></i></th>
          <th style="text-align:center;padding:6px 8px;font-size:10.5px;color:var(--ht);font-weight:600;width:52px">Thu <i class="ti ti-check" style="font-size:10px"></i></th>
        </tr></thead>
        <tbody>`;
    areaChores.forEach(c=>{
      const tueOk=checks[c.id+'_tue']||false;
      const thuOk=checks[c.id+'_thu']||false;
      const showTue=c.day==='both'||c.day==='tuesday'||c.day==='daily';
      const showThu=c.day==='both'||c.day==='thursday'||c.day==='daily';
      const allDone=(!showTue||tueOk)&&(!showThu||thuOk);
      const lbl=kcChoreLabel(c.memberIds);

      let assignCell;
      if(ro){
        // Read-only: plain text label, no interactive picker
        assignCell=`<div style="font-size:11.5px;padding:4px 0;color:${lbl==='— Unassigned —'?'var(--ht)':'var(--tx)'}">${lbl}</div>`;
      }else{
        const memberChecks=kcLiveInMembers(c.memberIds).map(m=>{
          const checked=(c.memberIds||[]).includes(m.id)?'checked':'';
          return`<label style="display:flex;align-items:center;gap:7px;padding:5px 10px;cursor:pointer;font-size:11.5px;white-space:nowrap" onmouseover="this.style.background='rgba(0,0,0,.04)'" onmouseout="this.style.background=''">
            <input type="checkbox" ${checked} onchange="kcChoreToggle('${c.id}','${m.id}',this.checked)" style="accent-color:var(--sky);width:14px;height:14px;flex-shrink:0">
            ${esc(m.name)}${m.liveIn?'':' <span style="color:var(--ht);font-size:10px">(not live-in)</span>'}
          </label>`;
        }).join('');
        assignCell=`<div style="position:relative">
          <div onclick="kcPickerToggle(event,'${c.id}')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:4px 7px;border:1px solid var(--bdr);border-radius:5px;background:var(--surf);min-height:28px;gap:5px;font-size:11.5px;color:${lbl==='— Unassigned —'?'var(--ht)':'var(--tx)'}">
            <span id="kcp-lbl-${c.id}" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lbl}</span>
            <i class="ti ti-chevron-down" style="font-size:9px;color:var(--mt);flex-shrink:0"></i>
          </div>
          <div id="kcp-${c.id}" class="kcp-drop" style="display:none;position:absolute;top:calc(100% + 2px);left:0;right:0;z-index:200;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.12);max-height:180px;overflow-y:auto;padding:3px 0">
            ${memberChecks||'<div style="padding:8px 10px;font-size:11.5px;color:var(--ht)">No members yet</div>'}
          </div>
        </div>`;
      }

      html+=`<tr style="border-bottom:1px solid var(--bdr)${allDone?';background:rgba(59,170,90,.05)':''}">
        <td style="padding:7px 8px;font-size:12px;font-weight:500">${esc(c.chore)}</td>
        <td style="padding:7px 8px;font-size:11px;color:var(--mt);line-height:1.4">${esc(c.notes)}</td>
        <td style="padding:7px 8px;text-align:center">${dayBadge[c.day]||dayBadge.both}</td>
        <td style="padding:4px 8px;position:relative">${assignCell}</td>
        <td style="padding:7px 8px;text-align:center">
          ${showTue?`<input type="checkbox" ${tueOk?'checked':''} ${ro?'disabled':` onchange="kcCheck('${c.id}','tue',this.checked,this)"`} style="width:16px;height:16px;accent-color:var(--sky);cursor:${ro?'not-allowed':'pointer'};${ro?'opacity:.45':''}">`:
                   `<span style="color:var(--bdr)">—</span>`}
        </td>
        <td style="padding:7px 8px;text-align:center">
          ${showThu?`<input type="checkbox" ${thuOk?'checked':''} ${ro?'disabled':` onchange="kcCheck('${c.id}','thu',this.checked,this)"`} style="width:16px;height:16px;accent-color:var(--sky);cursor:${ro?'not-allowed':'pointer'};${ro?'opacity:.45':''}">`:
                   `<span style="color:var(--bdr)">—</span>`}
        </td>
      </tr>`;
    });
    html+=`</tbody></table></div>`;
  });
  html+='</div>';
  document.getElementById('kc-chores').innerHTML=html;
}

function kcPickerToggle(e, choreId){
  if(!canEditKcrew())return;
  e.stopPropagation();
  document.querySelectorAll('.kcp-drop').forEach(el=>{
    if(el.id!=='kcp-'+choreId)el.style.display='none';
  });
  const el=document.getElementById('kcp-'+choreId);
  if(el)el.style.display=el.style.display==='none'?'block':'none';
}

function kcChoreToggle(choreId, memberId, checked){
  if(!canEditKcrew()){toast('Only the President, VP, House Manager, or House Manager Assistant can edit chore assignments.','error');return;}
  const c=D.chores.list.find(x=>x.id===choreId);
  if(!c)return;
  if(!c.memberIds)c.memberIds=[];
  if(checked){if(!c.memberIds.includes(memberId))c.memberIds.push(memberId);}
  else{c.memberIds=c.memberIds.filter(id=>id!==memberId);}
  const lbl=document.getElementById('kcp-lbl-'+choreId);
  if(lbl){
    const text=kcChoreLabel(c.memberIds);
    lbl.textContent=text;
    lbl.style.color=c.memberIds.length?'var(--tx)':'var(--ht)';
  }
  saveD('chores');
  kcUpdateKpiOnly();
}

function kcCheck(choreId, dayKey, checked, cb){
  if(!canEditKcrew()){toast('Only the President, VP, House Manager, or House Manager Assistant can update chore check-ins.','error');return;}
  const wk=kcWeekKey();
  if(!D.chores.checks[wk])D.chores.checks[wk]={};
  D.chores.checks[wk][choreId+'_'+dayKey]=checked;
  saveD('chores');
  kcUpdateKpiOnly();
  const row=cb?.closest('tr');
  if(row){
    const wkChecks=D.chores.checks[wk]||{};
    const c=D.chores.list.find(x=>x.id===choreId);
    if(c){
      const showTue=c.day==='both'||c.day==='tuesday'||c.day==='daily';
      const showThu=c.day==='both'||c.day==='thursday'||c.day==='daily';
      const allDone=(!showTue||wkChecks[choreId+'_tue'])&&(!showThu||wkChecks[choreId+'_thu']);
      row.style.background=allDone?'rgba(59,170,90,.05)':'';
    }
  }
}

// ── CHORE MANAGER ──
const KC_DAY_OPTS=['both','tuesday','thursday','daily'];

function kcRenderChoreManager(){
  const wrap=document.getElementById('kc-chore-manager-wrap');
  const el=document.getElementById('kc-chore-manager');
  if(!wrap||!el)return;
  wrap.style.display=canEditKcrew()?'block':'none';
  if(!canEditKcrew())return;
  kcEnsureDefaults();
  const list=D.chores.list;
  // Derive area list for datalist suggestions
  const areas=[...new Set(list.map(c=>c.area))].filter(Boolean);
  el.innerHTML=`
    <datalist id="kc-area-list">${areas.map(a=>`<option value="${esc(a)}">`).join('')}</datalist>
    <div class="kc-chore-header" style="display:grid;grid-template-columns:1fr 1fr 1fr auto auto;gap:5px;align-items:center;margin-bottom:5px;padding:0 4px">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--ht)">Area</span>
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--ht)">Chore</span>
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--ht)">Notes</span>
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--ht)">Day</span>
      <span></span>
    </div>
    <div id="kc-chore-rows" style="display:flex;flex-direction:column;gap:4px">
      ${list.map((c,i)=>kcChoreRow(c,i)).join('')}
    </div>
    <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap">
      <button class="btn" onclick="kcAddChoreRow()" style="font-size:11px"><i class="ti ti-plus"></i>Add Chore</button>
      <button class="btn btn-d" onclick="kcResetChores()" style="font-size:11px">Reset to Defaults</button>
      <button class="btn btn-p" onclick="kcSaveChores()" style="margin-left:auto"><i class="ti ti-device-floppy"></i>Save Chores</button>
    </div>`;
}

function kcChoreRow(c,i){
  const inp=`style="width:100%;height:28px;padding:0 6px;border:1px solid var(--bdr);border-radius:5px;font-size:11px;font-family:inherit;color:var(--tx);background:var(--surf);outline:none"`;
  const dayOpts=KC_DAY_OPTS.map(d=>`<option value="${d}"${c.day===d?' selected':''}>${d.charAt(0).toUpperCase()+d.slice(1)}</option>`).join('');
  return`<div class="kc-chore-row" style="display:grid;grid-template-columns:1fr 1fr 1fr auto auto;gap:5px;align-items:center;padding:3px 0;border-bottom:1px solid var(--bdr)">
    <input class="kc-cr-area" value="${esc(c.area||'')}" placeholder="Area (e.g. 2nd Floor)" list="kc-area-list" ${inp}>
    <input class="kc-cr-chore" value="${esc(c.chore||'')}" placeholder="Chore description" ${inp}>
    <input class="kc-cr-notes" value="${esc(c.notes||'')}" placeholder="Notes (optional)" ${inp}>
    <select class="kc-cr-day" ${inp} style="width:90px;flex-shrink:0">${dayOpts}</select>
    <button onclick="kcDeleteChoreRow(this)" class="btn btn-d" style="padding:0 6px;height:26px;font-size:11px;flex-shrink:0" aria-label="Delete chore"><i class="ti ti-trash"></i></button>
  </div>`;
}

function kcAddChoreRow(){
  const rows=document.getElementById('kc-chore-rows');
  if(!rows)return;
  const div=document.createElement('div');
  div.innerHTML=kcChoreRow({area:'',chore:'',notes:'',day:'both'},0);
  rows.appendChild(div.firstElementChild);
  rows.querySelector('.kc-chore-row:last-child .kc-cr-chore')?.focus();
}

function kcDeleteChoreRow(btn){
  btn.closest('.kc-chore-row')?.remove();
}

function kcSaveChores(){
  if(!canEditKcrew()){toast('No permission to edit chores.','error');return;}
  const rows=document.querySelectorAll('#kc-chore-rows .kc-chore-row');
  const list=[];
  rows.forEach(row=>{
    const chore=(row.querySelector('.kc-cr-chore')?.value||'').trim();
    if(!chore)return;
    const area=(row.querySelector('.kc-cr-area')?.value||'').trim()||'General';
    const notes=(row.querySelector('.kc-cr-notes')?.value||'').trim();
    const day=row.querySelector('.kc-cr-day')?.value||'both';
    const existing=D.chores.list.find(c=>c.chore===chore&&c.area===area);
    list.push({id:existing?.id||('c'+uid()),area,chore,notes,day,memberIds:existing?.memberIds||[]});
  });
  if(!list.length){toast('Add at least one chore','error');return;}
  D.chores.list=list;
  saveD('chores');
  renderKcrew();
  toast('Chores saved','success');
}

function kcResetChores(){
  if(!canEditKcrew())return;
  if(!confirm('Reset all chores to defaults? Existing assignments will be cleared.'))return;
  D.chores.list=KC_DEFAULT_CHORES.map(c=>({...c,memberIds:[]}));
  D.chores.checks={};
  saveD('chores');
  renderKcrew();
  toast('Chores reset to defaults','success');
}

function kcUpdateKpiOnly(){
  kcEnsureDefaults();
  const wk=kcWeekKey();
  const checks=D.chores.checks[wk]||{};
  const list=D.chores.list;
  const assigned=list.filter(c=>c.memberIds&&c.memberIds.length>0).length;
  const tueChores=list.filter(c=>c.day==='both'||c.day==='tuesday'||c.day==='daily');
  const thuChores=list.filter(c=>c.day==='both'||c.day==='thursday'||c.day==='daily');
  const doneT=tueChores.filter(c=>checks[c.id+'_tue']).length;
  const doneH=thuChores.filter(c=>checks[c.id+'_thu']).length;
  document.getElementById('kc-kpi').innerHTML=
    statStrip('Chore Assignments',assigned+'/'+list.length,'Members assigned this semester','neutral')+
    statStrip('Tuesday Check-ins',doneT+'/'+tueChores.length,'Week of '+wk,'neutral')+
    statStrip('Thursday Check-ins',doneH+'/'+thuChores.length,'Week of '+wk,'neutral');
}

// ── PRINT (bulletin-board sheet) ──
// Opens a clean, chrome-free printable page in a new tab and triggers the browser's print
// dialog — "Save as PDF" from there is the standard way to get a PDF in a no-build-step
// vanilla app with no PDF library. Tue/Thu boxes print blank (for pen check-off on the wall),
// not whatever's currently checked in the app, since this is meant to be a fresh weekly sheet.
function kcPrintChores(){
  if(!D.chores||!D.chores.list||!D.chores.list.length){toast('No chores to print yet.','error');return;}
  const areas=[...new Set(KC_DEFAULT_CHORES.map(c=>c.area))];
  const dayLabel={both:'Tue &amp; Thu',tuesday:'Tuesday',thursday:'Thursday',daily:'Daily'};

  let body='';
  areas.forEach(area=>{
    const areaChores=D.chores.list.filter(c=>c.area===area);
    if(!areaChores.length)return;
    body+=`<h2>${esc(area)}</h2>
      <table>
        <thead><tr><th>Chore</th><th>Notes</th><th>Day</th><th>Assigned To</th><th>Tue</th><th>Thu</th></tr></thead>
        <tbody>${areaChores.map(c=>{
          const showTue=c.day==='both'||c.day==='tuesday'||c.day==='daily';
          const showThu=c.day==='both'||c.day==='thursday'||c.day==='daily';
          return`<tr>
            <td class="chore">${esc(c.chore)}</td>
            <td class="notes">${esc(c.notes)||''}</td>
            <td class="day">${dayLabel[c.day]||dayLabel.both}</td>
            <td class="assigned">${kcChoreLabel(c.memberIds)}</td>
            <td class="check">${showTue?'<span class="box"></span>':'—'}</td>
            <td class="check">${showThu?'<span class="box"></span>':'—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  });

  const chapterName=(CURRENT_USER&&CURRENT_USER.chapterName)||'Chapter';
  const printedOn=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chore Assignments</title>
    <style>
      @page{margin:0.5in}
      body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1a1a;margin:0;padding:24px}
      .hd{display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid #151008;padding-bottom:10px;margin-bottom:18px}
      .hd h1{font-size:22px;margin:0}
      .hd .sub{font-size:12px;color:#555}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#8a6d1f;border-bottom:2px solid #8a6d1f;padding-bottom:4px;margin:22px 0 8px;break-after:avoid}
      table{width:100%;border-collapse:collapse;margin-bottom:4px;break-inside:auto}
      tr{break-inside:avoid}
      th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:#666;padding:6px 8px;border-bottom:1px solid #ccc}
      td{padding:8px;font-size:12.5px;border-bottom:1px solid #e5e5e5;vertical-align:top}
      td.chore{font-weight:600;width:20%}
      td.notes{color:#555;width:32%}
      td.day{width:10%}
      td.assigned{width:20%;font-weight:500}
      td.check{width:9%;text-align:center}
      .box{display:inline-block;width:16px;height:16px;border:1.5px solid #333}
      @media print{ body{padding:0} }
    </style>
  </head><body>
    <div class="hd"><h1>Chore Assignments</h1><div class="sub">${esc(chapterName)} &middot; Printed ${printedOn}</div></div>
    ${body}
  </body></html>`;

  const win=window.open('','_blank');
  if(!win){toast('Pop-up blocked — allow pop-ups for this site to print.','error');return;}
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(),250);
}

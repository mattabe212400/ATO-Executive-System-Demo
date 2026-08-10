// ══════════════════════════════════════════════════
// ALUMNI RELATIONS
// ══════════════════════════════════════════════════
function renderAlumni(){
  const addBtn=document.getElementById('al-add-btn');
  if(addBtn)addBtn.style.display=canEditPage('alumni')?'':'none';
  const importBtn=document.getElementById('al-import-btn');
  if(importBtn)importBtn.style.display=canEditPage('alumni')?'':'none';
  const al=D.alumni;
  const recent=al.outreach.filter(o=>{if(!o.date)return false;return(new Date()-new Date(o.date+'T12:00:00'))<30*86400000;}).length;
  document.getElementById('al-kpi').innerHTML=
    statStrip('Total Alumni',al.contacts.length,'In directory','neutral')+
    statStrip('Recent Contacts',recent,'Last 30 days','neutral')+
    statStrip('Alumni Events',al.events.length,'On record','neutral');
  alRenderDirectory();
}
function alTab(el,tab){
  document.querySelectorAll('.al-tab').forEach(b=>b.classList.remove('active'));
  if(el)el.classList.add('active');
  ['al-directory','al-events','al-outreach'].forEach(t=>{const e=document.getElementById(t);if(e)e.style.display=t===tab?'':'none';});
  const addBtn=document.getElementById('al-add-btn');
  if(addBtn){
    addBtn.style.display=canEditPage('alumni')?'':'none';
    if(tab==='al-directory'){addBtn.textContent=''; addBtn.innerHTML='<i class="ti ti-plus"></i> Add Alumni';addBtn.onclick=alOpenAdd;}
    else if(tab==='al-events'){addBtn.innerHTML='<i class="ti ti-plus"></i> Add Event';addBtn.onclick=alOpenAddEvent;}
    else{addBtn.innerHTML='<i class="ti ti-plus"></i> Log Contact';addBtn.onclick=alOpenLogContact;}
  }
  const importBtn=document.getElementById('al-import-btn');
  if(importBtn)importBtn.style.display=(tab==='al-directory'&&canEditPage('alumni'))?'':'none';
  if(tab==='al-directory')alRenderDirectory();
  else if(tab==='al-events')alRenderEvents();
  else alRenderOutreach();
}
function alFilter(){alRenderDirectory();}
// Initiation Date is stored as ISO (YYYY-MM-DD) for anything entered through the date picker or a
// normalized CSV import, but records imported before that normalization existed can still hold a
// raw, non-ISO string (e.g. "01/01/1969") straight from someone's spreadsheet. Appending
// 'T12:00:00' to a string that already has its own date format (rather than ISO) produces
// something Date can't parse at all — so this tries the safe ISO+noon form first and falls back
// to handing the raw value straight to Date() for anything else, instead of assuming ISO always.
function alParseInitDate(val){
  if(!val)return null;
  const v=String(val).trim();
  const d=/^\d{4}-\d{2}-\d{2}$/.test(v)?new Date(v+'T12:00:00'):new Date(v);
  return isNaN(d.getTime())?null:d;
}
// Class year is just the year an alumnus was initiated (e.g. initiated 1/1/1969 -> Class 1969) —
// there's no separate Grad Year field to maintain.
function alClassYear(a){
  const d=alParseInitDate(a.initiationDate);
  return d?String(d.getFullYear()):'';
}
// Rebuilds the three filter dropdowns from whatever values currently exist across the whole
// directory (not the filtered subset) — otherwise narrowing one filter would prune the options
// available in the others, making it impossible to broaden back out.
function alPopulateFilters(){
  const classSel=document.getElementById('al-filter-class');
  const locSel=document.getElementById('al-filter-location');
  const indSel=document.getElementById('al-filter-industry');
  if(!classSel||!locSel||!indSel)return;
  const classes=[...new Set(D.alumni.contacts.map(a=>alClassYear(a)).filter(Boolean))].sort((a,b)=>b-a);
  const locations=[...new Set(D.alumni.contacts.map(a=>(a.location||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const industries=[...new Set(D.alumni.contacts.map(a=>(a.industry||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const curClass=classSel.value,curLoc=locSel.value,curInd=indSel.value;
  classSel.innerHTML='<option value="">All Class Years</option>'+classes.map(c=>`<option value="${esc(c)}" ${c===curClass?'selected':''}>${esc(c)}</option>`).join('');
  locSel.innerHTML='<option value="">All Locations</option>'+locations.map(l=>`<option value="${esc(l)}" ${l===curLoc?'selected':''}>${esc(l)}</option>`).join('');
  indSel.innerHTML='<option value="">All Industries</option>'+industries.map(i=>`<option value="${esc(i)}" ${i===curInd?'selected':''}>${esc(i)}</option>`).join('');
}
function alRenderDirectory(){
  alPopulateFilters();
  const q=document.getElementById('al-search')?.value?.toLowerCase()||'';
  const classFilter=document.getElementById('al-filter-class')?.value||'';
  const locFilter=document.getElementById('al-filter-location')?.value||'';
  const indFilter=document.getElementById('al-filter-industry')?.value||'';
  let rows=D.alumni.contacts;
  if(q)rows=rows.filter(a=>a.name.toLowerCase().includes(q)||(a.employer||'').toLowerCase().includes(q)||(a.location||'').toLowerCase().includes(q));
  if(classFilter)rows=rows.filter(a=>alClassYear(a)===classFilter);
  if(locFilter)rows=rows.filter(a=>(a.location||'').trim()===locFilter);
  if(indFilter)rows=rows.filter(a=>(a.industry||'').trim()===indFilter);
  const canEdit=canEditPage('alumni');
  const initials=name=>(name||'').trim().split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase()||'??';
  document.getElementById('al-table').innerHTML=`<thead><tr><th>Name</th><th>Class</th><th>Email</th><th>Phone</th><th>Initiated</th><th>Employer</th><th>Industry</th><th>Location</th><th>LinkedIn</th><th></th></tr></thead><tbody>${rows.length?rows.map(a=>{
    const li=a.linkedin?(/^https?:\/\//i.test(a.linkedin)?a.linkedin:'https://'+a.linkedin):'';
    const initD=alParseInitDate(a.initiationDate);
    const initDate=initD?`${String(initD.getMonth()+1).padStart(2,'0')}/${String(initD.getDate()).padStart(2,'0')}/${initD.getFullYear()}`:'—';
    return`<tr><td><div style="display:flex;align-items:center;gap:7px"><div class="sh-av" style="width:25px;height:25px;font-size:8.5px;flex-shrink:0">${esc(initials(a.name))}</div><span style="font-weight:500">${esc(a.name)}</span></div></td><td style="color:var(--mt);font-size:11.5px">${alClassYear(a)||'—'}</td><td style="color:var(--mt);font-size:11px">${esc(a.email)||'—'}</td><td style="color:var(--mt)">${esc(a.phone)||'—'}</td><td style="color:var(--mt)">${initDate}</td><td>${esc(a.employer)||'—'}</td><td style="color:var(--mt)">${esc(a.industry)||'—'}</td><td style="color:var(--mt)">${esc(a.location)||'—'}</td><td>${li?`<a href="${esc(li)}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><i class="ti ti-brand-linkedin"></i></a>`:'—'}</td><td>${canEdit?`<div style="display:flex;gap:5px"><button class="btn" style="height:23px;font-size:10px;padding:0 7px" onclick="alOpenEdit('${a.id}')" aria-label="Edit"><i class="ti ti-pencil"></i></button><button class="btn btn-d" style="height:23px;font-size:10px;padding:0 7px" onclick="deleteAlumni('${a.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button></div>`:''}</td></tr>`;
  }).join(''):'<tr><td colspan="10" style="text-align:center;color:var(--ht);padding:24px">No alumni in directory yet. Add the first one!</td></tr>'}</tbody>`;
  const mobEl=document.getElementById('al-mobile-cards');
  if(mobEl)mobEl.innerHTML=rows.length?rows.map(a=>{
    const li=a.linkedin?(/^https?:\/\//i.test(a.linkedin)?a.linkedin:'https://'+a.linkedin):'';
    return`<div class="mob-card card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div class="sh-av" style="width:34px;height:34px;font-size:12px;flex-shrink:0">${esc(initials(a.name))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.name)}</div>
          <div style="font-size:11px;color:var(--mt)">${alClassYear(a)?'Class of '+alClassYear(a):'—'}${a.location?' · '+esc(a.location):''}</div>
        </div>
        ${li?`<a href="${esc(li)}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" style="flex-shrink:0"><i class="ti ti-brand-linkedin"></i></a>`:''}
      </div>
      <div style="font-size:11.5px;color:var(--mt);margin-bottom:8px">${a.employer?esc(a.employer):'No employer on file'}${a.industry?' · '+esc(a.industry):''}</div>
      ${canEdit?`<div style="display:flex;gap:6px"><button class="btn" style="height:26px;font-size:11px;flex:1" onclick="alOpenEdit('${a.id}')"><i class="ti ti-pencil"></i>Edit</button><button class="btn btn-d" style="height:26px;font-size:11px;flex:1" onclick="deleteAlumni('${a.id}')"><i class="ti ti-trash"></i>Delete</button></div>`:''}
    </div>`;
  }).join(''):`<div style="grid-column:1/-1;text-align:center;color:var(--ht);padding:24px;font-size:12px">No alumni in directory yet. Add the first one!</div>`;
}
function alRenderEvents(){
  const ev=D.alumni.events;
  document.getElementById('al-events-table').innerHTML=`<thead><tr><th>Event</th><th>Date</th><th>Type</th><th>Location</th><th>Notes</th></tr></thead><tbody>${ev.length?ev.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr><td style="font-weight:500">${esc(e.title)}</td><td>${fds(e.date)}</td><td><span class="badge bb2">${esc(e.type)}</span></td><td style="color:var(--mt)">${esc(e.location)||'—'}</td><td style="color:var(--mt);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.notes)||'—'}</td></tr>`).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--ht);padding:24px">No alumni events yet.</td></tr>'}</tbody>`;
}
function alRenderOutreach(){
  const log=[...D.alumni.outreach].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const methIcon={Email:'ti-mail',Phone:'ti-phone',Text:'ti-message','In Person':'ti-user-check',LinkedIn:'ti-brand-linkedin'};
  document.getElementById('al-outreach-list').innerHTML=log.length?log.map(o=>{
    const al=D.alumni.contacts.find(a=>a.id===o.alumniId)||{name:'Unknown'};
    const by=mB(o.byId)||{name:'Unknown'};
    return`<div class="al-row"><div class="al-ic" style="background:var(--bl-bg);color:var(--bl-tx)"><i class="ti ${methIcon[o.method]||'ti-mail'}"></i></div><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:500">${esc(al.name)}</div><div style="font-size:10.5px;color:var(--mt);margin-top:1px">${esc(o.method)} · ${fds(o.date)} · by ${esc(by.name.split(' ')[0])}</div>${o.notes?`<div style="font-size:11px;color:var(--tx);margin-top:4px;line-height:1.5">${esc(o.notes)}</div>`:''}</div></div>`;
  }).join(''):es('ti-phone-off','blue','No outreach logged','Log alumni contacts to track your outreach.','');
}
function alOpenAdd(){
  if(!canEditPage('alumni')){toast('You do not have permission to add alumni.','error');return;}
  document.getElementById('al-edit-id').value='';
  document.getElementById('al-modal-title').textContent='Add Alumni';
  document.getElementById('al-save-btn').textContent='Add Alumni';
  ['al-name','al-email','al-phone','al-employer','al-location','al-notes','al-initdate','al-linkedin'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('al-industry').value='';
  openM('m-al-add');
}
function alOpenEdit(id){
  if(!canEditPage('alumni')){toast('You do not have permission to edit alumni.','error');return;}
  const a=D.alumni.contacts.find(x=>x.id===id);
  if(!a){toast('Alumni not found','error');return;}
  document.getElementById('al-edit-id').value=id;
  document.getElementById('al-modal-title').textContent='Edit Alumni';
  document.getElementById('al-save-btn').textContent='Save Changes';
  document.getElementById('al-name').value=a.name||'';
  document.getElementById('al-email').value=a.email||'';
  document.getElementById('al-phone').value=a.phone||'';
  // Feed the date input a normalized ISO value even for legacy non-ISO records (raw text a date
  // picker can't display) — re-saving from Edit then self-heals that record to ISO going forward.
  const initD=alParseInitDate(a.initiationDate);
  document.getElementById('al-initdate').value=initD?`${initD.getFullYear()}-${String(initD.getMonth()+1).padStart(2,'0')}-${String(initD.getDate()).padStart(2,'0')}`:'';
  document.getElementById('al-linkedin').value=a.linkedin||'';
  document.getElementById('al-employer').value=a.employer||'';
  document.getElementById('al-industry').value=a.industry||'';
  document.getElementById('al-location').value=a.location||'';
  document.getElementById('al-notes').value=a.notes||'';
  openM('m-al-add');
}
function alAddAlumni(){
  if(!canEditPage('alumni')){toast('You do not have permission to add alumni.','error');return;}
  const name=document.getElementById('al-name').value.trim();
  if(!name){toast('Name is required','error');return;}
  const editId=document.getElementById('al-edit-id').value;
  const fields={name,email:document.getElementById('al-email').value.trim(),phone:document.getElementById('al-phone').value.trim(),initiationDate:document.getElementById('al-initdate').value||'',linkedin:document.getElementById('al-linkedin').value.trim(),employer:document.getElementById('al-employer').value.trim(),industry:document.getElementById('al-industry').value,location:document.getElementById('al-location').value.trim(),notes:document.getElementById('al-notes').value.trim()};
  if(editId){
    const a=D.alumni.contacts.find(x=>x.id===editId);
    if(!a){toast('Alumni not found','error');return;}
    Object.assign(a,fields);
    saveD('alumni');closeM(null,document.getElementById('m-al-add'));renderAlumni();toast('Alumni updated','success');
    return;
  }
  D.alumni.contacts.push({id:uid(),...fields});
  saveD('alumni');closeM(null,document.getElementById('m-al-add'));renderAlumni();toast('Alumni added','success');
}
function alOpenAddEvent(){
  document.getElementById('ale-date').value=localDateStr();
  ['ale-title','ale-location','ale-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  openM('m-al-addevent');
}
function alAddEvent(){
  if(!canEditPage('alumni')){toast('You do not have permission to add alumni events.','error');return;}
  const title=document.getElementById('ale-title').value.trim();
  if(!title){toast('Event name is required','error');return;}
  D.alumni.events.push({id:uid(),title,date:document.getElementById('ale-date').value,type:document.getElementById('ale-type').value,location:document.getElementById('ale-location').value.trim(),notes:document.getElementById('ale-notes').value.trim()});
  saveD('alumni');closeM(null,document.getElementById('m-al-addevent'));alRenderEvents();toast('Event added','success');
}
function alOpenLogContact(){
  const asel=document.getElementById('alc-alumni');asel.innerHTML=D.alumni.contacts.map(a=>`<option value="${a.id}">${esc(a.name)} (${alClassYear(a)||'??'})</option>`).join('');
  if(!D.alumni.contacts.length){toast('Add alumni to the directory first','info');return;}
  document.getElementById('alc-date').value=localDateStr();
  document.getElementById('alc-notes').value='';
  openM('m-al-contact');
}
function alLogContact(){
  if(!canEditPage('alumni')){toast('You do not have permission to log alumni contact.','error');return;}
  const alumniId=document.getElementById('alc-alumni').value;
  if(!alumniId){toast('Select an alumni','error');return;}
  // "By" is always whoever is actually logging the contact, not a pickable field.
  D.alumni.outreach.push({id:uid(),alumniId,date:document.getElementById('alc-date').value,method:document.getElementById('alc-method').value,byId:CURRENT_USER?CURRENT_USER.mid:null,notes:document.getElementById('alc-notes').value.trim()});
  // Update last contact on alumni record
  const al=D.alumni.contacts.find(a=>a.id===alumniId);if(al)al.lastContact=document.getElementById('alc-date').value;
  saveD('alumni');closeM(null,document.getElementById('m-al-contact'));alRenderOutreach();toast('Contact logged','success');
}


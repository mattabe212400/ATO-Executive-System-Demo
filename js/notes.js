// ── MEETING NOTES CRUD ──

function canEditNotes(){
  return canEditPage('notes');
}

// ── Semester scoping — meeting notes already carry a real, user-editable `date` field, so this
// is pure date-range filtering (no stamp/migration needed), same pattern as Attendance.
let MN_SELECTED_SEM=null;
function mnSem(){ return MN_SELECTED_SEM||getSemester(); }
function mnKnownSemesters(){
  return unionKnownSemesters((D.notes||[]).map(n=>semesterLabelForDate(n.date)).filter(Boolean));
}
function mnVisibleNotes(){
  return (D.notes||[]).filter(n=>semesterLabelForDate(n.date)===mnSem());
}
function mnSemesterChanged(){
  MN_SELECTED_SEM=document.getElementById('notes-semester-select').value;
  renderNotes();
}
const NOTE_OFFICER_ROLES=[
  {id:'president',    label:'President'},
  {id:'vp',           label:'Vice President'},
  {id:'treasurer',    label:'Treasurer'},
  {id:'chaplain',     label:'Chaplain'},
  {id:'mem-ed',       label:'Membership Educator'},
  {id:'secretary',    label:'Secretary'},
  {id:'recruitment',  label:'Recruitment Chair'},
  {id:'comm-svc',     label:'Community Service Chair'},
  {id:'philanthropy', label:'Philanthropy Chair'},
  {id:'alumni',       label:'Alumni Relations Chair'},
  {id:'social',       label:'Social Chair'},
  {id:'risk',         label:'Risk Manager'},
  {id:'pr',           label:'Public Relations'},
  {id:'scholarship',  label:'Scholarship Chair'},
  {id:'house',        label:'House Manager'},
  {id:'im',           label:'IM Chair'},
  {id:'dads-day',     label:"Dad's Day Chair"},
  {id:'homecoming',   label:'Homecoming Chair'},
];

// Exec/retreat meetings only involve a subset of officer roles.
const NOTE_EXEC_ROLE_IDS=['president','vp','treasurer','chaplain','mem-ed','secretary','comm-svc','philanthropy','alumni','social','risk','pr','scholarship','house'];
const NOTE_GENERAL_ROLE={id:'general',label:'General'};

function mnRolesForType(type){
  if(type==='exec')return NOTE_OFFICER_ROLES.filter(r=>NOTE_EXEC_ROLE_IDS.includes(r.id));
  if(type==='retreat')return[...NOTE_OFFICER_ROLES.filter(r=>NOTE_EXEC_ROLE_IDS.includes(r.id)),NOTE_GENERAL_ROLE];
  return NOTE_OFFICER_ROLES;
}

function mnBuildOfficersList(){
  const type=document.getElementById('mn-tp').value;
  const roles=mnRolesForType(type);
  document.getElementById('mn-officers-list').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${
    roles.map(r=>`<div>
      <div style="font-size:10.5px;font-weight:600;margin-bottom:3px">${r.label}</div>
      <textarea id="mn-off-${r.id}" style="width:100%;height:38px;padding:5px 8px;border:1px solid var(--bdr);border-radius:6px;font-size:11.5px;font-family:inherit;resize:vertical;outline:none;transition:border .1s;box-sizing:border-box" placeholder="• Report..." onfocus="this.style.borderColor='var(--navy)'" onblur="this.style.borderColor='var(--bdr)'"></textarea>
    </div>`).join('')
  }</div>`;
  // Meeting Sections / Weekly Honors are chapter-meeting-only.
  const isChapter=type==='chapter';
  const sectionsEl=document.getElementById('mn-meeting-sections');
  const honorsEl=document.getElementById('mn-weekly-honors');
  if(sectionsEl)sectionsEl.style.display=isChapter?'':'none';
  if(honorsEl)honorsEl.style.display=isChapter?'':'none';
}

function openAddNote(){
  if(!isCurrentSemester(mnSem())){toast('This semester is read-only.','error');return;}
  document.getElementById('mn-edit-id').value='';
  document.getElementById('mn-modal-title').textContent='New Meeting Note';
  const mnChapter=document.getElementById('mn-chapter');
  if(mnChapter)mnChapter.value=D.settings?.chapterName||CURRENT_USER?.chapterName||'';
  mnBuildOfficersList();
  openM('m-addnote');
}

function openEditNote(id){
  if(!canEditNotes()){toast('Only the President, Vice President, and Secretary can edit meeting notes.','error');return;}
  const n=D.notes.find(x=>x.id===id);
  if(!n){toast('Note not found','error');return;}
  if(!isCurrentSemester(semesterLabelForDate(n.date))){toast('This meeting note is in a past semester and is read-only.','error');return;}
  document.getElementById('mn-edit-id').value=id;
  document.getElementById('mn-modal-title').textContent='Edit Meeting Note';
  document.getElementById('mn-tp').value=n.type||'chapter';
  mnBuildOfficersList();
  document.getElementById('mn-chapter').value=n.chapter||'';
  document.getElementById('mn-d').value=n.date||'';
  document.getElementById('mn-t').value=n.title||'';
  (n.officerReports||[]).forEach(r=>{
    const role=[...NOTE_OFFICER_ROLES,NOTE_GENERAL_ROLE].find(x=>x.label===r.role);
    const el=role?document.getElementById('mn-off-'+role.id):null;
    if(el)el.value=r.notes||'';
  });
  document.getElementById('mn-announcements').value=n.announcements||'';
  document.getElementById('mn-oldbiz').value=n.oldBusiness||'';
  document.getElementById('mn-newbiz').value=n.newBusiness||'';
  document.getElementById('mn-ooh').value=n.ooh||'';
  document.getElementById('mn-botw').value=n.botw||'';
  document.getElementById('mn-buffon').value=n.buffon||'';
  openM('m-addnote');
}

async function saveNoteForm(){
  if(!canEditNotes()){toast('Only the President, Vice President, and Secretary can save meeting notes.','error');return;}
  const title=document.getElementById('mn-t').value.trim();
  if(!title){toast('Meeting title is required','error');return;}
  const editId=document.getElementById('mn-edit-id').value;
  const date=document.getElementById('mn-d').value||localDateStr();
  if(editId){
    const existing=D.notes.find(x=>x.id===editId);
    if(existing&&!isCurrentSemester(semesterLabelForDate(existing.date))){toast('This meeting note is in a past semester and is read-only.','error');return;}
  } else if(!isCurrentSemester(mnSem())){
    toast('This semester is read-only.','error');return;
  }
  const chapter=document.getElementById('mn-chapter').value.trim()||D.settings?.chapterName||CURRENT_USER?.chapterName||'';
  const type=document.getElementById('mn-tp').value;
  const officerReports=mnRolesForType(type).map(r=>{
    const el=document.getElementById('mn-off-'+r.id);
    return{role:r.label,notes:el?el.value.trim():''};
  });
  const isChapter=type==='chapter';
  const fields={
    title,type,date,chapter,officerReports,
    announcements:isChapter?document.getElementById('mn-announcements').value.trim():'',
    oldBusiness:isChapter?document.getElementById('mn-oldbiz').value.trim():'',
    newBusiness:isChapter?document.getElementById('mn-newbiz').value.trim():'',
    ooh:isChapter?document.getElementById('mn-ooh').value.trim():'',
    botw:isChapter?document.getElementById('mn-botw').value.trim():'',
    buffon:isChapter?document.getElementById('mn-buffon').value.trim():'',
  };

  if(editId){
    const n=D.notes.find(x=>x.id===editId);
    if(!n){toast('Note not found','error');return;}
    const prev={...n};
    Object.assign(n,fields);
    n.body=buildNoteBody(n);
    try{
      await saveD('notes');
      closeM(null,document.getElementById('m-addnote'));
      renderNotes();toast('Meeting note updated','success');
    }catch(e){
      Object.assign(n,prev);
      toast('Failed to save note. Please try again.','error');
    }
    return;
  }

  const authorId=CURRENT_USER?CURRENT_USER.mid:null;
  const note={id:uid(),...fields,author:authorId,body:''};
  note.body=buildNoteBody(note);
  D.notes.unshift(note);
  try{
    await saveD('notes');
    closeM(null,document.getElementById('m-addnote'));
    ['mn-t','mn-announcements','mn-oldbiz','mn-newbiz','mn-ooh','mn-botw','mn-buffon'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    mnRolesForType(type).forEach(r=>{const el=document.getElementById('mn-off-'+r.id);if(el)el.value='';});
    document.getElementById('mn-chapter').value=D.settings?.chapterName||CURRENT_USER?.chapterName||'';
    renderNotes();toast('Meeting note saved','success');
  }catch(e){
    D.notes=D.notes.filter(n=>n.id!==note.id);
    toast('Failed to save note. Please try again.','error');
  }
}

function buildNoteBody(note){
  let parts=[];
  if(note.announcements)parts.push('Announcements: '+note.announcements);
  if(note.oldBusiness)parts.push('Old Business: '+note.oldBusiness);
  if(note.newBusiness)parts.push('New Business: '+note.newBusiness);
  if(note.ooh)parts.push('OOH: '+note.ooh);
  if(note.botw)parts.push('Brother of the Week: '+note.botw);
  if(note.buffon)parts.push('Buffon: '+note.buffon);
  return parts.join(' | ');
}

// ── EXPORT ──

function exportNote(id){
  const n=(D.notes||[]).find(x=>x.id===id);
  if(!n){toast('Note not found','error');return;}
  const w=window.open('','_blank','width=900,height=800');
  w.document.write(_buildExportHtml([n],false));
  w.document.close();
  setTimeout(()=>w.print(),600);
}


function _buildExportHtml(notes,withCover){
  const tn={chapter:'Chapter',exec:'Executive',judicial:'Judicial',retreat:'Retreat'};
  const bc={chapter:{bg:'#F9F3E1',fg:'#786017'},exec:{bg:'#EBF6FE',fg:'#1A6FA8'},judicial:{bg:'#FCDEDE',fg:'#840B0B'},retreat:{bg:'#DEFCF2',fg:'#0B835C'}};
  const today=new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const eh=s=>s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):'';

  function secHtml(label,text){
    if(!text)return'';
    const lines=text.split('\n').filter(Boolean);
    return`<div class="sec-t">${label}</div><div class="sec-b">${lines.map(l=>`<div class="bl">${l.startsWith('•')||l.startsWith('-')?eh(l):'• '+eh(l)}</div>`).join('')}</div>`;
  }

  function noteHtml(n,isLast){
    const typeName=tn[n.type]||n.type||'Chapter';
    const badge=bc[n.type]||bc.chapter;
    const dateStr=n.date?new Date(n.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}):'';
    const offs=(n.officerReports||[]).filter(r=>r.notes);
    const honors=[];
    if(n.ooh)honors.push({icon:'🏆',label:'OOH of the Week',val:n.ooh});
    if(n.botw)honors.push({icon:'⭐',label:'Brother of the Week',val:n.botw});
    if(n.buffon)honors.push({icon:'🤡',label:'Buffon of the Week',val:n.buffon});

    return`<div class="nd${isLast?'':' pb'}">
      <div class="nh">
        <span class="nb" style="background:${badge.bg};color:${badge.fg}">${typeName} Meeting</span>
        <div class="nt">${eh(n.title)}</div>
        <div class="nm">
          ${dateStr?`<span>📅 ${dateStr}</span>`:''}
          ${n.chapter?`<span>🏠 ${eh(n.chapter)}</span>`:''}
        </div>
      </div>
      ${offs.length?`<div class="sec-t">Officer Reports</div><table class="ot">${offs.map(r=>`<tr><td class="or">${eh(r.role)}</td><td class="on">${r.notes.split('\n').map(l=>`<div class="bl">${l.startsWith('•')||l.startsWith('-')?eh(l):'• '+eh(l)}</div>`).join('')}</td></tr>`).join('')}</table>`:''}
      ${secHtml('Announcements',n.announcements)}
      ${secHtml('Old Business',n.oldBusiness)}
      ${secHtml('New Business',n.newBusiness)}
      ${honors.length?`<div class="sec-t">Weekly Honors</div><div class="hr">${honors.map(h=>`<div class="hc"><div class="he">${h.icon}</div><div class="hl">${h.label}</div><div class="hv">${eh(h.val)}</div></div>`).join('')}</div>`:''}
      <div class="ft"><span>Alpha Tau Omega — ${eh(D.settings?.chapterName||CURRENT_USER?.chapterName||'')} Chapter</span><span>Exported ${today}</span></div>
    </div>`;
  }

  const chName=D.settings?.chapterName||CURRENT_USER?.chapterName||'';
  const cover=withCover?`<div class="cv"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(21,16,8,.6);margin-bottom:14px">Alpha Tau Omega · ${eh(chName)} Chapter</div><div style="font-size:30px;font-weight:700;letter-spacing:-.5px;margin-bottom:6px">Meeting Notes</div><div style="width:48px;height:3px;background:#151008;margin:18px 0;opacity:.3"></div><div style="font-size:13px;color:rgba(21,16,8,.75)">Exported ${today} &nbsp;·&nbsp; ${notes.length} meeting${notes.length!==1?'s':''}</div></div>`:'';

  return`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${withCover?'All Meeting Notes':eh(notes[0]&&notes[0].title||'Meeting Note')} — ATO ${eh(chName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:#fff;color:#111827;line-height:1.5}
.cv{background:#C9A227;color:#151008;padding:52px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.nd{padding:38px 52px}
.nh{margin-bottom:26px;padding-bottom:18px;border-bottom:2.5px solid #E5E7EB}
.nb{display:inline-block;font-size:9px;font-weight:700;font-family:inherit;text-transform:uppercase;letter-spacing:.1em;padding:3px 11px;border-radius:99px;margin-bottom:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.nt{font-size:24px;font-weight:700;color:#111827;margin-bottom:8px}
.nm{font-size:11px;color:#6B7280;display:flex;gap:18px;flex-wrap:wrap;font-family:inherit}
.sec-t{font-size:8px;font-weight:700;font-family:inherit;text-transform:uppercase;letter-spacing:.14em;color:#786017;margin-bottom:10px;margin-top:24px;padding-bottom:6px;border-bottom:1px solid #E5E7EB}
.sec-b{font-size:12.5px;line-height:1.75;color:#111827}
.bl{margin-bottom:4px;padding-left:2px}
.ot{width:100%;border-collapse:collapse;margin-top:4px}
.ot tr:not(:last-child) td{border-bottom:1px solid #E5E7EB}
.ot td{padding:8px 7px;font-size:12px;vertical-align:top;line-height:1.65}
.or{font-weight:600;color:#111827;width:155px;min-width:155px;font-family:inherit}
.on{color:#111827}
.hr{display:flex;gap:12px;margin-top:10px}
.hc{flex:1;background:#F2F4F7;border-radius:9px;padding:14px 10px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.he{font-size:26px;margin-bottom:7px}
.hl{font-size:8.5px;font-weight:700;font-family:inherit;text-transform:uppercase;letter-spacing:.08em;color:#6B7280;margin-bottom:5px}
.hv{font-size:13px;font-weight:600;color:#111827;font-family:inherit}
.ft{margin-top:34px;padding-top:13px;border-top:1px solid #E5E7EB;font-size:10px;color:#9CA3AF;display:flex;justify-content:space-between;font-family:inherit}
.pb{page-break-after:always;break-after:page}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cv{break-after:page;page-break-after:always}
  @page{margin:.4in;size:letter portrait}
}
</style></head><body>${cover}${notes.map((n,i)=>noteHtml(n,i===notes.length-1)).join('')}</body></html>`;
}

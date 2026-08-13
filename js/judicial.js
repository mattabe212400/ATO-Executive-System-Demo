// canEditSober(), renderSober(), and sober shift CRUD moved to js/sober.js.

function jbCanAccess(){
  return isLeadUser();
}

// ── Semester scoping — cases have no reliable creation date (hearingDate is optional and set
// later, sometimes never), so a semester is stamped once at filing time and never recomputed.
// Legacy pre-feature cases (no .semester) stay visible rather than vanishing.
let JB_SELECTED_SEM=null;
function jbSem(){ return JB_SELECTED_SEM||getSemester(); }
function jbKnownSemesters(){
  return unionKnownSemesters((D.cases||[]).map(c=>c.semester).filter(Boolean));
}
function jbVisibleCases(){
  return (D.cases||[]).filter(c=>!c.semester||c.semester===jbSem());
}
function jbSemesterChanged(){
  JB_SELECTED_SEM=document.getElementById('jb-semester-select').value;
  renderJudicialContent();
}

function renderJudicial(){
  if(!jbCanAccess()){
    document.getElementById('jb-gate').style.display='block';
    document.getElementById('jb-content').style.display='none';
    return;
  }
  document.getElementById('jb-gate').style.display='none';
  document.getElementById('jb-content').style.display='block';
  renderJudicialContent();
}

function renderJudicialContent(){
  initSemesterSelect('jb-semester-select',jbKnownSemesters(),jbSemesterChanged,jbSem());
  const sem=jbSem();
  const newBtn=document.getElementById('jb-new-case-btn');
  if(newBtn)newBtn.style.display=isCurrentSemester(sem)?'':'none';
  const cases=jbVisibleCases();
  const open=cases.filter(c=>!['resolved','dismissed'].includes(c.status));
  const res=cases.filter(c=>['resolved','dismissed'].includes(c.status));
  const jbCases=open.filter(c=>c.type==='jb-hearing');
  const mrCases=open.filter(c=>c.type==='membership-review');

  const tl={'jb-hearing':'JB Hearing','membership-review':'Membership Review'};
  const sl={open:'Open',scheduled:'Hearing Scheduled',pending:'Pending Review',resolved:'Resolved',appealed:'Appealed',dismissed:'Dismissed'};
  // Severity should ease as a case progresses toward resolution — open (earliest, least
  // progressed) reads as amber (needs attention), not red (which should stay reserved for
  // appealed, the one state where a resolved case is back in dispute).
  const sc={open:'ba2',scheduled:'bb2',pending:'bb2',resolved:'bg2',appealed:'br2',dismissed:'bm2'};

  function caseCard(c){
    const mem=mB(c.member);
    const memName=c.memberName||mem.name;
    const liveEmail=mem.email||c.contact||'';
    // "In Progress" is a computed display state, not a stored status — a case with a hearing
    // date that hasn't happened yet shows as In Progress regardless of its raw status, unless
    // it's already been finalized (resolved/dismissed/appealed).
    const finalized=['resolved','dismissed','appealed'].includes(c.status);
    const inProgress=!finalized&&c.hearingDate&&isUp(c.hearingDate);
    const statusLabel=inProgress?'In Progress':(sl[c.status]||esc(c.status));
    const statusClass=inProgress?'bb2':(sc[c.status]||'bm2');
    const hearingText=c.hearingDate?fds(c.hearingDate)+(c.hearingTime?' at '+to12h(c.hearingTime):''):'Not scheduled';
    return `<div class="jb-case-card">`+
      `<div class="case-header"><div><div class="case-num">${esc(c.caseNum)}</div><div class="case-name">${esc(memName)}</div></div>`+
      `<span class="badge ${statusClass}">${statusLabel}</span></div>`+
      `<div class="case-meta">`+
      (c.bylaw?`<span><i class="ti ti-book" style="font-size:11px"></i> ${esc(c.bylaw)}</span>`:'')+
      (liveEmail?`<span><i class="ti ti-mail" style="font-size:11px"></i> ${esc(liveEmail)}</span>`:'')+
      `<span><i class="ti ti-user" style="font-size:11px"></i> Filed by ${esc(c.filedByName||mB(c.filedBy).name)}</span>`+
      `<span><i class="ti ti-calendar-clock" style="font-size:11px"></i> Hearing: ${esc(hearingText)}</span></div>`+
      jbDocsHtml(c)+
      (isCurrentSemester(sem)?(
      `<div class="case-actions">`+
      `<button class="btn btn-p" style="height:26px;font-size:11px" onclick="openResolveCase('${c.id}')"><i class="ti ti-gavel"></i>Resolve</button>`+
      `<button class="btn" style="height:26px;font-size:11px" onclick="jbOpenScheduleHearing('${c.id}')"><i class="ti ti-calendar-event"></i>Schedule Hearing</button>`+
      `<button class="btn" style="height:26px;font-size:11px" onclick="jbEditStatus('${c.id}')"><i class="ti ti-edit"></i>Update Status</button>`+
      `<button class="btn btn-d" style="height:26px;font-size:11px" onclick="deleteCase('${c.id}')"><i class="ti ti-trash"></i>Delete</button>`+
      `</div>`):'')+
      `</div>`;
  }

  const empty=`<div style="color:var(--ht);font-size:12px;padding:14px 0;text-align:center">No active cases</div>`;
  document.getElementById('j-jb-cards').innerHTML=jbCases.length?jbCases.map(caseCard).join(''):empty;
  document.getElementById('j-mr-cards').innerHTML=mrCases.length?mrCases.map(caseCard).join(''):empty;
  const jbc=document.getElementById('j-jb-count');if(jbc){jbc.textContent=String(jbCases.length);jbc.style.display=jbCases.length?'':'none';}
  const mrc=document.getElementById('j-mr-count');if(mrc){mrc.textContent=String(mrCases.length);mrc.style.display=mrCases.length?'':'none';}

  document.getElementById('j-res').innerHTML=`<thead><tr><th>Case #</th><th>Type</th><th>Member</th><th>Resolution</th><th>Outcome</th><th>Docs</th><th></th></tr></thead><tbody>${res.length?res.map(c=>`<tr><td class="cn">${esc(c.caseNum)}</td><td>${tl[c.type]||esc(c.type)}</td><td style="font-weight:500">${esc(c.memberName||mB(c.member).name)}</td><td style="color:var(--mt);max-width:220px;white-space:normal;line-height:1.4">${esc(c.resolution)||'N/A'}</td><td><span class="badge ${sc[c.status]||'bm2'}">${sl[c.status]||esc(c.status)}</span></td><td>${jbDocsCompact(c)}</td><td>${isCurrentSemester(sem)?`<button class="btn btn-d" style="height:23px;font-size:10px;padding:0 7px" onclick="deleteCase('${c.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`:''}</td></tr>`).join(''):`<tr><td colspan="7" style="text-align:center;color:var(--mt);padding:18px">No resolved cases ${isCurrentSemester(sem)?'this semester':'in '+esc(sem)}</td></tr>`}</tbody>`;
  const resMobEl=document.getElementById('j-res-mobile-cards');
  if(resMobEl)resMobEl.innerHTML=res.length?res.map(c=>`<div class="mob-card card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
      <div class="cn" style="font-size:12px">${esc(c.caseNum)}</div>
      <span class="badge ${sc[c.status]||'bm2'}">${sl[c.status]||esc(c.status)}</span>
    </div>
    <div style="font-weight:600;font-size:13px;margin-bottom:2px">${esc(c.memberName||mB(c.member).name)}</div>
    <div style="font-size:11px;color:var(--mt);margin-bottom:6px">${tl[c.type]||esc(c.type)}</div>
    <div style="font-size:11.5px;color:var(--mt);line-height:1.4;margin-bottom:8px">${esc(c.resolution)||'N/A'}</div>
    ${jbDocsCompact(c)}
    ${isCurrentSemester(sem)?`<button class="btn btn-d" style="height:24px;font-size:10.5px;width:100%;margin-top:8px" onclick="deleteCase('${c.id}')" aria-label="Delete case ${esc(c.caseNum)}"><i class="ti ti-trash"></i>Delete</button>`:''}
  </div>`).join(''):`<div style="grid-column:1/-1;text-align:center;color:var(--mt);padding:18px;font-size:12px">No resolved cases ${isCurrentSemester(sem)?'this semester':'in '+esc(sem)}</div>`;

  const bylawsEl=document.getElementById('j-bylaws');
  if(bylawsEl&&!bylawsEl.children.length)renderBylaws();

  updateBadges();
}

function jbDocsHtml(c){
  const docs=c.docs||[];
  let html=`<div class="case-docs">`;
  if(docs.length){
    html+=docs.map(d=>
      `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--bdr)">`+
      `<i class="ti ti-paperclip" style="font-size:11px;color:var(--mt)"></i>`+
      `<span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${esc(d.name)}</span>`+
      `<span style="font-size:10px;color:var(--ht)">${(d.size/1024).toFixed(0)} KB</span>`+
      `<button class="btn" style="height:20px;font-size:10px;padding:0 6px" onclick="jbDownloadDoc('${c.id}','${d.id}')" aria-label="Download"><i class="ti ti-download"></i></button>`+
      `<button class="btn btn-d" style="height:20px;font-size:10px;padding:0 6px" onclick="jbDeleteDoc('${c.id}','${d.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>`+
      `</div>`
    ).join('');
  } else {
    html+=`<span style="font-size:11px;color:var(--ht)">No documents attached</span>`;
  }
  html+=`<button class="btn" style="height:23px;font-size:10.5px;margin-top:6px" onclick="jbOpenAttach('${c.id}')"><i class="ti ti-paperclip"></i>Attach Document</button>`;
  html+=`</div>`;
  return html;
}

// Compact doc list for the Resolved This Semester table — download-only, no attach/delete
// controls (those stay on the open-case card via jbDocsHtml above).
function jbDocsCompact(c){
  const docs=c.docs||[];
  if(!docs.length)return`<span style="color:var(--ht);font-size:11.5px">N/A</span>`;
  return docs.map(d=>
    `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap;margin-bottom:2px">`+
    `<i class="ti ti-paperclip" style="font-size:10px;color:var(--mt)"></i>`+
    `<span style="font-size:11px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.name)}">${esc(d.name)}</span>`+
    `<button class="btn" style="height:18px;font-size:9px;padding:0 4px" onclick="jbDownloadDoc('${c.id}','${d.id}')" aria-label="Download ${esc(d.name)}"><i class="ti ti-download"></i></button>`+
    `</div>`
  ).join('');
}

// Evidence blobs live in their own chapters/{id}/case-content/{docId} collection — same reason
// js/files.js keeps file content out of /data/files: a whole chapter's judicial history sharing
// one document (D.cases) can't absorb inline base64 without risking Firestore's 1MB doc cap.
// c.docs[] entries are metadata-only (id/name/size/mimeType/uploadedAt) going forward.
// Cases attached before this change may still have a legacy inline `data:` field — jbDownloadDoc
// below falls back to it so old attachments keep working with no migration needed.
const JB_STORE={}; // docId -> {base64, mediaType} — in-memory cache, mirrors FI_STORE
function jcContentPath(){ return [FS_PATH, FS_ID, 'case-content']; }

let _jbAttachCase=null;
function jbOpenAttach(caseId){
  _jbAttachCase=caseId;
  let inp=document.getElementById('jb-file-inp');
  if(!inp){
    inp=document.createElement('input');
    inp.type='file';
    inp.id='jb-file-inp';
    inp.style.display='none';
    inp.onchange=()=>jbHandleAttach(inp);
    document.body.appendChild(inp);
  }
  inp.value='';
  inp.click();
}

function jbHandleAttach(inp){
  const file=inp.files[0];
  if(!file)return;
  if(file.size>FI_MAX_BYTES){toast('File too large: max 600 KB','error');return;}
  const c=D.cases.find(x=>x.id===_jbAttachCase);
  if(!c)return;
  if(!c.docs)c.docs=[];
  const reader=new FileReader();
  reader.onload=async e=>{
    const b64=e.target.result.split(',')[1];
    const mt=file.type||'application/octet-stream';
    const id=uid();
    JB_STORE[id]={base64:b64,mediaType:mt};
    if(_db&&_fbFns){
      try{
        const {doc,setDoc}=_fbFns;
        await setDoc(doc(_db,...jcContentPath(),id),{b:b64,t:mt});
      }catch(err){
        console.warn('Case attachment save failed:',err.message);
        toast('Attachment saved for this session only (sync failed).','warning',5000);
      }
    }
    c.docs.push({id,name:file.name,size:file.size,mimeType:mt,uploadedAt:new Date().toISOString()});
    try{ await saveJudicialCase(c); }catch(err){ toast('Attachment recorded locally (failed to sync). Please try again.','error'); }
    renderJudicialContent();
    toast('Document attached','success');
  };
  reader.readAsDataURL(file);
}

async function jbDeleteDoc(caseId,docId){
  const ok=await confirmDialog('Remove Document','Remove this attachment? This cannot be undone.');
  if(!ok)return;
  const c=D.cases.find(x=>x.id===caseId);
  if(!c||!c.docs)return;
  c.docs=c.docs.filter(d=>d.id!==docId);
  try{ await saveJudicialCase(c); }catch(err){ toast('Failed to remove attachment. Please try again.','error'); }
  renderJudicialContent();
  delete JB_STORE[docId];
  if(_db&&_fbFns){
    try{ const {doc,deleteDoc}=_fbFns; await deleteDoc(doc(_db,...jcContentPath(),docId)); }
    catch(err){ console.warn('Case attachment content delete failed:',err.message); }
  }
  toast('Document removed','info');
}

async function jbDownloadDoc(caseId,docId){
  const c=D.cases.find(x=>x.id===caseId);
  if(!c)return;
  const docMeta=(c.docs||[]).find(d=>d.id===docId);
  if(!docMeta)return;
  if(docMeta.data){ // legacy inline attachment, predates the case-content split
    const a=document.createElement('a');
    a.href=docMeta.data;
    a.download=docMeta.name;
    a.click();
    return;
  }
  let mem=JB_STORE[docId];
  if(!mem&&_db&&_fbFns){
    try{
      const {doc,getDoc}=_fbFns;
      const snap=await getDoc(doc(_db,...jcContentPath(),docId));
      if(snap.exists()){
        const {b,t}=snap.data();
        JB_STORE[docId]={base64:b,mediaType:t};
        mem=JB_STORE[docId];
      }
    }catch(err){ console.warn('Case attachment fetch failed:',err.message); }
  }
  if(!mem){ toast('Document not available. It may need to be re-attached.','error'); return; }
  const a=document.createElement('a');
  a.href=`data:${mem.mediaType};base64,${mem.base64}`;
  a.download=docMeta.name;
  a.click();
}

function jbEditStatus(id){
  // Reuse the resolve modal for quick status updates too
  openResolveCase(id);
}

// ── BYLAWS DEFAULT CONTENT ──
function _jbDefaultArts(){
  return [
    {t:'Article I: Authority',b:'<p><strong>Sec. 1</strong> Bylaws established under authority of ATO Governance Documents. Nothing conflicting with Governance Documents shall exist in this chapter.</p><p><strong>Sec. 4</strong> Adopted or amended by 2/3 vote of active quorum. Proposed changes must be posted/emailed at least 13 days before vote.</p><p><strong>Sec. 6</strong> Power of interpretation rests with the Judicial Board.</p><p><strong>Sec. 8</strong> Bylaws may be suspended for a defined period by 3/4 vote of active quorum in a meeting called by the Worthy Master.</p>'},
    {t:'Article II: Definitions & Procedures',b:'<p><strong>Sec. 1: Bad Financial Risk</strong>: Determined by Worthy Keeper of the Exchequer; presented to Executive Board for vote based on ability to pay and past history.</p><p><strong>Sec. 2: Expulsion</strong>: Banishment from association with the house and all functions.</p><p><strong>Sec. 3: Suspension</strong>: Loses privileges for a defined period. No voting privileges while suspended.</p><p><strong>Sec. 4: Quorums:</strong></p><ul><li><strong>A. Active Quorum</strong>: Simple majority of actives with voting rights.</li><li><strong>B. Executive Board Quorum</strong>: 3/4 of exec board.</li><li><strong>C. Judicial Board Quorum</strong>: 2/3 of JB members.</li></ul>'},
    {t:'Article III: The Judicial Board',b:'<p><strong>A.</strong> Executive Board has delegated judicial responsibilities to the Judicial Board.</p><p><strong>B.</strong> Headed by Worthy Marshal; members appointed by Worthy Marshal and approved by Executive Board.</p><p><strong>C.</strong> Each member serves a single semester term.</p><p><strong>D. Duties:</strong> Hear appeals · Issue fines · Discipline members · Impose sanctions for bylaw violations.</p><p><strong>E.</strong> All members have the right to face their accuser directly.</p><p><strong>F.</strong> Accused must receive notice at least 3 business days prior to hearing.</p>'},
    {t:'Article VIII: Fines',b:'<p><strong>A.</strong> Fines levied may be placed on the house bill.</p><p><strong>B.</strong> Amount and type of fine depends on outcome of JB hearing.</p><p><strong>C.</strong> Fines collected by Worthy Marshal, payable to the Fraternity.</p><p><strong>D.</strong> No members are exempt from monetary fines.</p>'},
    {t:'Article IX: GPA Requirements',b:'<p><strong>A.</strong> Active members must maintain a semester GPA of at least 2.75 for good academic standing.</p><p><strong>B.</strong> 2 or more consecutive semesters below 2.75 GPA → subject to Membership Review.</p><p><strong>C.</strong> Semester GPA of 2.0 or lower for any single semester → subject to Membership Review.</p>'},
    {t:'Article XI: Hazing',b:'<p><strong>Sec. 1</strong> Physical hazing punishable by minimum 3-day suspension, at JB\'s discretion.</p><p><strong>Sec. 2</strong> Repeat offense brought before JB; if sufficient evidence found, subject to expulsion.</p>'},
    {t:'Article XII: Conduct',b:'<p><strong>Sec. 1</strong> Any act detrimental to the Fraternity or its host university → subject to JB discipline.</p><p><strong>Sec. 2: Illegal Substances</strong>: No illegal substances on Chapter property or at any Chapter function. First offense: suspension. Second offense: expulsion.</p>'},
    {t:'Article XIV: Discipline',b:'<p><strong>Sec. 1</strong> All disciplinary action directed to the Judicial Board. JB hears appeals, determines guilt, and administers appropriate action.</p><p><strong>Sec. 2</strong> Disciplinary action may consist of: reprimand, fine, sanction, suspension, or expulsion.</p>'},
  ];
}

// ── BYLAWS DISPLAY ──
function renderBylaws(){
  const el=document.getElementById('j-bylaws');
  if(!el)return;
  const isLead=isLeadUser();
  const arts=(D.settings?.bylaws?.length)?D.settings.bylaws:_jbDefaultArts();
  let html='';
  if(isLead){
    html+=`<div style="text-align:right;margin-bottom:8px"><button class="btn" style="height:25px;font-size:11px" onclick="openImportModal('bylaws')"><i class="ti ti-upload"></i>Import Bylaws</button></div>`;
  }
  // Bylaws intentionally support a little HTML (documented in the import instructions:
  // <strong>, <em>, <ul><li>) — sanitized here rather than trusted raw, since any lead account
  // (the only role that can import) could otherwise plant stored XSS a whole chapter renders.
  const sanitizeBylaw=html=>(typeof DOMPurify!=='undefined')
    ? DOMPurify.sanitize(html,{ALLOWED_TAGS:['strong','em','b','i','u','ul','ol','li','br','p','span'],ALLOWED_ATTR:[]})
    : esc(html); // DOMPurify failed to load — fail closed to plain text rather than raw HTML
  html+=arts.map(a=>`<details class="bylaw-art"><summary><i class="ti ti-chevron-right bylaw-caret"></i>${esc(a.t)}</summary><div class="bylaw-body">${sanitizeBylaw(a.b)}</div></details>`).join('');
  el.innerHTML=html;
}

// Bylaws are managed via CSV import now (see js/import.js, openImportModal('bylaws')) —
// _jbDefaultArts() below still backs the fallback shown before any import/customization,
// and is also the source for the downloadable generic bylaws template CSV.

function renderMembers(){
  const canEdit=canEditMembers();
  const addBtn=document.getElementById('members-add-btn');
  const impBtn=document.getElementById('members-import-btn');
  if(addBtn) addBtn.style.display=canEdit?'':'none';
  if(impBtn) impBtn.style.display=canEdit?'':'none';

  const newMemberCount=D.members.filter(m=>(m.memberStatus||'Active')==='New Member').length;
  document.getElementById('m-kpi').innerHTML=statStrip('Total Members',D.members.length,getSemester(),'neutral')+statStrip('Live-in',D.members.filter(m=>m.liveIn).length,'Chapter house','neutral')+statStrip('New Members',newMemberCount,'This semester','neutral')+statStrip('Graduating',D.members.filter(m=>m.year===2027).length,'Class of 2027','neutral');
  const editCol=canEdit?'<th></th>':'';
  const colCount=9+(canEdit?1:0);
  const q=(document.getElementById('m-search')||{value:''}).value.toLowerCase();
  const statusFlt=(document.getElementById('m-filter-status')||{value:''}).value;
  const filtered=q||statusFlt;
  const sortedMembers=[...D.members].filter(m=>{
    if(statusFlt&&(m.memberStatus||'Active')!==statusFlt)return false;
    if(q&&!(m.name||'').toLowerCase().includes(q))return false;
    return true;
  }).sort(mNameCompare);

  // Column order leads with what an officer scans a roster for — who, their standing, then
  // reference detail (major/hometown) last. Attendance and the old "Engagement" dot-column both
  // rendered the exact same aR(m.id) value as two separate columns; merged into one value+bar
  // cell here (same pattern the mobile card already used) rather than showing one number twice.
  const emptyRow=filtered
    ? `<tr><td colspan="${colCount}" style="text-align:center;color:var(--mt);padding:22px;font-size:12px">No members match your search or filter.</td></tr>`
    : `<tr><td colspan="${colCount}" style="padding:0">${es('ti-users','slate','No members yet',canEdit?'Add your first member to start the roster.':'Members will appear here once added.',canEdit?`<button class="btn btn-p" onclick="openM('m-addmember')"><i class="ti ti-plus"></i>Add Member</button>`:'')}</td></tr>`;
  document.getElementById('m-table').innerHTML=`<thead><tr><th>Member</th><th>Status</th><th>Role</th><th>Class</th><th>Grad Year</th><th>Attendance</th><th>Live-in</th><th>Major</th><th>Hometown</th>${editCol}</tr></thead><tbody>${sortedMembers.map(m=>{
    const r=aR(m.id);
    const tierColor=r>=85?'var(--gn)':r>=75?'var(--navy)':r>=65?'var(--am)':'var(--rd)';
    const status=m.memberStatus||'Active';
    const editCell=canEdit?`<td><button class="btn" style="height:23px;font-size:10.5px" onclick="openEditMember('${m.id}')" aria-label="Edit ${esc(m.name)}"><i class="ti ti-pencil"></i></button></td>`:'';
    return`<tr>
      <td><div style="display:flex;align-items:center;gap:7px"><div class="sh-av" style="width:25px;height:25px;font-size:8.5px;flex-shrink:0">${esc(m.initials)}</div><div style="min-width:0"><div style="font-weight:600">${esc(m.name)}</div>${m.email||m.phone?`<div style="font-size:10px;color:var(--mt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc([m.email,m.phone].filter(Boolean).join(' · '))}</div>`:''}</div></div></td>
      <td><span class="badge ${status==='New Member'?'bb2':'bm2'}">${esc(status)}</span></td>
      <td><span class="badge ${m.role!=='Member'?'bb2':'bm2'}">${esc(m.role)}</span></td>
      <td style="color:var(--mt);font-size:11.5px">${esc(m.classYear)}</td>
      <td style="color:var(--mt);font-size:11.5px">${m.year}</td>
      <td><div style="display:flex;align-items:center;gap:7px"><span style="font-weight:600;font-size:12px;color:${tierColor};min-width:30px">${r}%</span><div style="width:50px;height:5px;background:var(--surf2);border-radius:99px;overflow:hidden;flex-shrink:0"><div style="height:100%;width:${r}%;background:${tierColor};border-radius:99px"></div></div></div></td>
      <td style="color:var(--mt);font-size:11.5px">${m.liveIn?'Yes':'N/A'}</td>
      <td style="color:var(--mt);font-size:11.5px">${esc(m.major||'N/A')}</td>
      <td style="color:var(--mt);font-size:11.5px">${esc(m.hometown||'N/A')}</td>
      ${editCell}
    </tr>`;
  }).join('')||emptyRow}</tbody>`;

  const mob=document.getElementById('m-mobile-cards');
  if(mob){
    mob.innerHTML=sortedMembers.map(m=>{
      const r=aR(m.id);
      const rc=r>=85?'var(--gn)':r>=75?'var(--navy)':r>=65?'var(--am)':'var(--rd)';
      const status=m.memberStatus||'Active';
      const cardClick=canEdit?`tabindex="0" role="button" aria-label="Edit ${esc(m.name)}" onclick="openEditMember('${m.id}')"`:'' ;
      return`<div class="m-mob-card card" ${cardClick}>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div class="sh-av" style="width:38px;height:38px;font-size:13px;flex-shrink:0">${esc(m.initials)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
            <div style="font-size:11px;color:var(--mt)">${esc(m.classYear)} · ${m.year}</div>
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
          <span class="badge ${m.role!=='Member'?'bb2':'bm2'}" style="font-size:9.5px;white-space:nowrap">${esc(m.role)}</span>
          ${status==='New Member'?`<span class="badge bb2" style="font-size:9.5px;white-space:nowrap">New Member</span>`:''}
        </div>
        <div style="font-size:11.5px;color:var(--mt);margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.major||'N/A')}</div>
        <div style="display:flex;align-items:center;gap:7px">
          <div style="flex:1;height:4px;background:var(--bdr);border-radius:2px;overflow:hidden"><div style="height:100%;width:100%;transform-origin:left;transform:scaleX(${r/100});background:${rc};border-radius:2px;transition:transform .3s"></div></div>
          <span style="font-size:11px;font-weight:600;color:${rc};min-width:32px;text-align:right">${r}%</span>
        </div>
      </div>`;
    }).join('')||`<div style="grid-column:1/-1">${es('ti-users','slate',filtered?'No matches':'No members yet',filtered?'Try a different search or filter.':(canEdit?'Add your first member to start the roster.':'Members will appear here once added.'),(!filtered&&canEdit)?`<button class="btn btn-p" onclick="openM('m-addmember')"><i class="ti ti-plus"></i>Add Member</button>`:'')}</div>`;
  }
}

// renderCommittees() moved to js/committees.js — it grew into a full committee workspace
// (directory + detail page, roster/positions, tasks/events/files tabs, health score) and no
// longer belonged here.

// renderAnalytics() moved to js/analytics.js — it was never judicial-related code; it powers
// the main "Analytics & Reporting" nav page and belongs with the rest of the analytics logic.

// ── CASE CRUD ──
async function addCase(){
  if(!isLeadUser()){toast('Only a chapter lead can file judicial cases.','error');return;}
  const member=document.getElementById('nc-m').value;
  if(!member){toast('Select a member','error');return;}
  const type=document.getElementById('nc-type').value;
  const bylaw=document.getElementById('nc-bylaw').value.trim();
  const contact=document.getElementById('nc-contact').value.trim();
  const hearingDate=document.getElementById('nc-hdate').value;
  const hearingTime=document.getElementById('nc-htime').value;
  const filedBy=document.getElementById('nc-filedby').value||null;
  // Snapshot both names at filing time — mirrors attendance's memberNameSnapshot pattern
  // (js/attendanceSessions.js). Without this, a case outlives the member it's about whenever
  // they're later removed from the roster (e.g. "Dropped from Chapter"), and mB() has nothing
  // left to resolve — the live lookup below exists only as a fallback for cases filed before
  // this field existed.
  const newCase={id:uid(),caseNum:'CASE-0'+String(D.cases.length+10),member,memberName:mB(member).name,type,bylaw,contact,hearingDate,hearingTime,status:'open',resolution:'',filedBy,filedByName:filedBy?mB(filedBy).name:'',docs:[],semester:getSemester()};
  D.cases.push(newCase);
  try{
    await saveJudicialCase(newCase);
    closeM(null,document.getElementById('m-addcase'));
    ['nc-bylaw','nc-contact','nc-hdate','nc-htime'].forEach(id=>{document.getElementById(id).value='';});
    renderJudicial();toast('Case filed','success');
  }catch(e){
    D.cases=D.cases.filter(c=>c.id!==newCase.id);
    toast('Failed to file case. Please try again.','error');
  }
}
function jbOpenScheduleHearing(id){
  const c=D.cases.find(x=>x.id===id);if(!c)return;
  document.getElementById('sh-id').value=id;
  document.getElementById('sh-date').value=c.hearingDate||'';
  document.getElementById('sh-time').value=c.hearingTime||'';
  openM('m-schedulehearing');
}
async function jbSaveHearing(){
  if(!isLeadUser()){toast('Only a chapter lead can schedule judicial hearings.','error');return;}
  const id=document.getElementById('sh-id').value;
  const c=D.cases.find(x=>x.id===id);if(!c)return;
  if(c.semester&&!isCurrentSemester(c.semester)){toast('This case is in a past semester and is read-only.','error');return;}
  const prev={hearingDate:c.hearingDate,hearingTime:c.hearingTime};
  c.hearingDate=document.getElementById('sh-date').value||'';
  c.hearingTime=document.getElementById('sh-time').value||'';
  try{
    await saveJudicialCase(c);
    closeM(null,document.getElementById('m-schedulehearing'));
    renderJudicialContent();
    toast('Hearing scheduled','success');
  }catch(e){
    Object.assign(c,prev);
    toast('Failed to save hearing. Please try again.','error');
  }
}
function ncAutoFill(){
  const mid=document.getElementById('nc-m').value;
  const m=D.members.find(x=>x.id===mid);
  const ce=document.getElementById('nc-contact');
  if(m&&ce)ce.value=m.email||'';
}
function openResolveCase(id){
  const c=D.cases.find(c=>c.id===id);if(!c)return;
  document.getElementById('rc-id').value=id;
  document.getElementById('rc-r').value=c.resolution||'';
  document.getElementById('rc-s').value=c.status==='resolved'||c.status==='dismissed'?c.status:'resolved';
  openM('m-resolvecase');
}
async function resolveCase(){
  if(!isLeadUser()){toast('Only a chapter lead can resolve judicial cases.','error');return;}
  const id=document.getElementById('rc-id').value;
  const c=D.cases.find(c=>c.id===id);if(!c)return;
  if(c.semester&&!isCurrentSemester(c.semester)){toast('This case is in a past semester and is read-only.','error');return;}
  const res=document.getElementById('rc-r').value.trim();
  if(!res){toast('Resolution is required','error');return;}
  const status=document.getElementById('rc-s').value;
  const ok=await confirmDialog('Resolve Case',`Mark case ${c.caseNum} as "${status}"? This will move it to resolved cases.`,'Confirm',false);
  if(!ok)return;
  const prev={resolution:c.resolution,status:c.status};
  c.resolution=res;c.status=status;
  try{
    await saveJudicialCase(c);
    closeM(null,document.getElementById('m-resolvecase'));renderJudicial();toast('Case resolved','success');
  }catch(e){
    Object.assign(c,prev);
    toast('Failed to resolve case. Please try again.','error');
  }
}

// Sober shift CRUD (add/confirm/import) moved to js/sober.js.


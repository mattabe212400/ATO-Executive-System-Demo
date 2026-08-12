// ── FILE STORAGE: store base64 content in memory (not localStorage — too large)
const FI_STORE = {}; // id -> {name, type, size, base64, mediaType, text}

// ── Semester filter — Files is a persistent shared document library (bylaws, planning docs,
// exec handoff material), not semester-owned records: a file from Fall 2025 usually stays just
// as relevant as one from Fall 2026. So this is filter-only, defaulting to "All" — nothing is
// ever locked/hidden, and every file stays fully editable/deletable regardless of which semester
// it was uploaded in or which semester is selected. Deliberately does NOT reuse
// initSemesterSelect() (which always defaults to the current semester) since this selector needs
// an "All Semesters" default instead.
let FI_SELECTED_SEM='';
function fiKnownSemesters(){
  return unionKnownSemesters(D.files.map(f=>semesterLabelForDate(f.date)).filter(Boolean));
}
function fiVisibleFiles(list){
  return FI_SELECTED_SEM?list.filter(f=>semesterLabelForDate(f.date)===FI_SELECTED_SEM):list;
}
function fiSemesterChanged(){
  FI_SELECTED_SEM=document.getElementById('fi-semester-select').value;
  renderFiles();
}
function fiPopulateSemesterSelect(){
  const sel=document.getElementById('fi-semester-select');
  if(!sel)return;
  sel.innerHTML='<option value="">All Semesters</option>'+fiKnownSemesters().map(s=>`<option value="${esc(s)}" ${s===FI_SELECTED_SEM?'selected':''}>${esc(s)}</option>`).join('');
}

function fiDragOver(e){e.preventDefault();const t=e.currentTarget;t.style.borderColor='var(--sky)';t.style.background='var(--sky-bg)';}
function fiDragLeave(e){const t=e.currentTarget;t.style.borderColor='var(--bdr)';t.style.background='transparent';}

function handleFU(inp,folder){
  const f=folder||FI_CURRENT_FOLDER||'General';
  if(inp.files.length)fiProcessFiles(inp.files,f);
  inp.value='';
}

const FI_MAX_BYTES = 600 * 1024; // 600 KB raw — ~800 KB as base64, safely under Firestore 1 MB doc limit
function fiContentPath(){ return [FS_PATH, FS_ID, 'file-content']; }

// A committee's Chair can upload files scoped to their own committee even without Files page
// access (see firestore.rules' isCommitteeLeader) — canEditCommittee() lives in js/committees.js,
// guarded here since load order only guarantees infra files load first.
function canUploadFileForCommittee(committeeId){
  if(!committeeId)return false;
  if(typeof canEditCommittee!=='function')return false;
  const c=D.committees.find(c=>c.id===committeeId);
  return c?canEditCommittee(c):false;
}

function fiProcessFiles(files,folder,committeeId){
  committeeId=committeeId||null;
  if(committeeId&&!canWrite()&&!canUploadFileForCommittee(committeeId)){toast('You do not have permission to upload files for this committee.','error');return;}
  const targetFolder=folder||FI_CURRENT_FOLDER||'General';
  const all=Array.from(files);

  // Synchronous pre-flight — file.size is available without FileReader
  const rejected=all.filter(f=>f.size>FI_MAX_BYTES);
  const accepted=all.filter(f=>f.size<=FI_MAX_BYTES);

  if(rejected.length){
    const detail=rejected.map(f=>{
      const sz=f.size>1048576?(f.size/1048576).toFixed(1)+' MB':(f.size/1024).toFixed(0)+' KB';
      return`"${f.name}" (${sz})`;
    }).join(', ');
    toast(`${rejected.length} file${rejected.length>1?'s':''} exceed the 600 KB limit: ${detail}. Compress or use a link instead.`,'error',9000);
  }

  accepted.forEach(file=>{
    const id='f'+Date.now()+Math.random().toString(36).slice(2,6);
    const reader=new FileReader();
    reader.onload=async function(e){
      const b64=e.target.result.split(',')[1];
      const mt=file.type||'application/octet-stream';
      FI_STORE[id]={name:file.name,type:file.type,size:file.size,base64:b64,mediaType:mt};
      if(mt.includes('text')||mt.includes('csv')||file.name.endsWith('.csv')||file.name.endsWith('.txt')){
        FI_STORE[id].text=atob(b64);
      }
      const sizeStr=file.size>1048576?(file.size/1048576).toFixed(1)+' MB':(file.size/1024).toFixed(0)+' KB';
      const uploadedBy=CURRENT_USER?CURRENT_USER.mid:null;
      if(_db&&_fbFns){
        try{
          const {doc,setDoc}=_fbFns;
          await setDoc(doc(_db,...fiContentPath(),id),{b:b64,t:mt});
        }catch(err){
          console.warn('File content save failed:',err.message);
          toast('File saved for this session only (sync failed).','warning',5000);
        }
      }
      D.files.unshift({id,name:file.name,folder:targetFolder,size:sizeStr,date:localDateStr(),uploadedBy,committeeId});
      saveD('files');
      if(committeeId&&typeof coOnFilesChanged==='function')coOnFilesChanged(committeeId);
      else renderFiles();
    };
    reader.readAsDataURL(file);
  });
}

async function fiOpenDoc(id){
  let mem=FI_STORE[id];
  if(!mem&&_db&&_fbFns){
    try{
      const {doc,getDoc}=_fbFns;
      const snap=await getDoc(doc(_db,...fiContentPath(),id));
      if(snap.exists()){
        const {b,t}=snap.data();
        const meta=D.files.find(f=>f.id===id);
        FI_STORE[id]={base64:b,mediaType:t,name:meta?meta.name:id};
        mem=FI_STORE[id];
      }
    }catch(err){ console.warn('File fetch failed:',err.message); }
  }
  if(mem){
    window.open(`data:${mem.mediaType};base64,${mem.base64}`,'_blank');
  }else{
    toast('File not available, re-upload to view.','info');
  }
}



// ── FILES FOLDER STATE ──
let FI_CURRENT_FOLDER=null; // null = root view

// icon is a bare Tabler Icons suffix (rendered as `ti ti-${icon}` by fiIconGlyph()), not a
// literal glyph — keeps this list text-searchable and consistent with the rest of the app's
// icon language instead of embedding raw emoji.
const DEFAULT_FILE_FOLDERS=[
  {name:'President',icon:'crown',color:'var(--sky-tx)',bg:'var(--sky-bg)'},
  {name:'Vice President',icon:'star',color:'var(--sky-tx)',bg:'var(--sky-bg)'},
  {name:'Treasurer',icon:'cash',color:'var(--gn-tx)',bg:'var(--gn-bg)'},
  {name:'Risk Manager',icon:'shield',color:'var(--rd-tx)',bg:'var(--rd-bg)'},
  {name:'Secretary',icon:'clipboard-text',color:'var(--am-tx)',bg:'var(--am-bg)'},
  {name:'Chaplain',icon:'book-2',color:'var(--mt)',bg:'var(--surf2)'},
  {name:'New Member Educator',icon:'school',color:'var(--sky-tx)',bg:'var(--sky-bg)'},
  {name:'Recruitment Chair',icon:'user-plus',color:'var(--gn-tx)',bg:'var(--gn-bg)'},
  {name:'Social Chair',icon:'confetti',color:'var(--am-tx)',bg:'var(--am-bg)'},
  {name:'Philanthropy Chair',icon:'heart',color:'var(--rd-tx)',bg:'var(--rd-bg)'},
  {name:'Scholarship Chair',icon:'books',color:'var(--sky-tx)',bg:'var(--sky-bg)'},
  {name:'Alumni Relations Chair',icon:'building-bank',color:'var(--am-tx)',bg:'var(--am-bg)'},
  {name:'Public Relations Officer',icon:'speakerphone',color:'var(--sky-tx)',bg:'var(--sky-bg)'},
  {name:'Community Service Chair',icon:'plant-2',color:'var(--gn-tx)',bg:'var(--gn-bg)'},
  {name:'General',icon:'folder',color:'var(--mt)',bg:'var(--surf2)'},
];
// Folders created before this list moved to Tabler icon names may still hold a raw emoji
// character in storage (existing chapter data is never migrated) — render a generic folder
// icon for anything that isn't a plain icon-suffix string instead of printing the emoji.
function fiIconGlyph(icon){
  return/^[a-z0-9-]+$/i.test(icon||'')?`<i class="ti ti-${icon}"></i>`:'<i class="ti ti-folder"></i>';
}
function getFileFolders(){
  if(!D.settings)return DEFAULT_FILE_FOLDERS;
  if(!D.settings.fileFolders)D.settings.fileFolders=[...DEFAULT_FILE_FOLDERS];
  // Re-sync icon/color/bg for known position folders against the current defaults so chapters
  // whose data was saved before an icon fix (e.g. the invalid 'handshake' class) pick it up
  // automatically, instead of staying stuck on whatever was persisted at creation time.
  else D.settings.fileFolders=D.settings.fileFolders.map(f=>{
    const def=DEFAULT_FILE_FOLDERS.find(d=>d.name===f.name);
    return def?{...f,icon:def.icon,color:def.color,bg:def.bg}:f;
  });
  return D.settings.fileFolders;
}

function fiNavRoot(){
  FI_CURRENT_FOLDER=null;
  document.getElementById('fi-root-view').style.display='block';
  document.getElementById('fi-folder-view').style.display='none';
  const bc=document.getElementById('fi-bc-folder');
  bc.style.display='none';bc.innerHTML='';
  document.getElementById('fi-back-btn').style.display='none';
  renderFiles();
}

// Subfolders are plain folder objects whose `parent` names another folder's `name` — the file's
// own `folder` field stays a flat matching key exactly as before (no ID migration needed), it's
// just that a subfolder's `name` is namespaced as "Parent/Child" to stay unique, with `label`
// holding the short display text so cards/breadcrumbs don't show the full path.
function fiFolderChain(name){
  const folders=getFileFolders();
  const chain=[];
  let cur=folders.find(f=>f.name===name);
  while(cur){
    chain.unshift(cur);
    cur=cur.parent?folders.find(f=>f.name===cur.parent):null;
  }
  return chain;
}
function fiFolderDisplayName(name){
  const f=getFileFolders().find(x=>x.name===name);
  return f?(f.label||f.name):name;
}

function fiOpenFolder(folderName){
  FI_CURRENT_FOLDER=folderName;
  document.getElementById('fi-root-view').style.display='none';
  document.getElementById('fi-folder-view').style.display='block';
  const chain=fiFolderChain(folderName);
  const bc=document.getElementById('fi-bc-folder');
  bc.style.display='inline';
  bc.innerHTML=chain.map((f,i)=>{
    const label=esc(f.label||f.name);
    return i===chain.length-1
      ? ` / <span style="color:var(--tx);font-weight:500">${label}</span>`
      : ` / <span style="cursor:pointer" onclick="fiOpenFolderUpload('${encodeURIComponent(f.name)}')">${label}</span>`;
  }).join('');
  const currentLabel=chain.length?(chain[chain.length-1].label||chain[chain.length-1].name):folderName;
  document.getElementById('fi-back-btn').style.display='flex';
  document.getElementById('fi-drop-label').textContent='Upload to '+currentLabel+' folder';
  // Update file input to use this folder
  document.getElementById('fi-input').onchange=function(){handleFU(this,folderName);};
  renderFiles();
}

function fiOpenFolderUpload(encodedFolder){
  fiOpenFolder(decodeURIComponent(encodedFolder));
}

// Back steps up one level (to the parent folder) instead of always jumping to root, so browsing
// nested subfolders feels like a normal file explorer.
function fiBack(){
  const cur=getFileFolders().find(f=>f.name===FI_CURRENT_FOLDER);
  if(cur&&cur.parent)fiOpenFolder(cur.parent);else fiNavRoot();
}

function fiDropFolder(e){e.preventDefault();fiDragLeave(e);const files=e.dataTransfer.files;if(files.length)fiProcessFiles(files,FI_CURRENT_FOLDER||'General');}

function renderFiles(){
  fiPopulateSemesterSelect();
  const iconMap={pdf:'ti-file-type-pdf',xlsx:'ti-file-spreadsheet',xls:'ti-file-spreadsheet',csv:'ti-file-spreadsheet',docx:'ti-file-type-doc',doc:'ti-file-type-doc',txt:'ti-file-text',png:'ti-photo',jpg:'ti-photo',jpeg:'ti-photo'};
  const colorMap={pdf:'color:var(--rd)',xlsx:'color:var(--gn)',xls:'color:var(--gn)',csv:'color:var(--gn)',docx:'color:var(--bl)',doc:'color:var(--bl)',txt:'color:var(--mt)',png:'color:var(--am)',jpg:'color:var(--am)',jpeg:'color:var(--am)'};

  function fileCard(f){
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    const icon=iconMap[ext]||'ti-file';const col=colorMap[ext]||'color:var(--ht)';
    return`<div class="card" style="padding:10px 13px;display:flex;align-items:center;gap:10px">
      <i class="ti ${icon}" style="font-size:20px;flex-shrink:0;${col}"></i>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div>
        <div style="font-size:10.5px;color:var(--mt);margin-top:1px">${esc(fiFolderDisplayName(f.folder))} · ${f.size} · ${fds(f.date)}</div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0">
        <button class="btn" style="height:25px;font-size:11px" onclick="fiOpenDoc('${f.id}')"><i class="ti ti-eye"></i> View</button>
        <button class="btn btn-d" style="height:25px;font-size:11px;padding:0 8px" onclick="fiDelete('${f.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }

  // Committee files (f.committeeId set) live in that committee's own Files pane
  // (js/committees.js's coRenderFilesPane) — they're excluded from every chapter-wide folder
  // here so they never bleed into the shared General folder just because a committee's own
  // folder also happens to be named "General".
  // No per-card delete control here on purpose — deleting a folder now requires opening it and
  // clicking the dedicated red "Delete This Folder" button (see fiDeleteCurrentFolder()), so it
  // can't happen from a stray click on the grid.
  function folderCard(folder){
    const count=fiVisibleFiles(D.files.filter(f=>f.folder===folder.name&&!f.committeeId)).length;
    const encName=encodeURIComponent(folder.name);
    const label=folder.label||folder.name;
    return`<div class="folder-card">
      <div tabindex="0" role="button" aria-label="Open ${esc(label)}" onclick="fiOpenFolderUpload('${encName}')">
        <div class="folder-icon" style="background:${folder.bg};color:${folder.color}">${fiIconGlyph(folder.icon)}</div>
        <div>
          <div class="folder-name">${esc(label)}</div>
          <div class="folder-meta">${count} file${count!==1?'s':''}</div>
        </div>
      </div>
    </div>`;
  }

  if(FI_CURRENT_FOLDER){
    // Folder detail view — subfolders of the open folder, then its own directly-filed files
    const children=getFileFolders().filter(f=>f.parent===FI_CURRENT_FOLDER);
    const subEl=document.getElementById('fi-subfolders');
    if(subEl)subEl.innerHTML=children.map(folderCard).join('');
    const delBtn=document.getElementById('fi-delete-folder-btn');
    if(delBtn)delBtn.style.display=(FI_CURRENT_FOLDER==='General')?'none':'';

    const folderFiles=fiVisibleFiles(D.files.filter(f=>f.folder===FI_CURRENT_FOLDER&&!f.committeeId));
    const list=document.getElementById('fi-list');
    const empty=document.getElementById('fi-empty');
    const cnt=document.getElementById('fi-folder-count');
    if(cnt)cnt.textContent=folderFiles.length+' file'+(folderFiles.length!==1?'s':'');
    if(list)list.innerHTML=folderFiles.map(fileCard).join('');
    if(empty){empty.innerHTML=folderFiles.length?'':es('ti-cloud-upload','slate','No files in this folder','Upload documents, spreadsheets, or PDFs to this position folder.',``);empty.style.display=folderFiles.length?'none':'block';}
  } else {
    // Root view: only top-level folders (subfolders only ever show inside their parent)
    const _ff=getFileFolders().filter(f=>!f.parent);
    const foldersEl=document.getElementById('fi-folders');
    if(foldersEl)foldersEl.innerHTML=_ff.map(folderCard).join('');

    const totalFiles=fiVisibleFiles(D.files.filter(f=>!f.committeeId)).length;
    const cntEl=document.getElementById('fi-count');
    if(cntEl)cntEl.textContent=totalFiles+' file'+(totalFiles!==1?'s':'')+' total';
  }
}
function fiOpenAddFolder(){
  document.getElementById('fi-folder-name').value='';
  document.getElementById('fi-folder-icon').value='folder';
  const parent=FI_CURRENT_FOLDER;
  const titleEl=document.getElementById('fi-addfolder-title');
  if(titleEl)titleEl.textContent=parent?('New Subfolder in '+fiFolderDisplayName(parent)):'New Folder';
  openM('m-fi-addfolder');
}
function fiAddFolder(){
  if(!isLeadUser()){toast('Only a chapter lead can create folders.','error');return;}
  const label=document.getElementById('fi-folder-name').value.trim();
  if(!label){toast('Folder name is required','error');return;}
  const parent=FI_CURRENT_FOLDER||null;
  // Subfolder identity is namespaced under its parent's name so a leaf name can be reused under
  // different parents (e.g. two folders each with a "Contracts" subfolder) without colliding.
  const key=parent?parent+'/'+label:label;
  const folders=getFileFolders();
  if(folders.find(f=>f.name.toLowerCase()===key.toLowerCase())){toast('A folder with that name already exists here','error');return;}
  const icon=document.getElementById('fi-folder-icon').value.trim()||'folder';
  if(!D.settings.fileFolders)D.settings.fileFolders=[...DEFAULT_FILE_FOLDERS];
  D.settings.fileFolders.push(parent?{name:key,label,parent,icon,color:'var(--mt)',bg:'var(--surf2)'}:{name:key,icon,color:'var(--mt)',bg:'var(--surf2)'});
  saveD('settings');closeM(null,document.getElementById('m-fi-addfolder'));renderFiles();toast('Folder created','success');
}
// Only reachable from inside the open folder itself (the "Delete This Folder" button) — there's
// no delete control on the folder grid/cards anymore, so this can't fire from a stray click.
function fiDeleteCurrentFolder(){
  if(!FI_CURRENT_FOLDER)return;
  fiDeleteFolder(FI_CURRENT_FOLDER);
}
// Deleting a folder cascades to every subfolder beneath it (recursively) — a folder with children
// left behind but no way to reach them would just be an orphan, not a smaller tree.
function fiCollectDescendantFolders(folderName){
  const folders=getFileFolders();
  let names=[folderName],frontier=[folderName];
  while(frontier.length){
    const kids=folders.filter(f=>frontier.includes(f.parent)).map(f=>f.name).filter(n=>!names.includes(n));
    names=names.concat(kids);
    frontier=kids;
  }
  return names;
}
async function fiDeleteFolder(folderName){
  if(!isLeadUser()){toast('Only a chapter lead can delete folders.','error');return;}
  if(folderName==='General'){toast('The General folder can\'t be deleted. It\'s the fallback home for orphaned files.','error');return;}
  const allNames=fiCollectDescendantFolders(folderName);
  const subCount=allNames.length-1;
  const count=D.files.filter(f=>allNames.includes(f.folder)).length;
  let msg='Delete "'+fiFolderDisplayName(folderName)+'"?';
  if(subCount)msg+=' This will also delete '+subCount+' subfolder'+(subCount!==1?'s':'')+'.';
  if(count)msg+=' '+count+' file'+(count!==1?'s':'')+' will be moved to General.';
  const ok=await confirmDialog('Delete Folder',msg,'Delete',true);
  if(!ok)return;
  D.files.forEach(f=>{if(allNames.includes(f.folder))f.folder='General';});
  if(!D.settings.fileFolders)D.settings.fileFolders=[...DEFAULT_FILE_FOLDERS];
  D.settings.fileFolders=D.settings.fileFolders.filter(f=>!allNames.includes(f.name));
  saveD('files','settings');
  if(FI_CURRENT_FOLDER&&allNames.includes(FI_CURRENT_FOLDER))fiNavRoot();else renderFiles();
  toast('Folder deleted','info');
}

function renderNotifications(){
  // audienceMemberIds is optional and additive — absent means "everyone" (every notif before
  // this feature behaved that way), present means only those members should see it (e.g. a
  // personal "you haven't checked in yet" reminder for an open attendance session).
  const forMe=n=>!n.audienceMemberIds || n.audienceMemberIds.includes(CURRENT_USER?.mid);
  const visNotifs=D.notifs.filter(n=>n.type!=='judicial'&&forMe(n));
  const unr=visNotifs.filter(n=>!n.read).length;
  document.getElementById('no-cnt').textContent='Notifications'+(unr?': '+unr+' new':'');
  const ic={attendance:'ti-alert-circle',task:'ti-clock',warning:'ti-alert-triangle',judicial:'ti-scale',sober:'ti-shield-check',general:'ti-bell',deadline:'ti-clock',finance:'ti-cash',info:'ti-info-circle'};
  const co={attendance:'background:var(--rd-bg);color:var(--rd-tx)',task:'background:var(--am-bg);color:var(--am-tx)',warning:'background:var(--am-bg);color:var(--am-tx)',judicial:'background:var(--bl-bg);color:var(--bl-tx)',sober:'background:var(--gn-bg);color:var(--gn-tx)',finance:'background:var(--gn-bg);color:var(--gn-tx)',info:'background:var(--bl-bg);color:var(--bl-tx)'};
  const visibleNotifs=D.notifs.filter(n=>n.type!=='judicial'&&forMe(n));
  document.getElementById('no-list').innerHTML=visibleNotifs.map(n=>{
    const linkClick=n.link?`onclick="nRead('${n.id}');rbacNav('${n.link}',null)"`:(`onclick="nRead('${n.id}')"`);
    return`<div class="ni-item ${n.read?'':'unread'}" ${linkClick} style="cursor:${n.link?'pointer':'default'}">
      <div class="al-ic" style="${co[n.type]||'background:#F1F3F6;color:var(--mt)'}"><i class="ti ${ic[n.type]||'ti-bell'}" style="font-size:13px"></i></div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:${n.read?400:500}">${esc(n.title)}${n.autoKey?'<span style="font-size:9px;color:var(--ht);margin-left:6px;font-weight:400">auto</span>':''}</div>
        <div style="font-size:11px;color:var(--mt);margin-top:2px">${esc(n.body)}</div>
        <div style="font-size:10px;color:var(--ht);margin-top:3px">${n.date||n.time||''}</div>
      </div>
      ${!n.read?'<div class="ni-dot"></div>':''}
    </div>`;
  }).join('')||es('ti-bell-off','slate','All caught up','No new notifications right now.','');
  updateBadges();
}

// ── EXEC POSITION FOLDERS ──
// icon is a bare Tabler Icons suffix (rendered via fiIconGlyph()), not a literal glyph.
const EXEC_POSITIONS=[
  {role:'President',          icon:'crown', color:'var(--sky-tx)', bg:'var(--sky-bg)',
   responsibilities:['Lead chapter operations and exec team','Chair all chapter and exec meetings','Represent chapter to ISU, IFC, and ATO national','Manage judicial board and standards enforcement','Final approval on all major chapter decisions'],
   recurringTasks:['Weekly exec check-ins (Monday)','Monthly report to ATO national advisor','Semester goal-setting with exec team','Sign all chapter contracts and official documents','IFC President meetings (bi-weekly)'],
   wishIKnew:'The job is 80% communication and follow-up. Your exec team will only move as fast as you hold them accountable. Set clear weekly expectations and never let a deadline slip twice.'},
  {role:'Vice President',     icon:'star', color:'var(--sky-tx)', bg:'var(--sky-bg)',
   responsibilities:['Run chapter meetings and set agendas','Track officer accountability and task completion','Serve as President backup at all events','Coordinate committee chairs and their reports','Manage chapter calendar and event scheduling'],
   recurringTasks:['Weekly VP checklist','Monday agenda prep and officer check-ins','Send weekly chapter digest email','Attendance follow-up for members below 75%','Coordinate with Secretary on meeting minutes'],
   wishIKnew:'Agenda discipline makes or breaks chapter meetings. Send the agenda 24 hours out, stick to time limits, and never let open forum run more than 5 minutes. Brothers appreciate efficiency.'},
  {role:'Treasurer',          icon:'cash', color:'var(--gn-tx)', bg:'var(--gn-bg)',
   responsibilities:['Manage all chapter finances and bank accounts','Collect and track semester dues','Approve all chapter expenditures','Maintain semester budget and financial reports','File all required financial reports with IFC and nationals'],
   recurringTasks:['Weekly dues reminder to unpaid members','Monthly budget vs. actuals report to exec','IFC financial reporting (semester deadlines)','Annual audit with chapter advisor','Semester budget planning before each semester'],
   wishIKnew:'Chase dues early and often. The first 3 weeks of the semester set the tone. Members who don\'t pay by Week 4 rarely pay voluntarily. Know exactly what IFC requires and when. Late filings are a big deal.'},
  {role:'Secretary',          icon:'clipboard-text', color:'var(--am-tx)', bg:'var(--am-bg)',
   responsibilities:['Record and publish all chapter meeting minutes','Maintain official chapter roster and member records','Handle chapter correspondence and official communications','Track and submit all required reports to nationals','Manage chapter calendar accuracy'],
   recurringTasks:['Minutes published within 24 hours of each meeting','Roster update at start of each semester','Monthly report to ATO national (online portal)','Attendance records kept current in platform','Email archive maintained for the semester'],
   wishIKnew:'The national portal deadlines sneak up on you. Build calendar reminders for every reporting deadline on Day 1. Keep the chapter roster obsessively up to date. Everything else in the platform depends on it.'},
  {role:'Recruitment Chair',  icon:'user-plus', color:'var(--gn-tx)', bg:'var(--gn-bg)',
   responsibilities:['Plan and execute all rush events each semester','Manage the recruitment CRM and rushee pipeline','Coordinate bid day and new member onboarding','Lead the recruitment committee','Track and report recruitment metrics'],
   recurringTasks:['Weekly CRM review and rushee follow-ups','Rush event debrief within 24 hours','Recruiter leaderboard and accountability tracking','IFC recruitment registration and compliance','Post-rush debrief report at end of each semester'],
   wishIKnew:'Relationships close bids, not events. Your brothers who personally invite rushees and follow up 1-on-1 are worth more than any event. Train every brother on how to have a conversation, not just a sales pitch.'},
  {role:'Risk Manager',       icon:'shield', color:'var(--rd-tx)', bg:'var(--rd-bg)',
   responsibilities:['Enforce all risk management policies at events','Schedule and manage social monitor rotations','Conduct event safety walkthroughs','Handle incident documentation and reporting','Liaise with ISU and ATO national on risk matters'],
   recurringTasks:['Social monitor schedule filled 1 week in advance','Event approval sign-off for every social event','Weekly check of social monitor confirmations','Risk policy review at start of each semester','Post-event incident reports (if applicable)'],
   wishIKnew:'The social monitor schedule is your most important recurring task. Never let it go unfilled. One incident without documentation ruins the chapter. Get your FIPG training done in the first week and make sure exec knows the policy cold.'},
  {role:'Social Chair',       icon:'confetti', color:'var(--am-tx)', bg:'var(--am-bg)',
   responsibilities:['Plan and execute all chapter social events','Coordinate with co-host organizations','Manage event budgets in coordination with Treasurer','Ensure all socials are approved by Risk Manager','Build and maintain vendor relationships'],
   recurringTasks:['Submit event proposals to exec 2 weeks in advance','Confirm venue, catering, and transportation 1 week out','Brief brothers on event logistics 48 hours before','Post-event debrief and vendor rating update','Semester event calendar submitted Week 1'],
   wishIKnew:'Book popular venues in the first week of the semester or they\'ll be gone. Always have a backup plan for venue and catering. Your vendor list in the platform is gold. Update it after every event while details are fresh.'},
  {role:'Philanthropy Chair', icon:'heart', color:'var(--rd-tx)', bg:'var(--rd-bg)',
   responsibilities:['Organize all chapter fundraising events','Track and report money raised toward the semester fundraising goal','Build and maintain relationships with the nonprofits/causes the chapter supports','Run the philanthropy committee','Coordinate with Community Service Chair on shared events'],
   recurringTasks:['Fundraising log updated within 24 hours of each event','Chapter fundraising goal tracked in platform','At least 1 fundraising event per semester','Thank-you notes sent to partner orgs within 48 hours','Organizations list kept current in platform'],
   wishIKnew:'Fundraising and service hours are two different jobs now. You own the money raised, Community Service owns the hours logged. Coordinate closely since events often overlap. Brothers give more when you make the ask specific: a dollar goal, a deadline, and where the money goes.'},
  {role:'Scholarship Chair',  icon:'books', color:'var(--sky-tx)', bg:'var(--sky-bg)',
   responsibilities:['Track and report all member GPAs each semester','Identify and support members on academic probation','Run the scholarship committee and study programs','Submit GPA reports to IFC and ATO national','Coordinate academic support resources with ISU'],
   recurringTasks:['GPA collection within first 3 weeks of semester','Academic probation check-ins (weekly)','Study hours tracking if chapter policy requires','IFC GPA report (end of semester deadline)','Chapter GPA award at end-of-semester recognition night'],
   wishIKnew:'Collecting GPAs is harder than it sounds. Send a platform link and make it part of the first chapter meeting. Members on probation often hide it. Check in with them privately, not in front of the chapter.'},
  {role:'House Manager',      icon:'home', color:'var(--mt)', bg:'var(--surf2)',
   responsibilities:['Manage chapter house maintenance and repairs','Coordinate with house corporation on major repairs','Enforce house rules and cleanliness standards','Manage room assignments and live-in rosters','Handle vendor relationships for house services'],
   recurringTasks:['Weekly house walkthrough and maintenance log','Monthly report to house corporation','Room assignment updates at semester start','Utilities and vendor payments tracked with Treasurer','Move-in and move-out inspection checklists'],
   wishIKnew:'Build a relationship with the house corporation contact in Week 1. Keep a running maintenance log. It protects you when something goes wrong. Never pay for a repair out of pocket without exec approval and documentation.'},
  {role:'New Member Educator',icon:'school', color:'var(--sky-tx)', bg:'var(--sky-bg)',
   responsibilities:['Design and run the semester new member education program','Track new member progress through all milestones','Coordinate with Chaplain on ritual components','Ensure NME program is compliant with ATO standards','Manage big/little matching process'],
   recurringTasks:['Weekly NME session planning and facilitation','New member progress tracked in Ritual & Education section','Big/little matching completed by Week 4','Standards tests administered and graded','Initiation logistics coordinated with Chaplain and President'],
   wishIKnew:'The new member experience sets the tone for how brothers engage with the chapter for their entire time here. Take it seriously. The ritual section in the platform helps track every milestone. Use it every week, not just at initiation.'},
  {role:'Chaplain',           icon:'book-2', color:'var(--mt)', bg:'var(--surf2)',
   responsibilities:['Lead chapter in ritual and spiritual life','Coordinate all formal ritual ceremonies','Maintain ritual materials and ensure their security','Run the brother of the week and chapter prayer traditions','Support members through personal challenges'],
   recurringTasks:['Chapter opening and closing ritual at every meeting','Coordinate initiation ceremony logistics with NME','Brother of the Week nomination at every chapter meeting','Ritual equipment inventory at start of each semester','Support member wellness: connect struggling brothers to resources'],
   wishIKnew:'The ritual materials are your most important responsibility. Know where they are at all times. Initiation coordination with the NME takes 3-4 weeks of planning. Start early. Your informal role supporting brothers personally matters more than most execs realize.'},
  {role:'Public Relations',   icon:'speakerphone', color:'var(--sky-tx)', bg:'var(--sky-bg)',
   responsibilities:['Manage chapter social media accounts and public image','Draft and send external communications and press releases','Coordinate photography and media coverage at events','Build relationships with campus media and ISU communications','Maintain chapter brand consistency across all platforms'],
   recurringTasks:['Weekly social media posts across chapter accounts','Event recap posts within 24 hours','Semester recap reel/slideshow at end of semester','Chapter newsletter (if applicable)','Monitor chapter mentions and respond appropriately'],
   wishIKnew:'Consistency matters more than quality on social media. Post regularly even when there\'s nothing flashy happening. Behind-the-scenes content performs well. Build a photo folder system from Day 1 so you\'re not scrambling for content at the end of the semester.'},
  {role:'Community Service',  icon:'plant-2', color:'var(--gn-tx)', bg:'var(--gn-bg)',
   responsibilities:['Coordinate chapter community service initiatives','Track individual and chapter volunteer hours','Partner with local nonprofits and service organizations','Ensure chapter meets IFC service requirements','Run community service committee and recruit volunteers'],
   recurringTasks:['Service hour log updated after every event','IFC service hours submitted each semester','At least 1 community service event per month','Chapter service hour goal visible and tracked','Thank-you outreach to partner organizations'],
   wishIKnew:'Logistics are the biggest barrier to participation. Brothers want to help but won\'t figure out transportation on their own. Handle the van, the sign-up sheet, and the reminder texts and you\'ll get twice the turnout. Always log hours the same day as the event.'},
  {role:'Alumni Relations',   icon:'building-bank', color:'var(--am-tx)', bg:'var(--am-bg)',
   responsibilities:['Maintain relationships with chapter alumni network','Coordinate alumni events and homecoming activities','Manage alumni communications and newsletter','Connect alumni mentors with active brothers','Track alumni contact information and engagement'],
   recurringTasks:['Monthly alumni newsletter or update email','Homecoming and alumni weekend planning (semester)','Alumni directory kept current in platform','Mentor matching for new members and seniors','Annual alumni giving campaign coordination'],
   wishIKnew:'Alumni engagement compounds over time. The brothers you stay in touch with now become the ones who donate, mentor, and show up for homecoming years later. Make it personal: a direct email from you beats a mass blast every time. Keep the alumni contact list obsessively up to date.'},
];

// Role contacts stored in D.transitions per role — no hardcoded defaults

const TR_ROLE_DEADLINES = [
  {id:'trd1',title:'Submit chapter roster to IFC',owner:'Secretary',when:'Week 1 of every semester',priority:'high',notes:'Late submission results in fines.'},
  {id:'trd2',title:'IFC dues payment',owner:'Treasurer',when:'Week 2 of every semester',priority:'high',notes:'Amount varies, check IFC invoice.'},
  {id:'trd3',title:'ATO national member report',owner:'Secretary',when:'Week 3 of every semester',priority:'high',notes:'Submit via myATO portal.'},
  {id:'trd4',title:'GPA collection from all members',owner:'Scholarship Chair',when:'Weeks 2-4 each semester',priority:'high',notes:'Needed for IFC and national reporting.'},
  {id:'trd5',title:'IFC GPA report submission',owner:'Scholarship Chair',when:'End of each semester',priority:'high',notes:'Submit to IFC by their posted deadline.'},
  {id:'trd6',title:'Service hours report to IFC',owner:'Community Service',when:'End of each semester',priority:'medium',notes:'IFC minimum threshold required.'},
  {id:'trd7',title:'Semester budget submission',owner:'Treasurer',when:'Week 1 of every semester',priority:'high',notes:'Full budget presented at first exec meeting.'},
  {id:'trd8',title:'Risk management event pre-approvals',owner:'Risk Manager',when:'Before every social event',priority:'high',notes:'No event runs without signed RM approval.'},
  {id:'trd9',title:'Officer transition documents complete',owner:'Vice President',when:'Final 2 weeks of each semester',priority:'high',notes:'All outgoing officers must complete before changeover.'},
  {id:'trd10',title:'House inspection with house corporation',owner:'House Manager',when:'Start and end of each semester',priority:'medium',notes:'Document all damage with photos before move-in.'},
];

let TR_CURRENT = null;

function trGetTransData(){
  if(!D.transitionHub)D.transitionHub={deadlines:[],issues:[],archive:[]};
  if(!D.transitionHub.issues)D.transitionHub.issues=[];
  if(!D.transitionHub.archive)D.transitionHub.archive=[];
  if(!D.transitionHub.deadlines)D.transitionHub.deadlines=[];
  return D.transitionHub;
}

function renderTransition(){
  trGetTransData();
  const comp=D.transitions.filter(t=>t.status==='complete').length;
  const tot=Math.max(D.transitions.length,EXEC_POSITIONS.length);
  const pct=Math.round(comp/tot*100);
  document.getElementById('tr-bar').style.transform='scaleX('+(pct/100)+')';
  document.getElementById('tr-bar').style.background=pgc(pct);
  document.getElementById('tr-pct-label').textContent=pct+'%';
  document.getElementById('tr-pct-label').style.color=pgc(pct);
  document.getElementById('tr-sub').textContent=comp+' of '+EXEC_POSITIONS.length+' roles marked complete. All outgoing officers should finish before end of semester.';
  trNavRoot();
}

function trNavRoot(){
  TR_CURRENT=null;
  document.getElementById('tr-root-view').style.display='';
  document.getElementById('tr-folder-view').style.display='none';

  const hub=trGetTransData();
  const sl={not_started:'br2',in_progress:'bb2',review:'ba2',complete:'bg2'};
  const sn={not_started:'Not Started',in_progress:'In Progress',review:'In Review',complete:'Complete'};

  // Role cards
  const allRoles=[...EXEC_POSITIONS.map(p=>p.role)];
  D.transitions.forEach(t=>{if(!allRoles.includes(t.role))allRoles.push(t.role);});

  document.getElementById('tr-folders').innerHTML=allRoles.map(role=>{
    const pos=EXEC_POSITIONS.find(p=>p.role===role);
    const tr=D.transitions.find(t=>t.role===role);
    const icon=pos?pos.icon:'folder';
    const bg=pos?pos.bg:'var(--surf2)';
    const col=pos?pos.color:'var(--mt)';
    const status=tr?tr.status:'not_started';
    const out=tr&&tr.outgoing?mB(tr.outgoing).name:'N/A';
    const inc=tr&&tr.incoming?mB(tr.incoming).name:'TBD';
    const fileCount=D.files.filter(f=>f.folder===role).length;
    return`<div class="folder-card" style="gap:9px" tabindex="0" role="button" aria-label="Open ${esc(role)} transition folder" onclick="trOpenFolder('${encodeURIComponent(role)}')">
      <div style="display:flex;align-items:center;gap:9px">
        <div class="folder-icon" style="background:${bg};color:${col};width:34px;height:34px;font-size:17px">${fiIconGlyph(icon)}</div>
        <div style="min-width:0"><div class="folder-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(role)}</div>
          <span class="folder-status ${sl[status]||'bm2'}" style="margin-top:3px">${sn[status]||status}</span></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--mt);padding-top:6px;border-top:1px solid var(--bdr)">
        <span title="Outgoing → Incoming"><i class="ti ti-arrow-right" style="font-size:10px"></i> ${out.split(' ')[0]} → ${inc.split(' ')[0]}</span>
        <span><i class="ti ti-file" style="font-size:10px"></i> ${fileCount}</span>
      </div>
    </div>`;
  }).join('');

  // Deadlines table
  trRenderDeadlines();

  // Open Issues
  trRenderIssues();

  // Archive
  trRenderArchive();
}

function trRenderDeadlines(){
  const hub=trGetTransData();
  const dl=hub.deadlines||[];
  const priColor={high:'br2',medium:'ba2',low:'bm2'};
  document.getElementById('tr-deadlines-table').innerHTML=`<thead><tr><th>Deadline / Task</th><th>Owner</th><th>When</th><th>Priority</th><th>Notes</th><th></th></tr></thead>
    <tbody>${dl.length?dl.map(d=>`<tr>
      <td style="font-weight:500">${esc(d.title)}</td>
      <td style="color:var(--mt)">${esc(d.owner)}</td>
      <td style="color:var(--mt)">${esc(d.when)}</td>
      <td><span class="badge ${priColor[d.priority]||'bm2'}">${esc(d.priority)}</span></td>
      <td style="color:var(--mt);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.notes||'N/A')}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn" style="height:23px;font-size:10px" onclick="trEditDeadline('${d.id}')" aria-label="Edit"><i class="ti ti-pencil"></i></button>
        <button class="btn btn-d" style="height:23px;font-size:10px;padding:0 6px" onclick="trDeleteDeadline('${d.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>
      </div></td>
    </tr>`).join(''):`<tr><td colspan="6" style="text-align:center;color:var(--ht);padding:22px">No deadlines yet. Add recurring semester deadlines here.</td></tr>`}</tbody>`;
}

function trRenderIssues(){
  const hub=trGetTransData();
  const issues=hub.issues||[];
  const priColor={urgent:'br2',high:'br2',medium:'ba2',low:'bm2'};
  const stColor={open:'br2',in_progress:'bb2',resolved:'bg2'};
  const stLabel={open:'Open',in_progress:'In Progress',resolved:'Resolved'};
  const el=document.getElementById('tr-issues-list');
  if(!issues.length){el.innerHTML=`<div class="card">${es('ti-circle-check','green','No open issues','Nothing flagged for the incoming exec team.','')}</div>`;return;}
  el.innerHTML=`<div class="card" style="padding:0;overflow:hidden"><div class="tw"><table class="tbl"><thead><tr><th>Issue</th><th>Owner</th><th>Priority</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>
    ${issues.map(iss=>`<tr>
      <td style="font-weight:500">${esc(iss.title)}</td>
      <td style="color:var(--mt)">${esc(iss.owner||'N/A')}</td>
      <td><span class="badge ${priColor[iss.priority]||'bm2'}">${esc(iss.priority)}</span></td>
      <td><span class="badge ${stColor[iss.status]||'bm2'}">${esc(stLabel[iss.status]||iss.status)}</span></td>
      <td style="color:var(--mt);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(iss.notes||'N/A')}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn" style="height:23px;font-size:10px" onclick="trEditIssue('${iss.id}')" aria-label="Edit"><i class="ti ti-pencil"></i></button>
        <button class="btn btn-d" style="height:23px;font-size:10px;padding:0 6px" onclick="trDeleteIssue('${iss.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>
      </div></td>
    </tr>`).join('')}
  </tbody></table></div></div>`;
}

// ── Semester browse — pure display convenience over the archive log that already exists
// (trArchiveSemester() below already writes one row per semester). No data-model change:
// deadlines[]/issues[] stay exactly the evergreen, non-semester-scoped lists they are today.
let TR_ARCHIVE_SEM='';
function trArchiveKnownSemesters(){
  return unionKnownSemesters(trGetTransData().archive.map(a=>a.semester));
}
function trArchiveSemesterChanged(){
  TR_ARCHIVE_SEM=document.getElementById('tr-archive-semester-select').value;
  trRenderArchive();
}
function trPopulateArchiveSemesterSelect(){
  const sel=document.getElementById('tr-archive-semester-select');
  if(!sel)return;
  sel.innerHTML='<option value="">All Semesters</option>'+trArchiveKnownSemesters().map(s=>`<option value="${esc(s)}" ${s===TR_ARCHIVE_SEM?'selected':''}>${esc(s)}</option>`).join('');
}
function trRenderArchive(){
  trPopulateArchiveSemesterSelect();
  const hub=trGetTransData();
  const arc=TR_ARCHIVE_SEM?(hub.archive||[]).filter(a=>a.semester===TR_ARCHIVE_SEM):(hub.archive||[]);
  const el=document.getElementById('tr-archive-list');
  if(!arc.length){el.innerHTML=`<div class="card"><div style="padding:14px 15px;font-size:12px;color:var(--ht)">No archived semesters yet. Use "Archive Current Semester" at the end of each semester.</div></div>`;return;}
  el.innerHTML=arc.map(a=>`<div class="card" style="margin-bottom:9px">
    <div class="card-hd"><span class="card-t" style="font-size:12.5px;font-weight:600">${a.semester}</span><span style="font-size:10.5px;color:var(--mt)">Archived ${fds(a.date)}</span></div>
    <div style="display:flex;gap:18px;font-size:11.5px;color:var(--mt);margin-top:5px;flex-wrap:wrap">
      <span><i class="ti ti-users" style="font-size:11px;margin-right:3px"></i>${a.memberCount} members</span>
      <span><i class="ti ti-checkbox" style="font-size:11px;margin-right:3px"></i>${a.completedRoles} roles complete</span>
      <span><i class="ti ti-cash" style="font-size:11px;margin-right:3px"></i>${a.notes||'N/A'}</span>
    </div>
  </div>`).join('');
}

function trShowSection(id){
  const el=document.getElementById(id);
  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
}

function trOpenFolder(encodedRole){
  const role=decodeURIComponent(encodedRole);
  TR_CURRENT=role;
  document.getElementById('tr-root-view').style.display='none';
  document.getElementById('tr-folder-view').style.display='';
  document.getElementById('tr-bc-name').textContent=role;

  const pos=EXEC_POSITIONS.find(p=>p.role===role);
  const tr=D.transitions.find(t=>t.role===role);
  const sl={not_started:'Not Started',in_progress:'In Progress',review:'In Review',complete:'Complete'};
  const sc={not_started:'bm2',in_progress:'bb2',review:'ba2',complete:'bg2'};
  const status=tr?tr.status:'not_started';
  const badge=document.getElementById('tr-role-status-badge');
  badge.className='badge '+sc[status];badge.textContent=sl[status];

  const memberFiles=D.files.filter(f=>f.folder===role);
  const iconMap={pdf:'ti-file-type-pdf',xlsx:'ti-file-spreadsheet',xls:'ti-file-spreadsheet',csv:'ti-file-spreadsheet',docx:'ti-file-type-doc',doc:'ti-file-type-doc',txt:'ti-file-text',png:'ti-photo',jpg:'ti-photo',jpeg:'ti-photo'};
  const colorMap={pdf:'color:var(--rd)',xlsx:'color:var(--gn)',xls:'color:var(--gn)',csv:'color:var(--gn)',docx:'color:var(--bl)',doc:'color:var(--bl)',txt:'color:var(--mt)',png:'color:var(--am)',jpg:'color:var(--am)',jpeg:'color:var(--am)'};

  // Build contacts list from stored transitions data
  const roleContacts=(tr&&tr.contacts)||[];
  const contactsHtml=roleContacts.length?roleContacts.map((c,ci)=>`<div class="sh-row">
    <div class="sh-av" style="font-size:9px;font-weight:700">${esc(c.name.split(' ').map(n=>n[0]).join('').slice(0,2))}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:500">${esc(c.name)}</div>
      <div style="font-size:10.5px;color:var(--mt)">${esc(c.role||'')}${c.email?' · '+esc(c.email):''}${c.phone?' · '+esc(c.phone):''}</div>
    </div>
    <button class="ib" style="width:22px;height:22px;font-size:11px;color:var(--rd)" onclick="trDeleteContact('${encodeURIComponent(role)}',${ci})" title="Remove" aria-label="Remove contact ${esc(c.name)}"><i class="ti ti-x"></i></button>
  </div>`).join(''):`<div style="font-size:11.5px;color:var(--ht);padding:8px 0">No contacts added yet.</div>`;

  const posData=pos||{responsibilities:[],recurringTasks:[],wishIKnew:''};
  // Prefer stored user data over template defaults
  const responsibilities=(tr&&tr.responsibilities&&tr.responsibilities.length)?tr.responsibilities:posData.responsibilities;
  const recurringTasks=(tr&&tr.recurringTasks&&tr.recurringTasks.length)?tr.recurringTasks:posData.recurringTasks;

  document.getElementById('tr-folder-body').innerHTML=`
    <div class="d2-body">
    <div class="d2-left">
      <!-- Handoff Details -->
      <div class="card">
        <div class="card-hd"><span class="card-t"><i class="ti ti-arrow-right-circle" style="font-size:12px;color:var(--mt);margin-right:4px"></i>Handoff Details</span>
          <button class="btn" style="height:24px;font-size:10.5px" onclick="openEditTransCurrent()"><i class="ti ti-pencil"></i>Edit</button>
        </div>
        ${tr?`
        <div style="display:flex;flex-direction:column;gap:0">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bdr)">
            <span style="font-size:11.5px;color:var(--mt)">Outgoing Officer</span>
            <span style="font-size:12.5px;font-weight:600;color:var(--tx)">${tr.outgoing?mB(tr.outgoing).name:'Not assigned'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bdr)">
            <span style="font-size:11.5px;color:var(--mt)">Incoming Officer</span>
            <span style="font-size:12.5px;font-weight:600;color:${tr.incoming?'var(--tx)':'var(--ht)'}">${tr.incoming?mB(tr.incoming).name:'TBD'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bdr)">
            <span style="font-size:11.5px;color:var(--mt)">Status</span>
            <span class="badge ${sc[status]}">${sl[status]}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0">
            <span style="font-size:11.5px;color:var(--mt)">Notes / Docs</span>
            <span class="badge ${tr.content?'bg2':'br2'}">${tr.content?'Complete':'Missing'}</span>
          </div>
        </div>
        ${tr.content?`<div style="margin-top:11px;padding:10px 12px;background:var(--surf2);border-radius:8px;font-size:12px;color:var(--tx);line-height:1.6;white-space:pre-wrap">${esc(tr.content)}</div>`:''}
        `:`<div style="padding:14px 0;font-size:12px;color:var(--mt)">No handoff doc created yet.</div>
        <button class="btn btn-p" onclick="openNewTransFor('${encodeURIComponent(role)}')"><i class="ti ti-plus"></i>Create Handoff Doc</button>`}
      </div>

      <!-- Recurring Tasks -->
      <div class="card">
        <div class="card-hd"><span class="card-t"><i class="ti ti-refresh" style="font-size:12px;color:var(--mt);margin-right:4px"></i>Important Recurring Tasks</span>
          <button class="btn" style="height:24px;font-size:10.5px" onclick="trEditList('${encodeURIComponent(role)}','recurringTasks')"><i class="ti ti-pencil"></i>Edit</button>
        </div>
        ${recurringTasks.map(t=>`<div class="tk-row" style="padding:7px 0">
          <div class="tc" style="background:var(--gn);border-color:var(--gn);color:#fff;width:15px;height:15px;flex-shrink:0"><i class="ti ti-check" style="font-size:9px"></i></div>
          <span style="font-size:12px;color:var(--tx);line-height:1.5">${esc(t)}</span>
        </div>`).join('')||'<div style="font-size:12px;color:var(--ht);padding:8px 0">No recurring tasks defined. Click Edit to add.</div>'}
      </div>
    </div>

    <div class="d2-right">
      <!-- Key Responsibilities -->
      <div class="card">
        <div class="card-hd"><span class="card-t"><i class="ti ti-list" style="font-size:12px;color:var(--mt);margin-right:4px"></i>Key Responsibilities</span>
          <button class="btn" style="height:24px;font-size:10.5px" onclick="trEditList('${encodeURIComponent(role)}','responsibilities')"><i class="ti ti-pencil"></i>Edit</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:0">
          ${responsibilities.map((r,i)=>`<div style="display:flex;align-items:flex-start;gap:9px;padding:7px 0;border-bottom:${i<responsibilities.length-1?'1px solid var(--bdr)':'none'}">
            <div style="width:20px;height:20px;border-radius:50%;background:var(--sky-bg);color:var(--sky-tx);font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${i+1}</div>
            <div style="font-size:12px;line-height:1.5;color:var(--tx)">${esc(r)}</div>
          </div>`).join('')||'<div style="font-size:12px;color:var(--ht);padding:8px 0">No responsibilities defined. Click Edit to add.</div>'}
        </div>
      </div>

      <!-- What I Wish I Knew -->
      <div class="card">
        <div class="card-hd"><span class="card-t"><i class="ti ti-bulb" style="font-size:12px;color:var(--mt);margin-right:4px"></i>What I Wish I Knew</span>
          <button class="btn" style="height:24px;font-size:10.5px" onclick="trEditWishIKnew('${encodeURIComponent(role)}')"><i class="ti ti-pencil"></i>Edit</button>
        </div>
        <p id="tr-wish-text-${role.replace(/\s+/g,'_')}" style="font-size:13px;line-height:1.6;color:var(--tx)">${esc((tr&&tr.wishIKnew)||posData.wishIKnew||'No advice written yet. Click Edit to add notes for the incoming officer.')}</p>
      </div>

      <!-- Important Contacts -->
      <div class="card">
        <div class="card-hd"><span class="card-t"><i class="ti ti-address-book" style="font-size:12px;color:var(--mt);margin-right:4px"></i>Important Contacts</span>
          <button class="btn" style="height:24px;font-size:10.5px" onclick="trOpenAddContact('${encodeURIComponent(role)}')"><i class="ti ti-plus"></i>Add</button>
        </div>
        ${contactsHtml}
      </div>

      <!-- Key Documents / Files -->
      <div class="card">
        <div class="card-hd"><span class="card-t"><i class="ti ti-files" style="font-size:12px;color:var(--mt);margin-right:4px"></i>Key Documents</span><span style="font-size:10.5px;color:var(--mt)">${memberFiles.length} file${memberFiles.length!==1?'s':''}</span></div>
        ${memberFiles.length?memberFiles.map(f=>{const ext=(f.name.split('.').pop()||'').toLowerCase();const icon=iconMap[ext]||'ti-file';const col=colorMap[ext]||'color:var(--ht)';return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)">
          <i class="ti ${icon}" style="font-size:16px;${col};flex-shrink:0"></i>
          <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div><div style="font-size:10px;color:var(--mt)">${esc(f.size)} · ${fds(f.date)}</div></div>
          <button class="btn btn-d" style="height:22px;font-size:10px;padding:0 6px" onclick="fiDelete('${f.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>
        </div>`;}).join(''):`<div style="font-size:11.5px;color:var(--ht);padding:8px 0">No files uploaded to this role folder.</div>`}
        <div style="margin-top:9px;border:2px dashed var(--bdr);border-radius:8px;padding:12px;text-align:center;cursor:pointer" onclick="rbacNav('files',null);fiOpenFolderUpload('${encodeURIComponent(role)}')">
          <i class="ti ti-upload" style="font-size:14px;color:var(--ht);display:block;margin-bottom:3px"></i>
          <div style="font-size:11px;color:var(--mt)">Upload to this folder</div>
        </div>
      </div>
    </div>
    </div>
  `;
}

function trEditWishIKnew(encodedRole){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const role=decodeURIComponent(encodedRole);
  let tr=D.transitions.find(t=>t.role===role);
  const pos=EXEC_POSITIONS.find(p=>p.role===role);
  const current=(tr&&tr.wishIKnew)||(pos&&pos.wishIKnew)||'';
  const newVal=prompt('Edit "What I Wish I Knew" for '+role+':\n(This advice will be shown to your successor)',current);
  if(newVal===null)return;
  if(!tr){tr={id:uid(),role,outgoing:CURRENT_USER?CURRENT_USER.mid:null,incoming:null,content:'',status:'in_progress',wishIKnew:newVal};D.transitions.push(tr);}
  else tr.wishIKnew=newVal;
  saveD('transitions');trOpenFolder(encodedRole);toast('Advice saved','success');
}

function trEditList(encodedRole, field){
  const role=decodeURIComponent(encodedRole);
  let tr=D.transitions.find(t=>t.role===role);
  const pos=EXEC_POSITIONS.find(p=>p.role===role);
  const posData=pos||{responsibilities:[],recurringTasks:[]};
  const current=tr&&tr[field]&&tr[field].length?tr[field]:posData[field]||[];
  const label=field==='responsibilities'?'Key Responsibilities':'Recurring Tasks';
  document.getElementById('tr-list-role-enc').value=encodedRole;
  document.getElementById('tr-list-field').value=field;
  document.getElementById('tr-list-modal-title').textContent='Edit '+label;
  document.getElementById('tr-list-textarea').value=current.join('\n');
  document.getElementById('tr-list-hint').textContent='One item per line.';
  openM('m-tr-list');
}
function trSaveList(){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const encodedRole=document.getElementById('tr-list-role-enc').value;
  const role=decodeURIComponent(encodedRole);
  const field=document.getElementById('tr-list-field').value;
  const lines=document.getElementById('tr-list-textarea').value.split('\n').map(l=>l.trim()).filter(Boolean);
  let tr=D.transitions.find(t=>t.role===role);
  if(!tr){tr={id:uid(),role,outgoing:CURRENT_USER?CURRENT_USER.mid:null,incoming:null,content:'',status:'not_started'};D.transitions.push(tr);}
  tr[field]=lines;
  saveD('transitions');closeM(null,document.getElementById('m-tr-list'));trOpenFolder(encodedRole);toast('Saved','success');
}
function trOpenAddContact(encodedRole){
  const role=decodeURIComponent(encodedRole);
  document.getElementById('tr-contact-role-enc').value=encodedRole;
  ['tr-c-name','tr-c-role','tr-c-email','tr-c-phone'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  openM('m-tr-contact');
}
function trSaveContact(){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const encodedRole=document.getElementById('tr-contact-role-enc').value;
  const role=decodeURIComponent(encodedRole);
  const name=document.getElementById('tr-c-name').value.trim();
  if(!name){toast('Name is required','error');return;}
  let tr=D.transitions.find(t=>t.role===role);
  if(!tr){tr={id:uid(),role,outgoing:CURRENT_USER?CURRENT_USER.mid:null,incoming:null,content:'',status:'not_started',contacts:[]};D.transitions.push(tr);}
  if(!tr.contacts)tr.contacts=[];
  tr.contacts.push({name,role:document.getElementById('tr-c-role').value.trim(),email:document.getElementById('tr-c-email').value.trim(),phone:document.getElementById('tr-c-phone').value.trim()});
  saveD('transitions');closeM(null,document.getElementById('m-tr-contact'));trOpenFolder(encodedRole);toast('Contact added','success');
}
async function trDeleteContact(encodedRole,idx){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const ok=await confirmDialog('Remove Contact','Remove this contact from the role?');
  if(!ok)return;
  const role=decodeURIComponent(encodedRole);
  const tr=D.transitions.find(t=>t.role===role);
  if(tr&&tr.contacts){tr.contacts.splice(idx,1);saveD('transitions');trOpenFolder(encodedRole);toast('Contact removed','info');}
}
function trOpenAddDeadline(){
  document.getElementById('tr-dl-id').value='';
  document.getElementById('tr-dl-modal-title').textContent='Add Recurring Deadline';
  ['tr-dl-title','tr-dl-owner','tr-dl-when','tr-dl-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('tr-dl-pri').value='medium';
  openM('m-tr-deadline');
}
function trEditDeadline(id){
  const hub=trGetTransData();
  const d=hub.deadlines.find(x=>x.id===id);if(!d)return;
  document.getElementById('tr-dl-id').value=id;
  document.getElementById('tr-dl-modal-title').textContent='Edit Deadline';
  document.getElementById('tr-dl-title').value=d.title;
  document.getElementById('tr-dl-owner').value=d.owner;
  document.getElementById('tr-dl-when').value=d.when;
  document.getElementById('tr-dl-pri').value=d.priority;
  document.getElementById('tr-dl-notes').value=d.notes||'';
  openM('m-tr-deadline');
}
function trSaveDeadline(){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const title=document.getElementById('tr-dl-title').value.trim();
  if(!title){toast('Title required','error');return;}
  const hub=trGetTransData();
  const id=document.getElementById('tr-dl-id').value;
  const data={title,owner:document.getElementById('tr-dl-owner').value.trim(),when:document.getElementById('tr-dl-when').value.trim(),priority:document.getElementById('tr-dl-pri').value,notes:document.getElementById('tr-dl-notes').value.trim()};
  if(id){const d=hub.deadlines.find(x=>x.id===id);if(d)Object.assign(d,data);}
  else hub.deadlines.push({id:uid(),...data});
  saveD('transitionHub');closeM(null,document.getElementById('m-tr-deadline'));trRenderDeadlines();toast('Deadline saved','success');
}
async function trDeleteDeadline(id){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const ok=await confirmDialog('Delete Deadline','Remove this recurring deadline?','Delete',true);
  if(!ok)return;
  const hub=trGetTransData();hub.deadlines=hub.deadlines.filter(d=>d.id!==id);
  saveD('transitionHub');trRenderDeadlines();toast('Deleted','info');
}

function trOpenAddIssue(){
  document.getElementById('tr-iss-id').value='';
  document.getElementById('tr-iss-modal-title').textContent='Add Open Issue';
  ['tr-iss-title','tr-iss-owner','tr-iss-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('tr-iss-pri').value='medium';
  document.getElementById('tr-iss-status').value='open';
  openM('m-tr-issue');
}
function trEditIssue(id){
  const hub=trGetTransData();
  const iss=hub.issues.find(x=>x.id===id);if(!iss)return;
  document.getElementById('tr-iss-id').value=id;
  document.getElementById('tr-iss-modal-title').textContent='Edit Issue';
  document.getElementById('tr-iss-title').value=iss.title;
  document.getElementById('tr-iss-owner').value=iss.owner||'';
  document.getElementById('tr-iss-pri').value=iss.priority;
  document.getElementById('tr-iss-status').value=iss.status;
  document.getElementById('tr-iss-notes').value=iss.notes||'';
  openM('m-tr-issue');
}
function trSaveIssue(){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const title=document.getElementById('tr-iss-title').value.trim();
  if(!title){toast('Issue title required','error');return;}
  const hub=trGetTransData();
  const id=document.getElementById('tr-iss-id').value;
  const data={title,owner:document.getElementById('tr-iss-owner').value.trim(),priority:document.getElementById('tr-iss-pri').value,status:document.getElementById('tr-iss-status').value,notes:document.getElementById('tr-iss-notes').value.trim()};
  if(id){const iss=hub.issues.find(x=>x.id===id);if(iss)Object.assign(iss,data);}
  else hub.issues.push({id:uid(),...data});
  saveD('transitionHub');closeM(null,document.getElementById('m-tr-issue'));trRenderIssues();toast('Issue saved','success');
}
async function trDeleteIssue(id){
  if(!isLeadUser()){toast('Only a chapter lead can edit officer transition records.','error');return;}
  const ok=await confirmDialog('Delete Issue','Remove this open issue?','Delete',true);
  if(!ok)return;
  const hub=trGetTransData();hub.issues=hub.issues.filter(i=>i.id!==id);
  saveD('transitionHub');trRenderIssues();toast('Deleted','info');
}

async function trArchiveSemester(){
  if(!isLeadUser()){toast('Only a chapter lead can archive the transition hub.','error');return;}
  const sem=getSemester();
  const ok=await confirmDialog('Archive Semester','Archive '+sem+'? A snapshot of current transition progress will be saved. You can still edit everything after archiving.','Archive',false);
  if(!ok)return;
  const hub=trGetTransData();
  hub.archive.unshift({id:uid(),semester:sem,date:localDateStr(),memberCount:D.members.length,completedRoles:D.transitions.filter(t=>t.status==='complete').length,notes:''});
  saveD('transitionHub');trRenderArchive();toast(sem+' archived','success');
}

function trPrintRole(){
  if(!TR_CURRENT)return;
  const role=TR_CURRENT;
  const pos=EXEC_POSITIONS.find(p=>p.role===role);
  const tr=D.transitions.find(t=>t.role===role);
  const posData=pos||{responsibilities:[],recurringTasks:[],wishIKnew:''};
  const w=window.open('','_blank','width=800,height=700');
  w.document.write(`<!DOCTYPE html><html><head><title>${role} Transition Doc</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body{font-family:'Inter',system-ui,sans-serif;margin:0;padding:32px;font-size:13px;color:#111827;line-height:1.6;max-width:720px}
    .header{background:#C9A227;color:#151008;padding:20px 24px;border-radius:10px;margin-bottom:20px}
    h1{font-size:20px;font-weight:700;margin:0 0 5px}
    .meta{font-size:11px;opacity:.75;display:flex;gap:16px;flex-wrap:wrap}
    h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6B7280;margin:0 0 8px;border-top:1px solid #E5E7EB;padding-top:12px}
    li{margin-bottom:4px;line-height:1.5}
    .box{background:#F2F4F7;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px;line-height:1.7}
    @media print{body{padding:16px}}
  </style></head><body>
  <div class="header">
    <h1>${role}: Transition Document</h1>
    <div class="meta">
      <span>Outgoing: ${tr&&tr.outgoing?mB(tr.outgoing).name:'N/A'}</span>
      <span>Incoming: ${tr&&tr.incoming?mB(tr.incoming).name:'TBD'}</span>
      <span>Semester: ${getSemester()}</span>
    </div>
  </div>
  <h3>Key Responsibilities</h3><ul>${posData.responsibilities.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>
  <h3>Recurring Tasks</h3><ul>${posData.recurringTasks.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
  ${tr&&tr.content?`<h3>Handoff Notes</h3><div class="box">${esc(tr.content)}</div>`:''}
  <h3>What I Wish I Knew</h3><div class="box">${esc((tr&&tr.wishIKnew)||posData.wishIKnew||'No advice written.')}</div>
  <div style="margin-top:28px;padding-top:12px;border-top:1px solid #E5E7EB;font-size:10px;color:#9CA3AF">ATO ${D.settings?.chapterName||CURRENT_USER?.chapterName||''} · Printed ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
  </body></html>`);
  w.document.close();setTimeout(()=>w.print(),400);
}

function openNewTransFor(encodedRole){
  const role=decodeURIComponent(encodedRole);
  document.getElementById('ntr-r').value=role;
  const o=document.getElementById('ntr-o');o.innerHTML='<option value="">Unassigned</option>'+mOpts();
  openM('m-addtrans');
}
function openEditTransCurrent(){
  if(!TR_CURRENT)return;
  const tr=D.transitions.find(t=>t.role===TR_CURRENT);
  if(tr)openEditTrans(tr.id);
  else openNewTransFor(encodeURIComponent(TR_CURRENT));
}

// ── DELETE FILE ──
async function fiDelete(id){
  const f=D.files.find(f=>f.id===id);
  if(!canWrite()&&!canUploadFileForCommittee(f?.committeeId)){toast('You do not have permission to delete files.','error');return;}
  const ok=await confirmDialog('Delete File','Are you sure you want to remove this file?');
  if(!ok)return;
  if(_db&&_fbFns){
    try{
      const {doc,deleteDoc}=_fbFns;
      await deleteDoc(doc(_db,...fiContentPath(),id));
    }catch(err){ console.warn('File content delete failed:',err.message); }
  }
  D.files=D.files.filter(x=>x.id!==id);
  delete FI_STORE[id];
  saveD('files');
  if(f?.committeeId&&typeof coOnFilesChanged==='function')coOnFilesChanged(f.committeeId);
  else renderFiles();
  toast('File removed','info');
}


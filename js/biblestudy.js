// ══════════════════════════════════════════════
// BIBLE STUDY PROGRAM — "Salvation History", PDF-per-chapter Chaplain workspace
// ══════════════════════════════════════════════
// Each of the 13 chapters carries its own source PDF as the authoritative curriculum content
// (leader prep + discussion material lives there, not retyped into Firestore); this module wraps
// it with scheduling, a prep checklist, a lightweight session plan, chaplain-scoped attendance,
// and private notes/follow-ups. Permission model matches the rest of Chaplain Hub — chFull()/
// canEditRitual() from js/ritual.js (loaded first). PDFs and private notes live in two
// restricted Firestore collections (bibleStudyPdfContent, chaplainLeaderContent, both gated in
// firestore.rules to chFull()-equivalent users only, since these specific source PDFs contain
// leader-only discussion answers) — same base64-blob-in-its-own-doc pattern as js/files.js's
// fiContentPath()/fiOpenDoc(), just with a tighter read rule.
//
// D.chaplainHub.bibleStudyProgram (the old Week/Topic/Notes list this replaced) is left
// completely untouched in Firestore — never written to by anything here.

function bsFull(){ return typeof chFull==='function' && chFull(); }

const BS_EXPECTED_FILENAMES={
  1:'01_Gods_Design.pdf', 2:'02_A_New_Creation.pdf', 3:'03_Three_Promises_that_Changed_the_World.pdf',
  4:'04_The_Father_of_Faith.pdf', 5:'05_Always_Reaching_for_More.pdf', 6:'06_Bringing_Good_Out_of_Evil.pdf',
  7:'07_Leaving_Egypt.pdf', 8:'08_A_Journey_that_Tests_the_Heart.pdf', 9:'09_Entering_the_Promised_Land.pdf',
  10:'10_A_Land_Without_a_Leader.pdf', 11:'11_A_King_After_Gods_Own_Heart.pdf', 12:'12_From_Dynasty_to_Exile.pdf',
  13:'13_The_Climax_of_the_Covenant.pdf'
};

const BS_STATUSES=[
  {v:'not_started',l:'Not Started',c:'bm2'},{v:'preparing',l:'Preparing',c:'ba2'},
  {v:'ready',l:'Ready',c:'bb2'},{v:'scheduled',l:'Scheduled',c:'bb2'},
  {v:'completed',l:'Completed',c:'bg2'},{v:'skipped',l:'Skipped',c:'br2'}
];
function bsStatusLabel(v){ return (BS_STATUSES.find(s=>s.v===v)||{}).l||v; }
function bsStatusClass(v){ return (BS_STATUSES.find(s=>s.v===v)||{}).c||'bm2'; }

const BS_DEFAULT_SESSION_PLAN=[
  {label:'Welcome & Opening',minutes:5},
  {label:'Read Selected Scripture',minutes:10},
  {label:'Main Teaching & Discussion',minutes:30},
  {label:'Personal Application',minutes:10},
  {label:'Closing Prayer',minutes:5}
];
const BS_PREP_CHECKLIST_DEFAULTS=[
  'Open and review the chapter PDF','Read the Understanding section','Review all Scripture passages',
  'Review the Discussion section','Review suggested answers','Choose optional sidebars',
  'Prepare personal examples','Confirm time and location','Prepare any materials'
];
const BS_PDF_MAX_BYTES=700*1024;

// ── Seed data — the 13 real Salvation History chapters (titles/scripture/support text drawn
// from the source PDF's real chapter structure, condensed to concise support fields; the PDF
// itself, uploaded separately, remains the authoritative full content). ──
const BS_SEED_CHAPTERS=[
  {weekNumber:1,title:"God's Design",scripturePassages:"Genesis 1:1-13,14-15,26-27; 2:16-17; 3:1-6,15",
   summary:"Creation, image & likeness, the fall, the first Gospel",
   leaderSummary:"Creation is intentional design — humans alone are made in God's image and likeness. The fall is a rupture of trust, not just rule-breaking. Genesis 3:15 promises a future undoing of the fall in the very moment it happens.",
   groupDiscussionFocus:"Where do you see “very good” in your own life right now? What does it look like to trust God's design over your own judgment of good and evil?"},
  {weekNumber:2,title:"A New Creation",scripturePassages:"Genesis 4:17-24; 4:26-5:32; 6:1-3,8-10,11-13; 7:11-12; 9:20-27; Lev 20:11",
   summary:"Cain vs. Seth, the flood as re-creation, Noah's fall",
   leaderSummary:"Cain and Seth represent two competing legacies. The flood deliberately echoes Genesis 1's creation language — an undoing and redoing of the world. Noah's fall right after shows a fresh start doesn't erase human weakness.",
   groupDiscussionFocus:"What “line” are you living out — pride like Cain's, or one that keeps returning to God like Seth's? Where has a fresh start not erased temptation in your own life?"},
  {weekNumber:3,title:"Three Promises that Changed the World",scripturePassages:"Genesis 12:1-4,10-20; 15:1-6,12",
   summary:"God's three promises to Abram: nation, name, worldwide blessing",
   leaderSummary:"Abram's call narrows the story from humanity to one family through whom the world will be blessed. In Genesis 15, God alone passes between the pieces — taking the covenant's full weight on Himself.",
   groupDiscussionFocus:"What is God asking you to leave behind on faith right now? Where do you see God taking the weight of a promise onto Himself rather than requiring something from you first?"},
  {weekNumber:4,title:"The Father of Faith",scripturePassages:"Genesis 16:1-4; 17:1-21; 22:1-18; Hebrews 11:17-19",
   summary:"Hagar, circumcision, the sacrifice of Isaac",
   leaderSummary:"The Hagar situation is Abram forcing the promise onto his own timeline. Circumcision becomes the covenant's permanent bodily sign. The binding of Isaac is the ultimate test of trust.",
   groupDiscussionFocus:"Where have you tried to “help God out” instead of waiting on His timeline? What would it look like to trust God the way Abraham did on the mountain?"},
  {weekNumber:5,title:"Always Reaching for More",scripturePassages:"Genesis 25:19-34; 27:1-46; 29:15-30",
   summary:"Jacob and Esau, the stolen blessing, Jacob deceived by Laban",
   leaderSummary:"Jacob's name means “deceiver” — his early story is defined by grasping for more than what was freely offered, and it costs him. He's later deceived by Laban the exact same way. Grace still works through him before he's changed.",
   groupDiscussionFocus:"Where in your life are you grasping for something instead of trusting God's timing? Where have you seen “you reap what you sow” play out around you?"},
  {weekNumber:6,title:"Bringing Good Out of Evil",scripturePassages:"Genesis 37:3-36; 39:1-23; 41:1-57",
   summary:"Joseph sold into slavery, Potiphar's wife, rise to power in Egypt",
   leaderSummary:"Joseph is betrayed, falsely accused, and imprisoned — every stage looks like abandonment, yet the Lord is with him. His rise sets up the Exodus. It anticipates his own words: what you meant for evil, God meant for good.",
   groupDiscussionFocus:"Where has something that felt like pure setback turned out to be preparation? Who is someone it is genuinely hard to forgive the way Joseph forgives his brothers?"},
  {weekNumber:7,title:"Leaving Egypt",scripturePassages:"Exodus 1:8-14; 2:1-10; 3:13-20; 5:1-2; 7:17-18; 12:1-13; 19:3-6",
   summary:"Moses, the plagues, Passover, the Exodus",
   leaderSummary:"Israel multiplies into slavery, and God raises up a reluctant deliverer in Moses. The plagues confront Egypt's gods directly. Passover establishes protection through a substitute. At Sinai, Israel is called to be a kingdom of priests.",
   groupDiscussionFocus:"What is your “Egypt” — a comfortable but enslaving pattern God is calling you out of? What do you think God has rescued you for?"},
  {weekNumber:8,title:"A Journey that Tests the Heart",scripturePassages:"Exodus 24:1-11; 32:1-9",
   summary:"The covenant ceremony at Sinai and the golden calf",
   leaderSummary:"The covenant ceremony at Sinai functions like Israel's wedding vow to God. Within weeks, while Moses is still on the mountain, they break it with the golden calf — the pattern for the whole wilderness generation.",
   groupDiscussionFocus:"Where have you made a strong commitment and broken it faster than expected? What does Moses interceding for the people teach you about standing in the gap for others?"},
  {weekNumber:9,title:"Entering the Promised Land",scripturePassages:"Numbers 13:25-33; 14:5-10; Deut 6:4-10; 28:1-11,15-20; 30:1-8",
   summary:"The twelve spies, the two ways, circumcision of heart",
   leaderSummary:"Twelve spies see the same land — ten see giants, two see the promise. The difference isn't the facts, it's what they focus on. Deuteronomy's “two ways” frames obedience as the path to flourishing, not a transaction.",
   groupDiscussionFocus:"Where are you staring at “giants” instead of the promise in front of you? What's the difference between obeying out of fear and obeying because you trust the path?"},
  {weekNumber:10,title:"A Land Without a Leader",scripturePassages:"Joshua 1:1-9; 6:1-5,15-20; 24:1-5; Judges 13:2-7; 14:5-9; 16:4-22",
   summary:"Jericho, covenant renewal at Shechem, Samson",
   leaderSummary:"Jericho falls through obedience to a strange plan, not military strength. Judges shows what happens without strong, faithful leadership — a repeating cycle of sin, oppression, deliverance. Samson is wasted potential: gifting without character.",
   groupDiscussionFocus:"Where do you lean on your own strategy instead of trusting an instruction from God that doesn't make sense yet? Where is Samson's tension showing up in your own life?"},
  {weekNumber:11,title:"A King After God's Own Heart",scripturePassages:"1 Samuel 17:1-51; 2 Samuel 7:1-29",
   summary:"David and Goliath, the Davidic covenant",
   leaderSummary:"David fights Goliath so that all the earth will know there is a God in Israel — whose reputation is on the line is the real point. Second Samuel 7's Davidic covenant promises David an eternal dynasty, pointing forward to Christ.",
   groupDiscussionFocus:"What has God already carried you through that you can draw confidence from right now? What would it look like to fight your current “giant” for God's reputation instead of your own?"},
  {weekNumber:12,title:"From Dynasty to Exile",scripturePassages:"1 Kings 3:4-15; 6:38; 7:1; 10:14,26; 11:1-8; 12:1-16; Deut 17:14-20",
   summary:"Solomon's wisdom and fall, the divided kingdom",
   leaderSummary:"Solomon asks for wisdom and receives it, along with wealth and fame — yet his foreign wives gradually turn his heart toward other gods. The kingdom splits right after his death, beginning the slide toward exile.",
   groupDiscussionFocus:"Solomon started stronger spiritually than almost anyone and still drifted — what small compromises are most likely to pull you off course over time?"},
  {weekNumber:13,title:"The Climax of the Covenant",scripturePassages:"Matthew 3:1-17; 28:18-20; Genesis 3:18-19; Luke 22:44; John 19:2,30; Acts 1:1",
   summary:"John the Baptist, Christ's fulfillment of the covenants, the Church's mission",
   leaderSummary:"John the Baptist stands at the hinge between the Old and New Testaments, pointing beyond himself to the one who fulfills everything before him. Christ's death and resurrection complete the promises of Genesis 3:15, Abraham, and David all at once.",
   groupDiscussionFocus:"Looking back across all thirteen weeks, which part of this story do you see yourself in most right now? What's your role in carrying the mission forward at ATO?"}
];

function bscBlankChapter(seed){
  return {
    id:uid(), weekNumber:seed.weekNumber, title:seed.title, topic:seed.title,
    summary:seed.summary||'', mainTheme:seed.mainTheme||'', scripturePassages:seed.scripturePassages||'',
    passageToRead:seed.scripturePassages||'', leaderSummary:seed.leaderSummary||'', groupDiscussionFocus:seed.groupDiscussionFocus||'',
    leaderPageRange:'', discussionPageRange:'',
    estimatedPreparationMinutes:30, estimatedSessionMinutes:60,
    status:'not_started', scheduledAt:null, scheduledEventId:null,
    completedAt:null, completedBy:null, archived:false,
    preparationChecklist:BS_PREP_CHECKLIST_DEFAULTS.map(label=>({id:uid(),label,done:false})),
    expectedPdfFilename:BS_EXPECTED_FILENAMES[seed.weekNumber]||null,
    pdf:null, sessions:[], legacyNotes:''
  };
}

// ── Migration / defaults — called from dDefaults() (js/data.js) whenever D loads ──
function bscEnsureDefaults(){
  if(!D.bibleStudyCurriculum){
    // Fold anything the user already edited via the old click-through UI into legacyNotes,
    // matched by week number, before creating fresh chapter records — nothing is discarded.
    const legacy=(D.chaplainHub&&D.chaplainHub.bibleStudyProgram)||[];
    D.bibleStudyCurriculum={
      title:'Salvation History', subtitle:'13-Chapter Bible Study Program',
      source:{name:'FOCUS Salvation History', organization:'Fellowship of Catholic University Students',
              attribution:'Adapted from the FOCUS "Salvation History" Bible study series.'},
      schemaVersion:1,
      chapters:BS_SEED_CHAPTERS.map(seed=>{
        const c=bscBlankChapter(seed);
        const legacyRow=legacy.find(r=>r.week===seed.weekNumber);
        if(legacyRow){
          const parts=[];
          if(legacyRow.notes)parts.push('Notes: '+legacyRow.notes);
          if(legacyRow.understanding)parts.push('Understanding: '+legacyRow.understanding);
          if(legacyRow.discussion)parts.push('Discussion: '+legacyRow.discussion);
          if(parts.length)c.legacyNotes=parts.join('\n\n');
        }
        return c;
      })
    };
    return;
  }
  const bsc=D.bibleStudyCurriculum;
  if(!bsc.source)bsc.source={name:'FOCUS Salvation History',organization:'Fellowship of Catholic University Students',attribution:''};
  if(!bsc.schemaVersion)bsc.schemaVersion=1;
  if(!bsc.chapters)bsc.chapters=[];
  bsc.chapters.forEach(c=>{
    if(!c.id)c.id=uid();
    if(!c.preparationChecklist)c.preparationChecklist=BS_PREP_CHECKLIST_DEFAULTS.map(label=>({id:uid(),label,done:false}));
    if(!c.sessions)c.sessions=[];
    if(c.status===undefined)c.status='not_started';
    if(!c.expectedPdfFilename)c.expectedPdfFilename=BS_EXPECTED_FILENAMES[c.weekNumber]||null;
    if(c.pdf===undefined)c.pdf=null;
    if(c.legacyNotes===undefined)c.legacyNotes='';
    if(c.leaderPageRange===undefined)c.leaderPageRange='';
    if(c.discussionPageRange===undefined)c.discussionPageRange='';
    if(c.estimatedPreparationMinutes===undefined)c.estimatedPreparationMinutes=30;
    if(c.estimatedSessionMinutes===undefined)c.estimatedSessionMinutes=60;
    if(c.archived===undefined)c.archived=false;
    if(c.topic===undefined)c.topic=c.title;
    // Self-heal chapters left orphaned by a session's calendar event being deleted before
    // deleteEvent() (js/events.js) knew to clear this link back — otherwise a chapter stays
    // stuck showing "Scheduled" for a date that's no longer on the calendar, forever.
    if(c.scheduledEventId&&!(D.events||[]).some(e=>e.id===c.scheduledEventId)){
      if(c.status==='scheduled')c.status='not_started';
      c.scheduledAt=null;
      c.scheduledEventId=null;
    }
  });
}
function bscChapters(){ return (D.bibleStudyCurriculum&&D.bibleStudyCurriculum.chapters)||[]; }
function bscChapter(id){ return bscChapters().find(c=>c.id===id); }

// ── PDF content (restricted collection, mirrors js/files.js fiContentPath()/fiOpenDoc()) ──
const BS_PDF_STORE={}; // contentId -> {base64,mediaType,filename}
function bsPdfContentPath(){ return [FS_PATH, FS_ID, 'bibleStudyPdfContent']; }
async function bscFetchPdf(contentId){
  if(!contentId)return null;
  if(BS_PDF_STORE[contentId])return BS_PDF_STORE[contentId];
  if(!_db||!_fbFns)return null;
  try{
    const {doc,getDoc}=_fbFns;
    const snap=await getDoc(doc(_db,...bsPdfContentPath(),contentId));
    if(snap.exists()){
      const {b,t,filename}=snap.data();
      BS_PDF_STORE[contentId]={base64:b,mediaType:t||'application/pdf',filename};
      return BS_PDF_STORE[contentId];
    }
  }catch(err){ console.warn('Bible study PDF fetch failed:',err.message); }
  return null;
}
function bscSanitizeFilename(name){ return String(name).replace(/[\/\\]/g,'_').replace(/\.\./g,'_').slice(0,150); }

// ── Private leader content (restricted collection) ──
let BS_LEADER_CONTENT=null;
function bsLeaderContentPath(){ return [FS_PATH, FS_ID, 'chaplainLeaderContent']; }
async function bscLoadLeaderContent(){
  if(!bsFull())return null;
  if(BS_LEADER_CONTENT)return BS_LEADER_CONTENT;
  if(!_db||!_fbFns)return BS_LEADER_CONTENT={privateNotes:{},leaderProgress:{}};
  try{
    const {doc,getDoc}=_fbFns;
    const snap=await getDoc(doc(_db,...bsLeaderContentPath(),'main'));
    BS_LEADER_CONTENT=snap.exists()?snap.data():{privateNotes:{},leaderProgress:{}};
  }catch(err){
    console.warn('Chaplain leader content fetch failed:',err.message);
    BS_LEADER_CONTENT={privateNotes:{},leaderProgress:{}};
  }
  if(!BS_LEADER_CONTENT.privateNotes)BS_LEADER_CONTENT.privateNotes={};
  if(!BS_LEADER_CONTENT.leaderProgress)BS_LEADER_CONTENT.leaderProgress={};
  return BS_LEADER_CONTENT;
}
async function bscSaveLeaderContent(){
  if(!bsFull()||!BS_LEADER_CONTENT||!_db||!_fbFns)return;
  try{
    const {doc,setDoc}=_fbFns;
    await setDoc(doc(_db,...bsLeaderContentPath(),'main'),BS_LEADER_CONTENT);
  }catch(err){
    console.warn('Chaplain leader content save failed:',err.message);
    toast('Private notes saved for this session only — sync failed.','warning',5000);
  }
}

// ── One-time seed of the 7 real chapter PDFs, run live in-browser the first time a chFull()
// user loads the page after this feature ships — mirrors how every other xxEnsureDefaults()
// migration in this app already runs. Chapters 8-13 have no seed entry (the source split only
// produced real content through chapter 7) and stay "PDF Missing" until real files are uploaded
// through the Bulk PDF Manager.
//
// The seed data itself (js/biblestudy-seed-pdfs.js) is a ~4MB base64 blob — it is NOT loaded via
// a static <script> tag (that would parse it on every single page view for every user of every
// chapter, forever, even chapters that finished seeding years ago). Instead it's fetched with a
// dynamically-injected <script> tag, and only when bscSeedPdfsIfNeeded()'s cheap pre-check
// (no Firestore/network round trip — just a look at chapters already in memory) says a chapter
// with a seedable week is genuinely still missing that PDF. ──
const BS_SEEDABLE_WEEKS=[1,2,3,4,5,6,7];
let BS_SEED_SCRIPT_PROMISE=null;
function bscLoadSeedScript(){
  if(typeof BS_SEED_PDFS!=='undefined')return Promise.resolve();
  if(BS_SEED_SCRIPT_PROMISE)return BS_SEED_SCRIPT_PROMISE;
  BS_SEED_SCRIPT_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='js/biblestudy-seed-pdfs.js';
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('failed to load biblestudy-seed-pdfs.js'));
    document.head.appendChild(s);
  });
  return BS_SEED_SCRIPT_PROMISE;
}
let BS_SEED_ATTEMPTED=false;
async function bscSeedPdfsIfNeeded(){
  if(BS_SEED_ATTEMPTED)return;
  if(!bsFull())return;
  if(!_db||!_fbFns||!FS_ID)return;
  const mightNeedSeed=bscChapters().some(c=>BS_SEEDABLE_WEEKS.includes(c.weekNumber)&&!c.pdf);
  if(!mightNeedSeed)return;
  try{ await bscLoadSeedScript(); }
  catch(err){ console.warn('Bible study seed PDFs failed to load:',err.message); return; }
  if(typeof BS_SEED_PDFS==='undefined')return;
  const needsSeed=bscChapters().some(c=>BS_SEED_PDFS[c.weekNumber]&&!c.pdf);
  if(!needsSeed)return;
  BS_SEED_ATTEMPTED=true;
  const {doc,setDoc}=_fbFns;
  let changed=false;
  for(const c of bscChapters()){
    const seed=BS_SEED_PDFS[c.weekNumber];
    if(!seed||c.pdf)continue;
    try{
      const contentId=uid();
      await setDoc(doc(_db,...bsPdfContentPath(),contentId),{b:seed.b,t:'application/pdf',filename:seed.filename});
      c.pdf={contentId,filename:seed.filename,originalFilename:seed.filename,sizeBytes:seed.sizeBytes,
             mimeType:'application/pdf',pageRange:'',uploadedAt:new Date().toISOString(),
             uploadedBy:CURRENT_USER?CURRENT_USER.mid:null,version:1,previousVersions:[],
             sourceName:(D.bibleStudyCurriculum.source||{}).name||'',sourceOrganization:(D.bibleStudyCurriculum.source||{}).organization||''};
      changed=true;
    }catch(err){ console.warn('Seed PDF write failed for week',c.weekNumber,err.message); }
  }
  if(changed){
    try{ await saveD('bibleStudyCurriculum'); bscRenderProgram(); }
    catch(err){ console.warn('Seed PDF metadata save failed:',err.message); }
  }
}

// ══════════════════════════════════════════════
// RENDER — Program Overview / Chapter Workspace toggle (same-page view swap, no router —
// mirrors js/files.js's fiOpenFolder() root/detail toggle) ──
// ══════════════════════════════════════════════
let BS_ACTIVE_VIEW='overview'; // 'overview' | 'chapter'
let BS_ACTIVE_CHAPTER_ID=null;
let BS_ACTIVE_TAB='bs-pane-overview';
let BS_FILTER='all';

function bscRenderProgram(){
  const actions=document.getElementById('bs-overview-actions');
  if(actions)actions.style.display=bsFull()?'flex':'none';
  if(BS_ACTIVE_VIEW==='chapter'&&BS_ACTIVE_CHAPTER_ID&&bscChapter(BS_ACTIVE_CHAPTER_ID)){
    bscRenderChapterWorkspace();
  }else{
    BS_ACTIVE_VIEW='overview';
    bscRenderOverview();
  }
}

function bscOverviewStats(){
  const chs=bscChapters();
  const completed=chs.filter(c=>c.status==='completed').length;
  const upcoming=[...chs].filter(c=>c.status==='scheduled'&&c.scheduledAt).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const allSessions=chs.flatMap(c=>c.sessions||[]);
  const heldSessions=allSessions.filter(s=>s.status==='completed');
  return {total:chs.length,completed,upcoming,sessionsHeld:heldSessions.length};
}

function bscRenderOverview(){
  const listEl=document.getElementById('bs-list-view'), chEl=document.getElementById('bs-chapter-view');
  if(listEl)listEl.style.display='';
  if(chEl)chEl.style.display='none';
  const bsc=D.bibleStudyCurriculum;
  if(!bsc)return;
  const stats=bscOverviewStats();

  const kpiEl=document.getElementById('bs-kpi');
  if(kpiEl){
    kpiEl.innerHTML=[
      kpi('Progress',`${stats.completed}/${stats.total}`,'Chapters completed'),
      kpi('Next Session',stats.upcoming?`Wk ${stats.upcoming.weekNumber} · ${fds(stats.upcoming.scheduledAt)}`:'—','Next scheduled'),
      kpi('Sessions Held',stats.sessionsHeld,'Total this program')
    ].join('');
  }
  const titleEl=document.getElementById('bs-program-title'); if(titleEl)titleEl.textContent=bsc.title||'Salvation History';
  const subEl=document.getElementById('bs-program-subtitle'); if(subEl)subEl.textContent=bsc.subtitle||'';
  const srcEl=document.getElementById('bs-source-line');
  if(srcEl){
    const src=bsc.source||{};
    srcEl.textContent=[src.name,src.organization].filter(Boolean).join(' — ');
  }
  const pct=stats.total?Math.round(stats.completed/stats.total*100):0;
  const barEl=document.getElementById('bs-progress-fill'); if(barEl)barEl.style.transform='scaleX('+(pct/100)+')';

  const filterEl=document.getElementById('bs-filter-bar');
  if(filterEl){
    const filters=[['all','All'],['upcoming','Upcoming'],['needs_pdf','Needs PDF'],['needs_prep','Needs Preparation'],['completed','Completed'],['archived','Archived']];
    filterEl.innerHTML=filters.map(([v,l])=>`<button class="btn ${BS_FILTER===v?'btn-p':''}" style="height:26px;font-size:11px" onclick="bscSetFilter('${v}')">${l}</button>`).join('');
  }

  let chs=[...bscChapters()].sort((a,b)=>a.weekNumber-b.weekNumber);
  if(BS_FILTER==='archived'){
    chs=chs.filter(c=>c.archived);
  }else{
    chs=chs.filter(c=>!c.archived);
    if(BS_FILTER==='upcoming')chs=chs.filter(c=>c.status==='scheduled');
    else if(BS_FILTER==='needs_pdf')chs=chs.filter(c=>!c.pdf);
    else if(BS_FILTER==='needs_prep')chs=chs.filter(c=>c.status==='not_started'||c.status==='preparing');
    else if(BS_FILTER==='completed')chs=chs.filter(c=>c.status==='completed');
  }

  const grid=document.getElementById('bs-chapter-grid');
  if(!grid)return;
  if(!chs.length){
    grid.innerHTML=`<div style="grid-column:1/-1">${es('ti-book-2','slate','No chapters match this filter','Try a different filter above.')}</div>`;
    return;
  }
  grid.innerHTML=chs.map(c=>bscChapterCardHtml(c)).join('');
}
function bscSetFilter(v){ BS_FILTER=v; bscRenderOverview(); }

function bscChapterCardHtml(c){
  const canEdit=bsFull();
  const prepDone=(c.preparationChecklist||[]).filter(i=>i.done).length;
  const prepTotal=(c.preparationChecklist||[]).length||1;
  const prepPct=Math.round(prepDone/prepTotal*100);
  const pdfBadge=c.pdf
    ? `<span class="badge bg2"><i class="ti ti-file-check"></i> PDF Available</span>`
    : `<span class="badge ${c.expectedPdfFilename?'ba2':'bm2'}"><i class="ti ti-file-off"></i> ${canEdit?'Upload Required':'PDF Missing'}</span>`;
  const lastSession=[...(c.sessions||[])].reverse().find(s=>s.status==='completed');
  const attCount=lastSession?Object.values(lastSession.attendance||{}).filter(v=>v==='present').length:null;
  const menuItems=c.archived
    ? `<button class="bs-menu-item" onclick="bscUnarchiveChapter('${c.id}')">Unarchive</button>`
    : `<button class="bs-menu-item" onclick="bscOpenEditChapter('${c.id}')">Edit Chapter</button>
       <button class="bs-menu-item" onclick="bscOpenUploadPdf('${c.id}')">${c.pdf?'Replace PDF':'Upload PDF'}</button>
       <button class="bs-menu-item" onclick="bscResetProgress('${c.id}')">Reset Progress</button>
       <button class="bs-menu-item" onclick="bscMarkSkipped('${c.id}')">Mark Skipped</button>
       <button class="bs-menu-item" onclick="bscArchiveChapter('${c.id}')">Archive</button>`;
  return `<div class="card" style="padding:13px;cursor:pointer" onclick="bscOpenChapter('${c.id}')">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div style="font-size:11px;font-weight:600;color:var(--mt)">WEEK ${c.weekNumber}</div>
      ${canEdit?`<div style="position:relative" onclick="event.stopPropagation()">
        <button class="btn" style="height:22px;width:22px;padding:0" onclick="bscToggleCardMenu(event,'${c.id}')" aria-label="More actions for Week ${c.weekNumber}"><i class="ti ti-dots"></i></button>
        <div class="bs-card-menu" id="bs-menu-${c.id}" style="display:none">${menuItems}</div>
      </div>`:''}
    </div>
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">${esc(c.title)}</div>
    <div style="font-size:11.5px;color:var(--mt);margin-bottom:8px;min-height:16px">${esc(c.scripturePassages||'')}</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
      <span class="badge ${bsStatusClass(c.status)}">${bsStatusLabel(c.status)}</span>
      ${pdfBadge}
    </div>
    ${c.scheduledAt?`<div style="font-size:11.5px;color:var(--mt);margin-bottom:6px"><i class="ti ti-calendar-event"></i> ${fds(c.scheduledAt)}</div>`:''}
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
      <div class="pb" style="height:5px"><div class="pf" style="width:${prepPct}%;background:var(--navy)"></div></div>
      <span style="font-size:10.5px;color:var(--mt);flex-shrink:0">${prepPct}% prep</span>
    </div>
    ${attCount!==null?`<div style="font-size:10.5px;color:var(--mt);margin-top:4px">${attCount} attended last session</div>`:''}
    <button class="btn" style="width:100%;margin-top:9px;height:26px;font-size:11px" onclick="event.stopPropagation();bscOpenChapter('${c.id}')">Open Chapter</button>
  </div>`;
}
function bscToggleCardMenu(e,id){
  e.stopPropagation();
  document.querySelectorAll('.bs-card-menu').forEach(m=>{ if(m.id!=='bs-menu-'+id)m.style.display='none'; });
  const m=document.getElementById('bs-menu-'+id);
  if(m)m.style.display=m.style.display==='none'?'block':'none';
}
document.addEventListener('click',()=>{ document.querySelectorAll('.bs-card-menu').forEach(el=>el.style.display='none'); });

// ── Program-level actions ──
function bscContinuePrep(){
  const c=bscChapters().find(c=>!c.archived&&c.status==='preparing')||bscChapters().find(c=>!c.archived&&c.status==='not_started');
  if(!c){toast('No chapters need preparation right now.','info');return;}
  bscOpenChapter(c.id);
}
function bscOpenNextChapterAction(){
  const scheduled=[...bscChapters()].filter(c=>!c.archived&&c.status==='scheduled'&&c.scheduledAt).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt))[0];
  if(scheduled){ bscOpenChapter(scheduled.id); return; }
  const next=[...bscChapters()].filter(c=>!c.archived&&c.status!=='completed'&&c.status!=='skipped').sort((a,b)=>a.weekNumber-b.weekNumber)[0];
  if(next){ bscOpenChapter(next.id); return; }
  toast('All chapters are complete!','success');
}
function bscScheduleFromOverview(){
  if(!bsFull()){toast('Only officers with Chaplain Hub access can schedule sessions.','error');return;}
  const next=[...bscChapters()].filter(c=>!c.archived&&c.status!=='completed'&&c.status!=='skipped'&&!c.scheduledAt).sort((a,b)=>a.weekNumber-b.weekNumber)[0];
  if(!next){toast('Every chapter is already scheduled or completed.','info');return;}
  bscOpenChapter(next.id);
  bscOpenScheduleModal(next.id);
}

// ══════════════════════════════════════════════
// CHAPTER WORKSPACE
// ══════════════════════════════════════════════
function bscOpenChapter(id){
  const c=bscChapter(id);
  if(!c)return;
  BS_ACTIVE_VIEW='chapter';
  BS_ACTIVE_CHAPTER_ID=id;
  BS_ACTIVE_TAB='bs-pane-overview';
  bscRenderChapterWorkspace();
  if(bsFull())bscLoadLeaderContent().then(()=>{ if(BS_ACTIVE_CHAPTER_ID===id)bscRenderChapterWorkspace(); });
}
function bscCloseChapter(){
  BS_ACTIVE_VIEW='overview';
  BS_ACTIVE_CHAPTER_ID=null;
  bscRenderOverview();
}
function bscChapterNav(dir){
  const chs=[...bscChapters()].sort((a,b)=>a.weekNumber-b.weekNumber);
  const idx=chs.findIndex(c=>c.id===BS_ACTIVE_CHAPTER_ID);
  const next=chs[idx+dir];
  if(!next)return;
  BS_ACTIVE_CHAPTER_ID=next.id;
  BS_ACTIVE_TAB='bs-pane-overview';
  bscRenderChapterWorkspace();
}
function bscTab(btn,tabId){
  document.querySelectorAll('.bs-tab').forEach(t=>t.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('#bs-chapter-content div[id^="bs-pane-"]').forEach(d=>{d.style.display='none';});
  const el=document.getElementById(tabId); if(el)el.style.display='block';
  BS_ACTIVE_TAB=tabId;
}
function bscGoToTab(tabId){ bscTab(document.querySelector(`.bs-tab[data-tab="${tabId}"]`),tabId); }

function bscRenderChapterWorkspace(){
  const c=bscChapter(BS_ACTIVE_CHAPTER_ID);
  if(!c){ bscCloseChapter(); return; }
  const listEl=document.getElementById('bs-list-view'), chEl=document.getElementById('bs-chapter-view');
  if(listEl)listEl.style.display='none';
  if(chEl)chEl.style.display='';
  const canEdit=bsFull();
  const chs=[...bscChapters()].sort((a,b)=>a.weekNumber-b.weekNumber);
  const idx=chs.findIndex(x=>x.id===c.id);
  const prevBtn=document.getElementById('bs-ch-prev'); if(prevBtn)prevBtn.disabled=idx<=0;
  const nextBtn=document.getElementById('bs-ch-next'); if(nextBtn)nextBtn.disabled=idx>=chs.length-1;
  const titleEl=document.getElementById('bs-ch-title'); if(titleEl)titleEl.textContent=`Week ${c.weekNumber} — ${c.title}`;
  const statusEl=document.getElementById('bs-ch-status'); if(statusEl)statusEl.innerHTML=`<span class="badge ${bsStatusClass(c.status)}">${bsStatusLabel(c.status)}</span>`;
  const schedEl=document.getElementById('bs-ch-scheduled'); if(schedEl)schedEl.textContent=c.scheduledAt?('Scheduled '+fds(c.scheduledAt)):'Not scheduled';
  const editBtn=document.getElementById('bs-ch-edit-btn'); if(editBtn)editBtn.style.display=canEdit?'':'none';
  const readyBtn=document.getElementById('bs-ch-ready-btn'); if(readyBtn)readyBtn.style.display=(canEdit&&c.status!=='ready'&&c.status!=='completed')?'':'none';
  const completeBtn=document.getElementById('bs-ch-complete-btn'); if(completeBtn)completeBtn.style.display=(canEdit&&c.status!=='completed')?'':'none';
  const schedBtn=document.getElementById('bs-ch-schedule-btn'); if(schedBtn)schedBtn.style.display=canEdit?'':'none';

  bscRenderOverviewTab(c);
  bscRenderPdfTab(c);
  bscRenderSessionTab(c);
  bscRenderAttendanceTab(c);
  bscRenderNotesTab(c);

  document.querySelectorAll('.bs-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===BS_ACTIVE_TAB));
  document.querySelectorAll('#bs-chapter-content div[id^="bs-pane-"]').forEach(d=>{d.style.display=(d.id===BS_ACTIVE_TAB?'block':'none');});
}

// ── Overview tab ──
function bscRenderOverviewTab(c){
  const canEdit=bsFull();
  const el=document.getElementById('bs-pane-overview');
  if(!el)return;
  const prepDone=(c.preparationChecklist||[]).filter(i=>i.done).length;
  const prepTotal=(c.preparationChecklist||[]).length||1;
  const prepPct=Math.round(prepDone/prepTotal*100);
  el.innerHTML=`
    <div class="bs-overview-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
      <div class="card" style="padding:13px">
        <div class="card-t" style="margin-bottom:8px">Chapter Information</div>
        <div class="bs-info-row"><span>Week</span><b>${c.weekNumber}</b></div>
        <div class="bs-info-row"><span>Summary</span><span>${esc(c.summary||'—')}</span></div>
        <div class="bs-info-row"><span>Main Theme</span><span>${esc(c.mainTheme||'—')}</span></div>
        <div class="bs-info-row"><span>Scripture</span><span>${esc(c.scripturePassages||'—')}</span></div>
        <div class="bs-info-row"><span>Leader Pages</span><span>${esc(c.leaderPageRange||'—')}</span></div>
        <div class="bs-info-row"><span>Discussion Pages</span><span>${esc(c.discussionPageRange||'—')}</span></div>
        <div class="bs-info-row"><span>Est. Prep Time</span><span>${c.estimatedPreparationMinutes||0} min</span></div>
        <div class="bs-info-row"><span>Est. Session</span><span>${c.estimatedSessionMinutes||0} min</span></div>
        ${c.passageToRead?`<div class="bs-subhead">Passage to Read</div><div style="font-size:12.5px">${esc(c.passageToRead)}</div>`:''}
        ${c.leaderSummary?`<div class="bs-subhead">Leader Summary</div><div style="font-size:12.5px;line-height:1.6">${esc(c.leaderSummary)}</div>`:''}
        ${c.groupDiscussionFocus?`<div class="bs-subhead">Group Discussion Focus</div><div style="font-size:12.5px;line-height:1.6">${esc(c.groupDiscussionFocus)}</div>`:''}
        ${c.legacyNotes?`<div class="bs-subhead">Legacy Notes</div><div style="font-size:11.5px;line-height:1.6;color:var(--mt);white-space:pre-line">${esc(c.legacyNotes)}</div>`:''}
      </div>
      <div>
        <div class="card" style="padding:13px;margin-bottom:13px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span class="card-t">Preparation</span><span style="font-size:11.5px;color:var(--mt)">${prepPct}%</span></div>
          <div class="pb" style="margin-bottom:9px"><div class="pf" style="width:${prepPct}%;background:var(--navy)"></div></div>
          ${(c.preparationChecklist||[]).map(item=>`
            <div style="display:flex;align-items:center;gap:7px;padding:3px 0;cursor:${canEdit?'pointer':'default'}" ${canEdit?`onclick="bscToggleChecklistItem('${c.id}','${item.id}')"`:''}>
              <i class="ti ${item.done?'ti-square-rounded-check':'ti-square-rounded'}" style="color:${item.done?'var(--gn)':'var(--mt)'}"></i>
              <span style="font-size:12px;${item.done?'text-decoration:line-through;color:var(--mt)':''}">${esc(item.label)}</span>
            </div>`).join('')}
        </div>
        <div class="card" style="padding:13px">
          <div class="card-t" style="margin-bottom:8px">Quick Actions</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn" onclick="bscGoToTab('bs-pane-pdf')"><i class="ti ti-file-text"></i>Open PDF</button>
            ${c.pdf?`<button class="btn" onclick="bscDownloadPdf('${c.id}')"><i class="ti ti-download"></i>Download PDF</button>`:''}
            ${canEdit?`<button class="btn" onclick="bscOpenScheduleModal('${c.id}')"><i class="ti ti-calendar-event"></i>Schedule Session</button>`:''}
            ${canEdit?`<button class="btn" onclick="bscGoToTab('bs-pane-notes')"><i class="ti ti-note"></i>Add Private Note</button>`:''}
            ${canEdit?`<button class="btn" onclick="bscOpenFollowUpTask('${c.id}')"><i class="ti ti-list-check"></i>Create Follow-up Task</button>`:''}
          </div>
        </div>
      </div>
    </div>`;
}
async function bscToggleChecklistItem(chapterId,itemId){
  if(!bsFull())return;
  const c=bscChapter(chapterId); if(!c)return;
  const item=(c.preparationChecklist||[]).find(i=>i.id===itemId); if(!item)return;
  const prev=item.done;
  item.done=!item.done;
  if(c.status==='not_started'&&item.done)c.status='preparing';
  try{ await saveD('bibleStudyCurriculum'); bscRenderOverviewTab(c); }
  catch(e){ item.done=prev; toast('Failed to save. Please try again.','error'); bscRenderOverviewTab(c); }
}

// ── Chapter PDF tab ──
function bscRenderPdfTab(c){
  const canEdit=bsFull();
  const el=document.getElementById('bs-pane-pdf');
  if(!el)return;
  // The PDF blob itself is leader-only in firestore.rules (contains discussion answers) — a
  // general member's fetch would be rejected outright, so branch here first rather than
  // attempting it and rendering a permission-denied error state.
  if(!canEdit){
    el.innerHTML=es('ti-lock','slate','Chapter materials are leader-only',
      'The source PDF for this chapter contains leader discussion answers, so it is only available to officers with Chaplain Hub access.');
    return;
  }
  if(!c.pdf){
    el.innerHTML=es('ti-file-off','slate','No chapter PDF has been uploaded','Upload the source PDF for this chapter — PDF files only, up to 700KB.',`<button class="btn btn-p" onclick="bscOpenUploadPdf('${c.id}')"><i class="ti ti-upload"></i>Upload PDF</button>`);
    return;
  }
  const sizeStr=c.pdf.sizeBytes>1048576?(c.pdf.sizeBytes/1048576).toFixed(1)+' MB':(c.pdf.sizeBytes/1024).toFixed(0)+' KB';
  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:13px;margin-bottom:11px;flex-wrap:wrap">
      <div>
        <div style="font-size:13px;font-weight:700">${esc(c.pdf.filename)}</div>
        <div style="font-size:11px;color:var(--mt)">${sizeStr} · uploaded ${c.pdf.uploadedAt?fds(c.pdf.uploadedAt.slice(0,10)):'—'} by ${esc(mB(c.pdf.uploadedBy).name)} · v${c.pdf.version}${c.pdf.pageRange?' · pages '+esc(c.pdf.pageRange):''}</div>
        ${c.pdf.sourceName?`<div style="font-size:11px;color:var(--mt)">Source: ${esc(c.pdf.sourceName)}${c.pdf.sourceOrganization?' — '+esc(c.pdf.sourceOrganization):''}</div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn" onclick="bscOpenPdfFullscreen('${c.id}')"><i class="ti ti-arrows-maximize"></i>Full Screen</button>
        <button class="btn" onclick="bscDownloadPdf('${c.id}')"><i class="ti ti-download"></i>Download</button>
        ${canEdit?`<button class="btn" onclick="bscOpenUploadPdf('${c.id}')"><i class="ti ti-replace"></i>Replace</button>`:''}
      </div>
    </div>
    <div class="bs-pdf-embed" style="position:relative;min-height:700px;border:1px solid var(--bdr);border-radius:8px;overflow:hidden;background:var(--surf2)">
      <div id="bs-pdf-loading" style="display:flex;align-items:center;justify-content:center;height:700px;color:var(--mt);font-size:12.5px"><i class="ti ti-loader-2" style="margin-right:6px"></i>Loading PDF…</div>
      <div id="bs-pdf-error" style="display:none;align-items:center;justify-content:center;flex-direction:column;gap:8px;height:700px;color:var(--mt);font-size:12.5px">
        <span>Could not load this PDF.</span>
        <button class="btn" onclick="bscViewPdfInline('${c.id}')">Retry</button>
      </div>
      <iframe id="bs-pdf-frame" style="display:none;width:100%;height:700px;border:0" title="${esc(c.title)} chapter PDF"></iframe>
    </div>
    <div class="bs-pdf-mobile-card" style="display:none">
      ${es('ti-file-text','slate',c.pdf.filename,'Use Full Screen, Download, or Replace above to work with this PDF on a small screen.')}
    </div>`;
  bscViewPdfInline(c.id);
}
async function bscViewPdfInline(chapterId){
  const c=bscChapter(chapterId);
  if(!c||!c.pdf)return;
  const loading=document.getElementById('bs-pdf-loading'), errEl=document.getElementById('bs-pdf-error'), frame=document.getElementById('bs-pdf-frame');
  if(loading)loading.style.display='flex';
  if(errEl)errEl.style.display='none';
  if(frame)frame.style.display='none';
  const content=await bscFetchPdf(c.pdf.contentId);
  if(loading)loading.style.display='none';
  if(!content){ if(errEl)errEl.style.display='flex'; return; }
  if(frame){ frame.src=`data:application/pdf;base64,${content.base64}`; frame.style.display='block'; }
}
async function bscOpenPdfFullscreen(chapterId){
  const c=bscChapter(chapterId); if(!c||!c.pdf)return;
  const content=await bscFetchPdf(c.pdf.contentId);
  if(!content){toast('PDF not available — try again.','error');return;}
  window.open(`data:application/pdf;base64,${content.base64}`,'_blank');
}
async function bscDownloadPdf(chapterId){
  const c=bscChapter(chapterId); if(!c||!c.pdf)return;
  const content=await bscFetchPdf(c.pdf.contentId);
  if(!content){toast('PDF not available — try again.','error');return;}
  const a=document.createElement('a');
  a.href=`data:application/pdf;base64,${content.base64}`;
  a.download=c.pdf.filename||`week-${c.weekNumber}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
}

// ── PDF upload / replace (single + shared by Bulk PDF Manager) ──
function bscUploadPdfFile(chapterId,file){
  return new Promise((resolve,reject)=>{
    const c=bscChapter(chapterId);
    if(!c){reject(new Error('chapter not found'));return;}
    if(!/\.pdf$/i.test(file.name)||(file.type&&file.type!=='application/pdf')){
      toast(`"${file.name}" is not a PDF.`,'error'); reject(new Error('not a pdf')); return;
    }
    if(file.size===0){ toast(`"${file.name}" is empty.`,'error'); reject(new Error('empty file')); return; }
    if(file.size>BS_PDF_MAX_BYTES){
      toast(`"${file.name}" is ${(file.size/1024).toFixed(0)}KB — the limit is ${(BS_PDF_MAX_BYTES/1024).toFixed(0)}KB. Compress or split the PDF and try again.`,'error',8000);
      reject(new Error('too large')); return;
    }
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('read error'));
    reader.onload=async e=>{
      const b64=e.target.result.split(',')[1];
      const contentId=uid();
      if(!_db||!_fbFns){ toast('Not connected — try again once you are back online.','error'); reject(new Error('offline')); return; }
      try{
        const {doc,setDoc}=_fbFns;
        await setDoc(doc(_db,...bsPdfContentPath(),contentId),{b:b64,t:'application/pdf',filename:bscSanitizeFilename(file.name)});
      }catch(err){ toast(`Upload failed for "${file.name}".`,'error'); reject(err); return; }
      const prevPdf=c.pdf;
      c.pdf={
        contentId, filename:bscSanitizeFilename(file.name), originalFilename:file.name, sizeBytes:file.size,
        mimeType:'application/pdf', pageRange:(prevPdf&&prevPdf.pageRange)||'',
        uploadedAt:new Date().toISOString(), uploadedBy:CURRENT_USER?CURRENT_USER.mid:null,
        version:(prevPdf?prevPdf.version+1:1),
        previousVersions:prevPdf?[...(prevPdf.previousVersions||[]),{contentId:prevPdf.contentId,filename:prevPdf.filename,sizeBytes:prevPdf.sizeBytes,uploadedAt:prevPdf.uploadedAt,uploadedBy:prevPdf.uploadedBy,version:prevPdf.version}]:[],
        sourceName:(D.bibleStudyCurriculum.source||{}).name||'', sourceOrganization:(D.bibleStudyCurriculum.source||{}).organization||''
      };
      try{
        await saveD('bibleStudyCurriculum');
        resolve();
      }catch(err){
        c.pdf=prevPdf;
        toast(`Uploaded "${file.name}", but failed to save — please try again.`,'error');
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}
let BS_UPLOAD_TARGET_CHAPTER=null;
async function bscOpenUploadPdf(chapterId){
  if(!bsFull()){toast('Only officers with Chaplain Hub access can upload chapter PDFs.','error');return;}
  document.querySelectorAll('.bs-card-menu').forEach(m=>m.style.display='none');
  const c=bscChapter(chapterId); if(!c)return;
  if(c.pdf){
    const ok=await confirmDialog('Replace PDF','This chapter already has a PDF uploaded. Replace it with a new file? The current version is kept in history, not deleted.','Replace',false);
    if(!ok)return;
  }
  BS_UPLOAD_TARGET_CHAPTER=chapterId;
  let inp=document.getElementById('bs-pdf-file-inp');
  if(!inp){
    inp=document.createElement('input');
    inp.type='file'; inp.accept='application/pdf,.pdf'; inp.id='bs-pdf-file-inp'; inp.style.display='none';
    inp.onchange=()=>bscHandleSingleUpload(inp);
    document.body.appendChild(inp);
  }
  inp.value='';
  inp.click();
}
async function bscHandleSingleUpload(inp){
  const file=inp.files[0];
  if(!file)return;
  const chapterId=BS_UPLOAD_TARGET_CHAPTER;
  try{
    await bscUploadPdfFile(chapterId,file);
    toast('PDF saved','success');
    bscRenderProgram();
    if(BS_ACTIVE_CHAPTER_ID===chapterId)bscRenderChapterWorkspace();
  }catch(e){ /* toast already shown inside bscUploadPdfFile */ }
}

// ══════════════════════════════════════════════
// BULK PDF MANAGER
// ══════════════════════════════════════════════
let BS_BULK_MATCHES=[], BS_BULK_UNMATCHED=[];
function bscOpenBulkManager(){
  if(!bsFull()){toast('Only officers with Chaplain Hub access can manage chapter PDFs.','error');return;}
  BS_BULK_MATCHES=[]; BS_BULK_UNMATCHED=[];
  bscRenderBulkList();
  openM('m-bs-bulk');
}
function bscRenderBulkList(){
  const el=document.getElementById('bs-bulk-list');
  if(!el)return;
  const chs=[...bscChapters()].sort((a,b)=>a.weekNumber-b.weekNumber);
  el.innerHTML=`<div class="tw"><table class="tbl"><thead><tr><th>Week</th><th>Chapter</th><th>Expected File</th><th>Current</th><th></th></tr></thead><tbody>${
    chs.map(c=>`<tr>
      <td>${c.weekNumber}</td>
      <td>${esc(c.title)}</td>
      <td style="color:var(--mt);font-size:11px">${esc(c.expectedPdfFilename||'—')}</td>
      <td>${c.pdf?`<span class="badge bg2">Uploaded</span>`:`<span class="badge bm2">Missing</span>`}</td>
      <td style="display:flex;gap:4px">
        <button class="btn" style="height:22px;font-size:10px" onclick="bscOpenUploadPdf('${c.id}')">${c.pdf?'Replace':'Upload'}</button>
        ${c.pdf?`<button class="btn" style="height:22px;font-size:10px" onclick="bscOpenPdfFullscreen('${c.id}')">View</button>`:''}
      </td>
    </tr>`).join('')
  }</tbody></table></div>
  <div style="margin-top:13px;border-top:1px solid var(--bdr);padding-top:11px">
    <div class="card-t" style="margin-bottom:6px">Bulk Upload</div>
    <div style="font-size:11.5px;color:var(--mt);margin-bottom:8px">Select multiple PDFs at once — files are matched to chapters by their <code>NN_</code> filename prefix or title, and you will confirm the mapping before anything uploads.</div>
    <input type="file" id="bs-bulk-file-inp" accept="application/pdf,.pdf" multiple onchange="bscBulkFilesSelected(this)">
    <div id="bs-bulk-preview" style="margin-top:11px"></div>
  </div>`;
}
function bscNormalize(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function bscBulkFilesSelected(inp){
  const files=Array.from(inp.files||[]);
  if(!files.length)return;
  const chs=bscChapters();
  BS_BULK_MATCHES=[]; BS_BULK_UNMATCHED=[];
  const used=new Set();
  files.forEach(file=>{
    const prefixMatch=file.name.match(/^0*(\d{1,2})[_\-\s]/);
    let chapter=null, matchType='';
    if(prefixMatch){
      const wk=parseInt(prefixMatch[1],10);
      chapter=chs.find(c=>c.weekNumber===wk);
      if(chapter)matchType='number prefix';
    }
    if(!chapter){
      const norm=bscNormalize(file.name);
      chapter=chs.find(c=>bscNormalize(c.title).length>3&&norm.includes(bscNormalize(c.title)));
      if(chapter)matchType='title match';
    }
    if(chapter&&!used.has(chapter.id)){
      used.add(chapter.id);
      BS_BULK_MATCHES.push({chapterId:chapter.id,weekNumber:chapter.weekNumber,title:chapter.title,file,matchType});
    }else{
      BS_BULK_UNMATCHED.push(file);
    }
  });
  bscRenderBulkPreview();
}
function bscRenderBulkPreview(){
  const el=document.getElementById('bs-bulk-preview');
  if(!el)return;
  const missing=bscChapters().filter(c=>!BS_BULK_MATCHES.some(m=>m.chapterId===c.id)&&!c.pdf);
  el.innerHTML=`
    ${BS_BULK_MATCHES.length?`<div style="font-size:11.5px;font-weight:600;margin-bottom:5px">Matched (${BS_BULK_MATCHES.length})</div>
    <div style="margin-bottom:9px">${BS_BULK_MATCHES.map(m=>`<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0"><span>Week ${m.weekNumber} — ${esc(m.title)}</span><span style="color:var(--mt)">${esc(m.file.name)} (${m.matchType})</span></div>`).join('')}</div>`:''}
    ${BS_BULK_UNMATCHED.length?`<div style="font-size:11.5px;font-weight:600;color:var(--rd);margin-bottom:5px">Unmatched files (${BS_BULK_UNMATCHED.length}) — will not be uploaded</div>
    <div style="margin-bottom:9px">${BS_BULK_UNMATCHED.map(f=>`<div style="font-size:11.5px;color:var(--mt)">${esc(f.name)}</div>`).join('')}</div>`:''}
    ${missing.length?`<div style="font-size:11.5px;color:var(--ht)">Still missing after this upload: ${missing.map(c=>'Week '+c.weekNumber).join(', ')}</div>`:''}
    ${BS_BULK_MATCHES.length?`<button class="btn btn-p" style="margin-top:9px" onclick="bscConfirmBulkUpload()">Upload ${BS_BULK_MATCHES.length} File${BS_BULK_MATCHES.length>1?'s':''}</button>`:''}
  `;
}
async function bscConfirmBulkUpload(){
  if(!BS_BULK_MATCHES.length)return;
  const total=BS_BULK_MATCHES.length;
  let done=0, failed=0;
  const el=document.getElementById('bs-bulk-preview');
  for(const m of BS_BULK_MATCHES){
    try{ await bscUploadPdfFile(m.chapterId,m.file); done++; }
    catch(e){ failed++; }
    if(el)el.innerHTML=`<div style="font-size:12px">Uploading… ${done+failed}/${total}</div>`;
  }
  BS_BULK_MATCHES=[]; BS_BULK_UNMATCHED=[];
  bscRenderBulkList();
  bscRenderProgram();
  toast(`${done} PDF${done!==1?'s':''} uploaded${failed?`, ${failed} failed`:''}`,failed?'warning':'success',6000);
}

// ══════════════════════════════════════════════
// SCHEDULING + SESSIONS
// ══════════════════════════════════════════════
function bscCurrentSession(c){
  const sessions=c.sessions||[];
  if(!sessions.length)return null;
  const last=sessions[sessions.length-1];
  return last.status==='completed'?null:last;
}
function bscOpenScheduleModal(chapterId){
  if(!bsFull()){toast('Only officers with Chaplain Hub access can schedule sessions.','error');return;}
  const c=bscChapter(chapterId); if(!c)return;
  document.getElementById('bs-sch-chapter-id').value=chapterId;
  document.getElementById('bs-sch-date').value=c.scheduledAt?c.scheduledAt.slice(0,10):'';
  document.getElementById('bs-sch-time').value=(c.scheduledAt&&c.scheduledAt.includes('T'))?c.scheduledAt.split('T')[1]:'';
  document.getElementById('bs-sch-location').value=c.scheduledLocation||'';
  const primSel=document.getElementById('bs-sch-primary');
  if(primSel){
    primSel.innerHTML='<option value="">— Select —</option>'+mOpts();
    const session=bscCurrentSession(c);
    primSel.value=(session&&session.leaderIds&&session.leaderIds[0])||'';
  }
  openM('m-bs-schedule');
}
// Scheduling a chapter also creates/updates a linked entry in the shared D.events calendar
// (type:'faith', faithCategory:'bible_study') so it shows up on the Calendar for chapter-wide
// awareness — same pattern as Devotionals above, just linked (c.scheduledEventId) rather than
// fully migrated, since a chapter's rich data (PDF, prep checklist, attendance, session plan)
// stays in D.bibleStudyCurriculum where it already lives. There's no "unschedule" action in this
// module itself (bscResetProgress explicitly preserves scheduling) — but deleting the linked
// event straight from the Calendar is a de facto unschedule, so deleteEvent() (js/events.js)
// clears c.scheduledAt/scheduledEventId back on this chapter when that happens.
function bscSyncScheduleEvent(c,location,primaryLeaderId){
  const title='Bible Study: Week '+c.weekNumber+' — '+(c.title||'');
  const fields={
    title, date:c.scheduledAt.slice(0,10), start:c.scheduledAt.includes('T')?c.scheduledAt.split('T')[1]:'',
    location, type:'faith', faithCategory:'bible_study', mandatory:false,
    weekNumber:c.weekNumber, owner:primaryLeaderId||null,
  };
  let ev=c.scheduledEventId?D.events.find(e=>e.id===c.scheduledEventId):null;
  if(ev){ Object.assign(ev,fields); }
  else{
    ev={id:uid(),...fields};
    D.events.push(ev);
    c.scheduledEventId=ev.id;
  }
}
async function bscSaveSchedule(){
  const chapterId=document.getElementById('bs-sch-chapter-id').value;
  const c=bscChapter(chapterId); if(!c)return;
  const date=document.getElementById('bs-sch-date').value;
  if(!date){toast('A date is required','error');return;}
  const time=document.getElementById('bs-sch-time').value;
  const location=document.getElementById('bs-sch-location').value.trim();
  const primaryLeaderId=document.getElementById('bs-sch-primary').value||null;
  const scheduledAt=date+(time?'T'+time:'');
  const prev={status:c.status,scheduledAt:c.scheduledAt,scheduledLocation:c.scheduledLocation};
  c.scheduledAt=scheduledAt;
  c.scheduledLocation=location;
  if(c.status==='not_started'||c.status==='preparing'||c.status==='ready')c.status='scheduled';
  let session=bscCurrentSession(c);
  let pushedNew=false;
  if(!session){
    session={id:uid(),startedAt:null,endedAt:null,leaderIds:primaryLeaderId?[primaryLeaderId]:[],status:'scheduled',
              sessionPlan:BS_DEFAULT_SESSION_PLAN.map(s=>({id:uid(),label:s.label,minutes:s.minutes,done:false,note:''})),
              attendance:{},attendanceNote:'',actualDurationMinutes:null,followUpTaskIds:[]};
    c.sessions=c.sessions||[];
    c.sessions.push(session);
    pushedNew=true;
  }else{
    session.leaderIds=primaryLeaderId?[primaryLeaderId]:session.leaderIds;
  }
  const eventWasNew=!c.scheduledEventId;
  bscSyncScheduleEvent(c,location,primaryLeaderId);
  try{
    await saveD('bibleStudyCurriculum','events');
    closeM(null,document.getElementById('m-bs-schedule'));
    toast('Session scheduled','success');
    bscRenderProgram();
  }catch(e){
    Object.assign(c,prev);
    if(pushedNew)c.sessions.pop();
    if(eventWasNew&&c.scheduledEventId){ D.events=D.events.filter(x=>x.id!==c.scheduledEventId); c.scheduledEventId=null; }
    toast('Failed to save. Please try again.','error');
  }
}

// ── Session Plan tab ──
function bscRenderSessionTab(c){
  const canEdit=bsFull();
  const el=document.getElementById('bs-pane-session');
  if(!el)return;
  const session=bscCurrentSession(c);
  if(!session){
    el.innerHTML=es('ti-calendar-event','slate','No active session','Schedule a session to build out its plan.',canEdit?`<button class="btn btn-p" onclick="bscOpenScheduleModal('${c.id}')">Schedule Session</button>`:'');
    return;
  }
  const totalMin=(session.sessionPlan||[]).reduce((a,s)=>a+(s.minutes||0),0);
  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:12px;color:var(--mt)">Est. total: ${totalMin} min</div>
      ${canEdit?`<button class="btn" style="height:24px;font-size:10.5px" onclick="bscAddSessionSection('${c.id}')"><i class="ti ti-plus"></i>Add Section</button>`:''}
    </div>
    <div id="bs-session-steps">
      ${(session.sessionPlan||[]).map(s=>`
        <div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--bdr);border-radius:8px;margin-bottom:6px;${s.done?'opacity:.6':''}">
          <i class="ti ${s.done?'ti-square-rounded-check':'ti-square-rounded'}" style="color:${s.done?'var(--gn)':'var(--mt)'};cursor:${canEdit?'pointer':'default'}" ${canEdit?`onclick="bscToggleSessionStep('${c.id}','${s.id}')"`:''}></i>
          <div style="flex:1">
            <div style="font-size:12.5px;font-weight:600;${s.done?'text-decoration:line-through':''}">${esc(s.label)}</div>
            ${s.note?`<div style="font-size:11px;color:var(--mt)">${esc(s.note)}</div>`:''}
          </div>
          <span style="font-size:11px;color:var(--mt)">${s.minutes||0} min</span>
          ${canEdit?`<button class="btn" style="height:22px;width:22px;padding:0" onclick="bscAddSessionNote('${c.id}','${s.id}')" aria-label="Add note"><i class="ti ti-note"></i></button>`:''}
          ${canEdit?`<button class="btn btn-d" style="height:22px;width:22px;padding:0" onclick="bscRemoveSessionStep('${c.id}','${s.id}')" aria-label="Remove section"><i class="ti ti-trash"></i></button>`:''}
        </div>`).join('')}
    </div>
    ${c.pdf?`<div style="margin-top:11px"><button class="btn" onclick="bscGoToTab('bs-pane-pdf')"><i class="ti ti-file-text"></i>Open PDF Alongside</button></div>`:''}`;
}
async function bscToggleSessionStep(chapterId,stepId){
  if(!bsFull())return;
  const c=bscChapter(chapterId); const session=bscCurrentSession(c); if(!session)return;
  const step=(session.sessionPlan||[]).find(s=>s.id===stepId); if(!step)return;
  const prev=step.done; step.done=!step.done;
  if(!session.startedAt)session.startedAt=new Date().toISOString();
  try{ await saveD('bibleStudyCurriculum'); bscRenderSessionTab(c); }
  catch(e){ step.done=prev; toast('Failed to save. Please try again.','error'); }
}
async function bscAddSessionNote(chapterId,stepId){
  const c=bscChapter(chapterId); const session=bscCurrentSession(c); if(!session)return;
  const step=(session.sessionPlan||[]).find(s=>s.id===stepId); if(!step)return;
  const note=prompt('Quick note for "'+step.label+'":',step.note||'');
  if(note===null)return;
  const prev=step.note; step.note=note.trim();
  try{ await saveD('bibleStudyCurriculum'); bscRenderSessionTab(c); }
  catch(e){ step.note=prev; toast('Failed to save. Please try again.','error'); }
}
async function bscAddSessionSection(chapterId){
  if(!bsFull())return;
  const c=bscChapter(chapterId); const session=bscCurrentSession(c); if(!session)return;
  const label=prompt('Section name:'); if(!label||!label.trim())return;
  session.sessionPlan=session.sessionPlan||[];
  session.sessionPlan.push({id:uid(),label:label.trim(),minutes:10,done:false,note:''});
  try{ await saveD('bibleStudyCurriculum'); bscRenderSessionTab(c); }
  catch(e){ session.sessionPlan.pop(); toast('Failed to save. Please try again.','error'); }
}
async function bscRemoveSessionStep(chapterId,stepId){
  if(!bsFull())return;
  const c=bscChapter(chapterId); const session=bscCurrentSession(c); if(!session)return;
  const ok=await confirmDialog('Remove Section','Remove this section from the session plan?');
  if(!ok)return;
  const idx=session.sessionPlan.findIndex(s=>s.id===stepId);
  if(idx<0)return;
  const removed=session.sessionPlan[idx];
  session.sessionPlan=session.sessionPlan.filter(s=>s.id!==stepId);
  try{ await saveD('bibleStudyCurriculum'); bscRenderSessionTab(c); }
  catch(e){ session.sessionPlan.splice(idx,0,removed); toast('Failed to save. Please try again.','error'); }
}

// ── Attendance tab (read-only — attendance is recorded on the main Attendance page; this
// tab just surfaces the numbers here for reference). ──
function bscRenderAttendanceTab(c){
  const el=document.getElementById('bs-pane-attendance');
  if(!el)return;
  const session=bscCurrentSession(c);
  if(!session){
    el.innerHTML=es('ti-users','slate','No active session','Schedule a session first.','');
    return;
  }
  const att=session.attendance||{};
  const present=Object.values(att).filter(v=>v==='present').length;
  el.innerHTML=`
    <div style="font-size:12px;color:var(--mt);margin-bottom:9px">${present} present of ${sortedMembers().length} members</div>
    <div id="bs-att-list">
      ${sortedMembers().map(m=>{
        const st=att[m.id]||'';
        const cls=st==='present'?'att-check present':st==='absent'?'att-check absent':st==='excused'?'att-check excused':'att-check';
        const lbl=st==='present'?'✓':st==='absent'?'U':st==='excused'?'E':'';
        return `<div style="display:flex;align-items:center;gap:7px;padding:4px 0">
          <div class="${cls}" title="${st||'Unmarked'}">${lbl}</div>
          <span style="font-size:12px">${esc(m.name)}</span>
        </div>`;
      }).join('')}
    </div>
    ${session.attendanceNote?`<div class="fr" style="margin-top:11px"><div class="fld"><label>Attendance Note</label><div style="font-size:12px;color:var(--mt);white-space:pre-line">${esc(session.attendanceNote)}</div></div></div>`:''}
  `;
}

// ── Notes & Follow-Up tab (private — chaplainLeaderContent, restricted read at the rules
// level; the tab itself is simply not rendered for anyone chFull() returns false for). ──
function bscRenderNotesTab(c){
  const canEdit=bsFull();
  const el=document.getElementById('bs-pane-notes');
  if(!el)return;
  if(!canEdit){
    el.innerHTML=es('ti-lock','slate','Private to Chaplain Hub officers','Notes, meeting summaries, and prayer intentions for this chapter are only visible to officers with Chaplain Hub access.');
    return;
  }
  if(!BS_LEADER_CONTENT){
    el.innerHTML=`<div style="padding:20px;text-align:center;color:var(--mt);font-size:12.5px"><i class="ti ti-loader-2"></i> Loading private notes…</div>`;
    return;
  }
  const pn=BS_LEADER_CONTENT.privateNotes[c.id]||{chaplainNotes:'',meetingSummary:'',whatWentWell:'',whatToChangeNextTime:''};
  const canTasks=typeof canEditPage==='function'&&canEditPage('tasks');
  const followUps=D.tasks.filter(t=>t.title&&t.title.indexOf(`Follow-up: Week ${c.weekNumber} —`)===0);
  el.innerHTML=`
    <div style="font-size:11px;color:var(--rd);font-weight:600;margin-bottom:11px"><i class="ti ti-lock"></i> Private — visible only to Chaplain Hub officers</div>
    <div class="fr"><div class="fld"><label>Chaplain Notes</label><textarea id="bs-notes-chaplain" onblur="bscSavePrivateField('${c.id}','chaplainNotes',this.value)">${esc(pn.chaplainNotes||'')}</textarea></div></div>
    <div class="fr"><div class="fld"><label>Meeting Summary</label><textarea id="bs-notes-summary" onblur="bscSavePrivateField('${c.id}','meetingSummary',this.value)">${esc(pn.meetingSummary||'')}</textarea></div></div>
    <div class="fr c2">
      <div class="fld"><label>What Went Well</label><textarea id="bs-notes-well" onblur="bscSavePrivateField('${c.id}','whatWentWell',this.value)">${esc(pn.whatWentWell||'')}</textarea></div>
      <div class="fld"><label>What to Change Next Time</label><textarea id="bs-notes-change" onblur="bscSavePrivateField('${c.id}','whatToChangeNextTime',this.value)">${esc(pn.whatToChangeNextTime||'')}</textarea></div>
    </div>
    <div style="margin-top:11px;display:flex;justify-content:space-between;align-items:center">
      <div class="card-t">Follow-Up Tasks</div>
      ${canTasks?`<button class="btn" style="height:24px;font-size:10.5px" onclick="bscOpenFollowUpTask('${c.id}')"><i class="ti ti-plus"></i>Create Task</button>`
        :`<span style="font-size:10.5px;color:var(--ht)">Ask an exec for Tasks access to create follow-ups</span>`}
    </div>
    <div id="bs-followup-list" style="margin-top:6px">
      ${followUps.length?followUps.map(t=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--bdr)"><span style="font-size:12px">${esc(t.title)}</span><span class="badge ${t.status==='done'?'bg2':'bm2'}">${esc(t.status)}</span></div>`).join(''):'<div style="font-size:11.5px;color:var(--ht)">No follow-up tasks yet.</div>'}
    </div>`;
}
async function bscSavePrivateField(chapterId,field,value){
  await bscLoadLeaderContent();
  if(!BS_LEADER_CONTENT)return;
  if(!BS_LEADER_CONTENT.privateNotes[chapterId])BS_LEADER_CONTENT.privateNotes[chapterId]={chaplainNotes:'',meetingSummary:'',whatWentWell:'',whatToChangeNextTime:'',prayerIntentions:[],questionsToRevisit:[],followUps:[]};
  BS_LEADER_CONTENT.privateNotes[chapterId][field]=value;
  await bscSaveLeaderContent();
}
function bscOpenFollowUpTask(chapterId){
  if(!canEditPage('tasks')){toast('You need Tasks access to create follow-up tasks — ask an exec to grant it in Settings.','error');return;}
  const c=bscChapter(chapterId); if(!c)return;
  openM('m-addtask');
  const titleField=document.getElementById('nt-t');
  if(titleField)titleField.value=`Follow-up: Week ${c.weekNumber} — ${c.title}`;
}

// ══════════════════════════════════════════════
// STATUS ACTIONS + EDIT CHAPTER + PROGRAM SETTINGS
// ══════════════════════════════════════════════
async function bscSetStatus(chapterId,status,extra){
  const c=bscChapter(chapterId); if(!c)return;
  const prev={status:c.status,completedAt:c.completedAt,completedBy:c.completedBy,archived:c.archived};
  c.status=status;
  if(status==='completed'){ c.completedAt=new Date().toISOString(); c.completedBy=CURRENT_USER?CURRENT_USER.mid:null; }
  if(extra)Object.assign(c,extra);
  try{ await saveD('bibleStudyCurriculum'); bscRenderProgram(); }
  catch(e){ Object.assign(c,prev); toast('Failed to save. Please try again.','error'); }
}
function bscMarkReady(chapterId){ if(!bsFull())return; bscSetStatus(chapterId,'ready').then(()=>toast('Chapter marked Ready','success')); }
async function bscMarkComplete(chapterId){
  if(!bsFull())return;
  const c=bscChapter(chapterId); if(!c)return;
  const ok=await confirmDialog('Mark Chapter Complete','Mark this chapter as completed? You can still edit it afterward.','Mark Complete',false);
  if(!ok)return;
  const session=bscCurrentSession(c);
  if(session){ session.status='completed'; session.endedAt=new Date().toISOString(); if(!session.startedAt)session.startedAt=session.endedAt; }
  await bscSetStatus(chapterId,'completed');
  toast('Chapter marked Complete','success');
}
async function bscMarkSkipped(chapterId){
  if(!bsFull())return;
  document.querySelectorAll('.bs-card-menu').forEach(m=>m.style.display='none');
  const ok=await confirmDialog('Mark Skipped','Mark this chapter as skipped for this semester?','Mark Skipped',false);
  if(!ok)return;
  await bscSetStatus(chapterId,'skipped');
  toast('Chapter marked Skipped','info');
}
async function bscResetProgress(chapterId){
  if(!bsFull())return;
  document.querySelectorAll('.bs-card-menu').forEach(m=>m.style.display='none');
  const c=bscChapter(chapterId); if(!c)return;
  const ok=await confirmDialog('Reset Progress',"Reset this chapter's status and preparation checklist back to Not Started? Scheduling, attendance, and notes are kept.");
  if(!ok)return;
  const prev={status:c.status,preparationChecklist:c.preparationChecklist};
  c.status='not_started';
  c.preparationChecklist=BS_PREP_CHECKLIST_DEFAULTS.map(label=>({id:uid(),label,done:false}));
  try{ await saveD('bibleStudyCurriculum'); bscRenderProgram(); toast('Progress reset','info'); }
  catch(e){ Object.assign(c,prev); toast('Failed to save. Please try again.','error'); }
}
async function bscArchiveChapter(chapterId){
  if(!bsFull())return;
  document.querySelectorAll('.bs-card-menu').forEach(m=>m.style.display='none');
  const c=bscChapter(chapterId); if(!c)return;
  const ok=await confirmDialog('Archive Chapter','Archive this chapter? It will be hidden from the main program view but not deleted — you can unarchive it later.','Archive',false);
  if(!ok)return;
  const prev=c.archived; c.archived=true;
  try{ await saveD('bibleStudyCurriculum'); bscRenderProgram(); toast('Chapter archived','info'); }
  catch(e){ c.archived=prev; toast('Failed to save. Please try again.','error'); }
}
async function bscUnarchiveChapter(chapterId){
  if(!bsFull())return;
  document.querySelectorAll('.bs-card-menu').forEach(m=>m.style.display='none');
  const c=bscChapter(chapterId); if(!c)return;
  const prev=c.archived; c.archived=false;
  try{ await saveD('bibleStudyCurriculum'); bscRenderProgram(); toast('Chapter unarchived','info'); }
  catch(e){ c.archived=prev; toast('Failed to save. Please try again.','error'); }
}

function bscOpenEditChapter(chapterId){
  if(!bsFull()){toast('Only officers with Chaplain Hub access can edit chapters.','error');return;}
  document.querySelectorAll('.bs-card-menu').forEach(m=>m.style.display='none');
  const c=bscChapter(chapterId); if(!c)return;
  document.getElementById('bs-ec-id').value=c.id;
  document.getElementById('bs-ec-title').value=c.title||'';
  document.getElementById('bs-ec-summary').value=c.summary||'';
  document.getElementById('bs-ec-theme').value=c.mainTheme||'';
  document.getElementById('bs-ec-scripture').value=c.scripturePassages||'';
  document.getElementById('bs-ec-passage').value=c.passageToRead||'';
  document.getElementById('bs-ec-leadersum').value=c.leaderSummary||'';
  document.getElementById('bs-ec-discfocus').value=c.groupDiscussionFocus||'';
  document.getElementById('bs-ec-leaderpages').value=c.leaderPageRange||'';
  document.getElementById('bs-ec-discpages').value=c.discussionPageRange||'';
  document.getElementById('bs-ec-prepmin').value=c.estimatedPreparationMinutes||'';
  document.getElementById('bs-ec-sessmin').value=c.estimatedSessionMinutes||'';
  openM('m-bs-edit-chapter');
}
async function bscSaveEditChapter(){
  const id=document.getElementById('bs-ec-id').value;
  const c=bscChapter(id); if(!c)return;
  const title=document.getElementById('bs-ec-title').value.trim();
  if(!title){toast('Title is required','error');return;}
  const prev={...c};
  c.title=title; c.topic=title;
  c.summary=document.getElementById('bs-ec-summary').value.trim();
  c.mainTheme=document.getElementById('bs-ec-theme').value.trim();
  c.scripturePassages=document.getElementById('bs-ec-scripture').value.trim();
  c.passageToRead=document.getElementById('bs-ec-passage').value.trim();
  c.leaderSummary=document.getElementById('bs-ec-leadersum').value.trim();
  c.groupDiscussionFocus=document.getElementById('bs-ec-discfocus').value.trim();
  c.leaderPageRange=document.getElementById('bs-ec-leaderpages').value.trim();
  c.discussionPageRange=document.getElementById('bs-ec-discpages').value.trim();
  c.estimatedPreparationMinutes=parseInt(document.getElementById('bs-ec-prepmin').value)||0;
  c.estimatedSessionMinutes=parseInt(document.getElementById('bs-ec-sessmin').value)||0;
  try{
    await saveD('bibleStudyCurriculum');
    closeM(null,document.getElementById('m-bs-edit-chapter'));
    bscRenderProgram();
    toast('Chapter saved','success');
  }catch(e){
    Object.assign(c,prev);
    toast('Failed to save. Please try again.','error');
  }
}

function bscOpenProgramSettings(){
  if(!bsFull()){toast('Only officers with Chaplain Hub access can edit program settings.','error');return;}
  const bsc=D.bibleStudyCurriculum;
  document.getElementById('bs-ps-title').value=bsc.title||'';
  document.getElementById('bs-ps-subtitle').value=bsc.subtitle||'';
  document.getElementById('bs-ps-source-name').value=(bsc.source||{}).name||'';
  document.getElementById('bs-ps-source-org').value=(bsc.source||{}).organization||'';
  document.getElementById('bs-ps-attribution').value=(bsc.source||{}).attribution||'';
  openM('m-bs-program-settings');
}
async function bscSaveProgramSettings(){
  const bsc=D.bibleStudyCurriculum;
  const prev=JSON.parse(JSON.stringify({title:bsc.title,subtitle:bsc.subtitle,source:bsc.source}));
  bsc.title=document.getElementById('bs-ps-title').value.trim()||'Salvation History';
  bsc.subtitle=document.getElementById('bs-ps-subtitle').value.trim();
  bsc.source={
    name:document.getElementById('bs-ps-source-name').value.trim(),
    organization:document.getElementById('bs-ps-source-org').value.trim(),
    attribution:document.getElementById('bs-ps-attribution').value.trim()
  };
  try{
    await saveD('bibleStudyCurriculum');
    closeM(null,document.getElementById('m-bs-program-settings'));
    bscRenderProgram();
    toast('Program settings saved','success');
  }catch(e){
    Object.assign(bsc,prev);
    toast('Failed to save. Please try again.','error');
  }
}

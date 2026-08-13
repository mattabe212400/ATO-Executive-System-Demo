// ══════════════════════════════════════════════
// FIREBASE DATA LAYER
// ══════════════════════════════════════════════

const LS_CACHE = 'ato_v8_cache';
let D = {};
let _db   = null;
let _fbFns = null;
let _unsubs = [];

// Firestore paths
const FS_PATH = 'chapters';
let   FS_ID   = '';        // set dynamically after login via setChapterId()
const FS_DATA = 'data';    // sub-collection: /chapters/{chapterId}/data/{key}

function setChapterId(id){ FS_ID = id; }

// One Firestore document per key — eliminates the 1 MB single-doc ceiling.
// 'finance' and 'cases' are NOT here — both moved out of this shared, bulk-read collection
// into their own dedicated paths (chapters/{id}/finance, financeDues, judicialCases; see
// loadFinanceData()/loadJudicialCases() below) specifically so they can be read-gated by role
// without breaking this collection's single bulk query for everyone else (see firestore.rules'
// comment on chapters/{chapterId}/data/{key} for the full history of why).
const FS_KEYS = [
  'members', 'events', 'tasks', 'goals', 'notes', 'shifts',
  'files', 'notifs', 'committees', 'committeeLeaders', 'transitions', 'attendance',
  'academics', 'recruitment', 'philanthropy', 'communityService', 'agenda',
  'alumni', 'ritual', 'newMemberEducation', 'transitionHub', 'settings',
  'kcrew', 'chores', 'social', 'healthHistory', 'chaplainHub', 'bibleStudyCurriculum',
  'houseLife', 'achievements'
];

// ── Default structure for empty collections ──
function dDefaults(){
  if(!D.members)D.members=[];
  if(!D.events)D.events=[];
  if(!D.tasks)D.tasks=[];
  if(!D.goals)D.goals=[];
  if(!D.notes)D.notes=[];
  if(!D.cases)D.cases=[];
  // Full shape/migration (array->object, per-weekend day defaults) is handled by
  // sbEnsureDefaults() in js/sober.js — this just guarantees the key exists.
  if(!D.shifts)D.shifts={pledgeShadowStart:'',weekends:[]};
  if(!D.files)D.files=[];
  if(!D.notifs)D.notifs=[];
  if(!D.committees)D.committees=[];
  // Deduped member-id array of every committee's chair — kept in sync by js/committees.js CRUD.
  // Exists purely so firestore.rules can check chair-status with a plain array-membership test
  // (rules can't iterate D.committees' list-of-maps directly).
  if(!D.committeeLeaders)D.committeeLeaders=[];
  // Full shape/migration (positions, roster, icon, fileFolders, healthHistory) is handled by
  // coEnsureDefaults() in js/committees.js — this just guarantees the key exists.
  if(typeof coEnsureDefaults==='function')coEnsureDefaults();
  if(!D.transitions)D.transitions=[];
  if(!D.attendance)D.attendance={};
  if(!D.academics)D.academics={gpas:{},history:[]};
  if(!D.finance)D.finance={dues:{},fines:[],expenses:[],plans:[],payments:[],nationalDues:{},nationalPayments:[],budget:{Social:0,Recruitment:0,Philanthropy:0,House:0,Brotherhood:0,Operations:0,Risk:0}};
  if(!D.finance.budget)D.finance.budget={};
  if(!D.finance.nationalDues)D.finance.nationalDues={};
  if(!D.finance.nationalPayments)D.finance.nationalPayments=[];
  if(!D.recruitment)D.recruitment={rushees:[],events:[],goal:{target:20,label:'New Members This Semester'}};
  if(!D.recruitment.rushees)D.recruitment.rushees=[];
  if(!D.recruitment.events)D.recruitment.events=[];
  if(!D.recruitment.goal)D.recruitment.goal={target:20,label:'New Members This Semester'};
  // Philanthropy (fundraising) — narrowed from the old combined Philanthropy+Community
  // Service shape; Community Service now lives in its own D.communityService doc/page.
  // Neither has its own "events" field — both derive their event list from the shared
  // D.events calendar (filtered by type:'philanthropy'/'service') so it always matches Calendar.
  if(!D.philanthropy)D.philanthropy={fundraisingLogs:[],goals:{events:4,funds:2000},organizations:[],vendors:[]};
  if(!D.philanthropy.fundraisingLogs)D.philanthropy.fundraisingLogs=D.philanthropy.funds||[];
  if(!D.philanthropy.organizations)D.philanthropy.organizations=[];
  if(!D.philanthropy.vendors)D.philanthropy.vendors=[];
  if(!D.philanthropy.goals)D.philanthropy.goals={events:4,funds:2000};
  if(!D.communityService)D.communityService={hours:[],goals:{totalHrs:500,events:6,avgHrs:4},locations:[]};
  if(!D.communityService.locations)D.communityService.locations=[];
  if(!D.agenda)D.agenda={items:[],archived:[]};
  if(!D.alumni)D.alumni={contacts:[],events:[],outreach:[]};
  // Ritual — narrowed to the checklist only; sessions/progress now live in D.newMemberEducation.
  if(!D.ritual)D.ritual={items:[]};
  if(!D.newMemberEducation)D.newMemberEducation={sessions:[],requirements:[],progress:{}};
  if(!D.transitionHub)D.transitionHub={deadlines:[],issues:[],archive:[]};
  if(!D.settings)D.settings={name:'',year:'',classYear:'Senior',notifAttendance:true,notifTasks:true,notifSober:true,notifWeekly:true,chapterName:(typeof CURRENT_USER!=='undefined'&&CURRENT_USER?.chapterName)||'',university:(typeof CURRENT_USER!=='undefined'&&CURRENT_USER?.university)||'',chapterSize:'',chapterFounded:''};
  if(!D.kcrew)D.kcrew={schedule:{lunch:{mon:[],tue:[],wed:[],thu:[],fri:[]},dinner:{mon:[],tue:[],wed:[],thu:[]}}};
  if(!D.chores)D.chores={list:[],checks:{}};
  // Social Events planning data, keyed by the linked D.events entry's id (venue/vendor/budget —
  // Social no longer has a self-service RSVP feature).
  if(!D.social)D.social={planning:{},vendors:[]};
  if(!D.social.planning)D.social.planning={};
  if(!D.social.vendors)D.social.vendors=[];
  // Passive daily snapshots of the Chapter Health Score, written by anyone viewing the
  // Health Scorecard page — the only source of real historical trend data for that score.
  if(!D.healthHistory)D.healthHistory=[];
  // Chaplain Hub — Bible study planning, devotionals, brotherhood/morale events, and the
  // preserved ritual checklist (D.ritual.items, above) all live under the same 'ritual' page grant.
  if(!D.chaplainHub)D.chaplainHub={weeklyFocus:'',chaplainNotes:'',checkIns:[],bibleStudies:[],bibleStudyProgram:[],devotionals:[],events:[]};
  if(!D.chaplainHub.checkIns)D.chaplainHub.checkIns=[];
  if(!D.chaplainHub.bibleStudies)D.chaplainHub.bibleStudies=[];
  // Week-by-week Bible Study curriculum, imported via CSV (js/import.js, type
  // 'bibleStudyProgram') — same Week/Topic/Notes shape as Committees' per-committee program.
  if(!D.chaplainHub.bibleStudyProgram)D.chaplainHub.bibleStudyProgram=[];
  if(!D.chaplainHub.devotionals)D.chaplainHub.devotionals=[];
  if(!D.chaplainHub.events)D.chaplainHub.events=[];
  // Bible Study Program — full chapter shape/migration/seed (13-chapter Salvation History
  // curriculum, PDF-per-chapter) is handled by bscEnsureDefaults() in js/biblestudy.js — this
  // just guarantees the key exists before that runs. D.chaplainHub.bibleStudyProgram (above) is
  // the old Week/Topic/Notes list this feature replaced — left untouched, never deleted.
  if(typeof bscEnsureDefaults==='function')bscEnsureDefaults();
  // House Life (rooms, parking, priority points) — full shape/migration and the 50-row
  // priority-points rubric seed are handled by hlEnsureDefaults() in js/houselife.js — this
  // just guarantees the key exists before that runs.
  if(!D.houseLife)D.houseLife={rooms:[],parking:[],prefCriteria:[],prefScores:{}};
  if(typeof hlEnsureDefaults==='function')hlEnsureDefaults();
  // Chapter Achievements — a lightweight, chapter-entered record feeding the True Merit Report
  // Assistant's awards_and_achievements section (js/truemerit.js). Flat list, no migration needed.
  if(!D.achievements)D.achievements=[];
}

// ── LOCAL CACHE ──
function saveDCache(){
  try{ localStorage.setItem(LS_CACHE, JSON.stringify(D)); }catch(e){}
}

function loadDCache(){
  try{
    const c = localStorage.getItem(LS_CACHE);
    if(c) D = JSON.parse(c);
  }catch{ D = {}; }
  dDefaults();
}

// ── FIRESTORE WRITE (debounced, batched) ──
let _saveDPending   = false;
let _saveDTimer     = null;
let _saveDResolvers = [];
let _saveDLastErrToast = 0;
let _saveInFlight   = false;
let _remoteRenderTimer = null;
const _appStartTime = Date.now();
let _firebaseConfirmed = false;
const _dirtyKeys = new Set();
function hasPendingWrites(){ return _dirtyKeys.size > 0; }

function saveD(...keys){
  saveDCache();
  if(!_db || !_fbFns || !FS_ID) return Promise.resolve();
  const toMark = keys.length > 0 ? keys : FS_KEYS;
  toMark.forEach(k => _dirtyKeys.add(k));
  return new Promise((resolve, reject) => {
    _saveDResolvers.push({ resolve, reject });
    clearTimeout(_saveDTimer);
    _saveDTimer = setTimeout(_saveDFlush, 150);
  });
}

async function _saveDFlush(){
  if(_saveDPending){
    clearTimeout(_saveDTimer);
    _saveDTimer = setTimeout(_saveDFlush, 200);
    return;
  }

  const waiting = _saveDResolvers.splice(0);
  if(!waiting.length) return;

  // Snapshot and clear dirty keys before await so new mutations queue to next batch
  const keysToWrite = [..._dirtyKeys];
  _dirtyKeys.clear();

  _saveDPending = true;
  _saveInFlight = true;

  const { doc, writeBatch } = _fbFns;
  try{
    const batch = writeBatch(_db);
    const now = Date.now();
    const uid = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER?.uid) || null;
    for(const key of keysToWrite){
      const ref = doc(_db, FS_PATH, FS_ID, FS_DATA, key);
      batch.set(ref, { value: D[key] ?? null, updatedAt: now, updatedBy: uid });
    }
    await batch.commit();
    waiting.forEach(r => r.resolve());
  }catch(e){
    keysToWrite.forEach(k => _dirtyKeys.add(k));
    console.error('Firestore saveD error:', e.code, e.message);
    if(_firebaseConfirmed && (!_saveDLastErrToast || Date.now()-_saveDLastErrToast > 60000)){
      _saveDLastErrToast = Date.now();
      toast('Save failed: ' + (e.code || e.message || 'unknown error'), 'error', 8000);
    }
    waiting.forEach(r => r.reject(e));
  }finally{
    _saveDPending = false;
    setTimeout(() => { _saveInFlight = false; }, 800);
  }
}

// ── FIRESTORE LOAD (with migration from old single-doc format) ──
async function loadD(){
  loadDCache();
  if(!_db || !_fbFns || !FS_ID){ dDefaults(); return; }

  const { doc, getDoc, deleteDoc } = _fbFns;
  try{
    // Detect old single-doc format: root doc at /chapters/gamma_upsilon had
    // all keys (members, events, ...) and an `updatedAt` number field.
    const rootSnap = await getDoc(doc(_db, FS_PATH, FS_ID));
    if(rootSnap.exists() && typeof rootSnap.data().updatedAt === 'number'){
      // ── MIGRATE ── copy old flat doc into sub-collection, then delete it
      const old = rootSnap.data();
      for(const key of FS_KEYS){
        if(old[key] !== undefined) D[key] = old[key];
      }
      dDefaults();
      await saveD();                                    // writes to new sub-collection
      await deleteDoc(doc(_db, FS_PATH, FS_ID));       // remove old doc
      console.info('[ATO] Migrated data to per-collection sub-documents.');
      saveDCache();
      return;
    }

    // New format: population comes from startRealtimeSync()'s first snapshot rather than a
    // one-off getDocs() here — the listener is about to re-fetch the exact same collection
    // anyway (auth.js calls it right after loadD() resolves), so doing both means every login
    // billed two full reads of the data subcollection instead of one. startRealtimeSync() is
    // idempotent, so auth.js's call after this one just reuses the listener already opened here.
    const empty = await startRealtimeSync();
    if(empty){
      dDefaults();
      await saveD();
      if(typeof bscSeedPdfsIfNeeded==='function')bscSeedPdfsIfNeeded();
    }else{
      dDefaults();
      saveDCache();
      if(typeof bscSeedPdfsIfNeeded==='function')bscSeedPdfsIfNeeded();
    }
  }catch(e){
    console.warn('Firestore loadD error:', e.message);
    dDefaults();
    if(_firebaseConfirmed){
      toast('Could not reach the server, showing cached data. Changes will sync when reconnected.', 'error', 6000);
    }
  }
}

// ── REAL-TIME LISTENER ──
// Idempotent and returns a Promise for its first snapshot (resolves with whether the collection
// came back empty, rejects on a first-snapshot error) — loadD() calls this to populate D instead
// of doing its own separate getDocs() (see comment there), and the subsequent call from auth.js
// just reuses the same listener/promise rather than re-subscribing.
let _realtimeSyncPromise = null;
function startRealtimeSync(){
  if(!_db || !_fbFns || !FS_ID) return Promise.resolve(true);
  if(_realtimeSyncPromise) return _realtimeSyncPromise;
  const { collection, onSnapshot } = _fbFns;

  _unsubs.forEach(u => u());
  _unsubs = [];

  let resolveFirst, rejectFirst, sawFirst = false;
  _realtimeSyncPromise = new Promise((res, rej) => { resolveFirst = res; rejectFirst = rej; });

  // Listen to the entire sub-collection — one snapshot per changed key doc.
  const unsub = onSnapshot(
    collection(_db, FS_PATH, FS_ID, FS_DATA),
    (snap) => {
      snap.forEach(docSnap => {
        const { value } = docSnap.data();
        if(value !== null && value !== undefined) D[docSnap.id] = value;
      });
      if(!sawFirst){
        // loadD() (the only caller that awaits this) owns dDefaults()/saveDCache()/seeding for
        // the initial population — this snapshot's job is just to fill D and hand back whether
        // the collection was empty, not to also trigger a page re-render before login has even
        // rendered anything yet.
        sawFirst = true;
        resolveFirst(snap.empty);
        return;
      }
      if(_saveInFlight) return;
      dDefaults();
      saveDCache();
      clearTimeout(_remoteRenderTimer);
      _remoteRenderTimer = setTimeout(() => {
        const activePage = document.querySelector('.page.active');
        if(activePage){
          const pid = activePage.id.replace('page-', '');
          if(R && R[pid]) R[pid]();
        }
        updateBadges();
      }, 500);
    },
    (err) => {
      console.warn('onSnapshot error:', err.message);
      if(!sawFirst){ sawFirst = true; rejectFirst(err); }
      if(_firebaseConfirmed){
        const banner = document.getElementById('sync-error-banner');
        if(banner) banner.style.display = 'flex';
      }
    }
  );
  _unsubs.push(unsub);
  return _realtimeSyncPromise;
}

// ══════════════════════════════════════════════
// FINANCE & JUDICIAL — dedicated collections, NOT part of FS_KEYS/FS_DATA above.
// ══════════════════════════════════════════════
// Both used to live inside chapters/{id}/data/{key} like everything else, read-gated only by
// chapter membership (any approved member could read the whole document via the SDK — see
// firestore.rules' comment on chapters/{chapterId}/data/{key} for why a narrower rule there
// broke production). Moved to their own collections so role-gating is a normal per-request
// rule, not a per-key rule inside a bulk collection query. Neither is fetched, listened to, or
// even requested at all for a user who fails the corresponding client-side access check below
// — matching firestore.rules exactly, so an unauthorized request never leaves the browser.

const FS_FINANCE_LEDGER_FIELDS = ['fines','payments','expenses','plans','nationalDues','nationalPayments','budget','deadlines'];
let _financeJudicialUnsubs = [];

function _financeFullAccess(){ return typeof isLeadUser==='function' && (isLeadUser() || canAccess('finance')); }
// Mirrors jbCanAccess() in js/judicial.js — kept here too since data.js loads before it in
// some contexts is not guaranteed; both must agree with firestore.rules' judicial read rule.
function _judicialCanAccess(){ return typeof isLeadUser==='function' && (isLeadUser() || canAccess('judicial')); }

async function loadFinanceData(){
  if(!_db || !_fbFns || !FS_ID) return;
  if(!_financeFullAccess() && !(typeof _myMemberRecord==='function' && _myMemberRecord())) return;
  const { doc, getDoc, collection, getDocs } = _fbFns;
  try{
    if(_financeFullAccess()){
      const ledgerSnap = await getDoc(doc(_db, FS_PATH, FS_ID, 'finance', 'ledger'));
      if(ledgerSnap.exists() && ledgerSnap.data().value) Object.assign(D.finance, ledgerSnap.data().value);
      const duesSnaps = await getDocs(collection(_db, FS_PATH, FS_ID, 'financeDues'));
      const dues = {};
      duesSnaps.forEach(s => { if(s.data().value) dues[s.id] = s.data().value; });
      D.finance.dues = dues;
    } else {
      // General member — own balance only, exactly what finRenderOwnOnly() needs, nothing else.
      const me = _myMemberRecord();
      if(!me) return;
      const mySnap = await getDoc(doc(_db, FS_PATH, FS_ID, 'financeDues', me.id));
      D.finance.dues = mySnap.exists() && mySnap.data().value ? { [me.id]: mySnap.data().value } : {};
    }
    saveDCache();
  }catch(e){
    console.warn('loadFinanceData error:', e.message);
  }
}

function startFinanceRealtimeSync(){
  if(!_db || !_fbFns || !FS_ID) return;
  if(!_financeFullAccess() && !(typeof _myMemberRecord==='function' && _myMemberRecord())) return;
  const { doc, onSnapshot, collection } = _fbFns;
  const rerender = () => {
    clearTimeout(_remoteRenderTimer);
    _remoteRenderTimer = setTimeout(() => {
      const activePage = document.querySelector('.page.active');
      if(activePage){ const pid = activePage.id.replace('page-', ''); if(R && R[pid]) R[pid](); }
    }, 500);
  };
  _financeJudicialUnsubs.push(onSnapshot(doc(_db, FS_PATH, FS_ID, 'finance', 'ledger'), snap => {
    if(_saveInFlight) return;
    if(snap.exists() && snap.data().value) Object.assign(D.finance, snap.data().value);
    saveDCache(); rerender();
  }, err => console.warn('finance ledger onSnapshot error:', err.message)));

  if(_financeFullAccess()){
    _financeJudicialUnsubs.push(onSnapshot(collection(_db, FS_PATH, FS_ID, 'financeDues'), snap => {
      if(_saveInFlight) return;
      const dues = {};
      snap.forEach(s => { if(s.data().value) dues[s.id] = s.data().value; });
      D.finance.dues = dues;
      saveDCache(); rerender();
    }, err => console.warn('financeDues onSnapshot error:', err.message)));
  } else {
    const me = _myMemberRecord();
    if(me) _financeJudicialUnsubs.push(onSnapshot(doc(_db, FS_PATH, FS_ID, 'financeDues', me.id), snap => {
      if(_saveInFlight) return;
      D.finance.dues = snap.exists() && snap.data().value ? { [me.id]: snap.data().value } : {};
      saveDCache(); rerender();
    }, err => console.warn('financeDues (own) onSnapshot error:', err.message)));
  }
}

// Writes D.finance minus .dues (the shared ledger — fines/payments/expenses/plans/national
// dues/budget). Called after any mutation to those fields; NOT called for dues changes, which
// go through saveFinanceDues()/saveFinanceDuesMany() below instead.
async function saveFinanceLedger(){
  saveDCache();
  if(!_db || !_fbFns || !FS_ID) return;
  const { doc, setDoc } = _fbFns;
  const value = {};
  FS_FINANCE_LEDGER_FIELDS.forEach(k => { if(D.finance[k]!==undefined) value[k] = D.finance[k]; });
  const uid = (typeof CURRENT_USER!=='undefined' && CURRENT_USER?.uid) || null;
  await setDoc(doc(_db, FS_PATH, FS_ID, 'finance', 'ledger'), { value, updatedAt: Date.now(), updatedBy: uid });
}
// One member's dues record only — used for a single payment/fine/plan change.
async function saveFinanceDues(memberId){
  saveDCache();
  if(!_db || !_fbFns || !FS_ID || !memberId) return;
  const { doc, setDoc } = _fbFns;
  const uid = (typeof CURRENT_USER!=='undefined' && CURRENT_USER?.uid) || null;
  await setDoc(doc(_db, FS_PATH, FS_ID, 'financeDues', memberId), { value: D.finance.dues[memberId]||null, updatedAt: Date.now(), updatedBy: uid });
}
// Bulk dues write (e.g. finApplyDuesToAll touching every member at once) — one batch.
async function saveFinanceDuesMany(memberIds){
  saveDCache();
  if(!_db || !_fbFns || !FS_ID || !memberIds.length) return;
  const { doc, writeBatch } = _fbFns;
  const uid = (typeof CURRENT_USER!=='undefined' && CURRENT_USER?.uid) || null;
  const batch = writeBatch(_db);
  const now = Date.now();
  memberIds.forEach(id => {
    batch.set(doc(_db, FS_PATH, FS_ID, 'financeDues', id), { value: D.finance.dues[id]||null, updatedAt: now, updatedBy: uid });
  });
  await batch.commit();
}
// Removes a member's dues doc entirely (member deleted from the roster) — distinct from
// saveFinanceDues(), which would just write a null value and leave an empty doc behind.
async function deleteFinanceDuesDoc(memberId){
  saveDCache();
  if(!_db || !_fbFns || !FS_ID || !memberId) return;
  const { doc, deleteDoc } = _fbFns;
  await deleteDoc(doc(_db, FS_PATH, FS_ID, 'financeDues', memberId));
}

async function loadJudicialCases(){
  if(!_db || !_fbFns || !FS_ID || !_judicialCanAccess()) return;
  const { collection, getDocs } = _fbFns;
  try{
    const snaps = await getDocs(collection(_db, FS_PATH, FS_ID, 'judicialCases'));
    D.cases = [];
    snaps.forEach(s => { if(s.data().value) D.cases.push({ ...s.data().value, id: s.id }); });
    saveDCache();
  }catch(e){
    console.warn('loadJudicialCases error:', e.message);
  }
}
function startJudicialRealtimeSync(){
  if(!_db || !_fbFns || !FS_ID || !_judicialCanAccess()) return;
  const { collection, onSnapshot } = _fbFns;
  _financeJudicialUnsubs.push(onSnapshot(collection(_db, FS_PATH, FS_ID, 'judicialCases'), snap => {
    if(_saveInFlight) return;
    const cases = [];
    snap.forEach(s => { if(s.data().value) cases.push({ ...s.data().value, id: s.id }); });
    D.cases = cases;
    saveDCache();
    clearTimeout(_remoteRenderTimer);
    _remoteRenderTimer = setTimeout(() => { if(typeof renderJudicial==='function') renderJudicial(); updateBadges(); }, 500);
  }, err => console.warn('judicialCases onSnapshot error:', err.message)));
}
// Create or update one case — caseObj must already have an .id (uid() at creation time).
async function saveJudicialCase(caseObj){
  saveDCache();
  if(!_db || !_fbFns || !FS_ID || !caseObj?.id) return;
  const { doc, setDoc } = _fbFns;
  const { id, ...value } = caseObj;
  const uid = (typeof CURRENT_USER!=='undefined' && CURRENT_USER?.uid) || null;
  await setDoc(doc(_db, FS_PATH, FS_ID, 'judicialCases', id), { value, updatedAt: Date.now(), updatedBy: uid });
}
async function deleteJudicialCaseDoc(caseId){
  saveDCache();
  if(!_db || !_fbFns || !FS_ID || !caseId) return;
  const { doc, deleteDoc } = _fbFns;
  await deleteDoc(doc(_db, FS_PATH, FS_ID, 'judicialCases', caseId));
}

// Wire up Firebase once module fires its ready event
document.addEventListener('firebase-ready', () => {
  _db    = window._fbDb;
  _fbFns = window._fbFns;
});

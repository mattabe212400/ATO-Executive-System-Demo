// ── UNIVERSAL FORM DRAFT AUTOSAVE ──
// Every .mo modal that's a data-entry form gets its in-progress input snapshotted to
// localStorage on each keystroke (debounced) and offered back the next time that same form is
// opened. Stops a half-finished entry from being lost to an accidental backdrop click, an
// Escape press, a tab close, or a browser crash. Pairs with the global .mo.open[data-dirty]
// tab-close guard in helpers.js. No Firestore writes — pure localStorage, same spirit as
// saveDCache() in data.js.
//
// How the pieces fit:
//   • autosave      — piggybacks the app-wide input/change stream, debounced, keyed per modal
//                      (+ the values of that modal's hidden id field(s), so editing record A
//                      and editing record B keep separate drafts)
//   • restore       — a MutationObserver watches for any modal gaining `.open`; if a fresh,
//                      differing draft exists it asks (standard confirmDialog) before filling
//   • clear-on-save — wraps saveD(): once a form's data has been committed to D, its draft is
//                      dropped and the modal is marked clean so the close-flush won't rebuild it
//   • close-flush   — on any close path, flush the pending debounce so the last keystrokes land
//   • sweep         — stale drafts (> TTL) are purged on load
(function(){
  const PREFIX='ato-draft:';
  const TTL=7*24*60*60*1000;   // a week
  const DEBOUNCE=450;

  // Modals that must NOT get a draft: passwords, file-import / bulk / multi-step wizards, the
  // house-life score grid (its own semester-driven re-render), and view-only / temp-state
  // dialogs that aren't really forms.
  const DENY=new Set([
    'm-changepass',
    'm-import','m-simport','m-bs-bulk','m-updategpa',
    'm-hl-scoreedit',
    'm-fin-bulk-payment',
    'm-truemerit','m-sa-officer',
    'm-notedetail','m-checkin-history','m-tr-list','m-viewatt','m-att-fines','m-markatt',
  ]);

  const FIELD_SEL='input:not([type=hidden]):not([type=file]):not([type=password]):not([type=button]):not([type=submit]):not([type=reset]), textarea, select';
  let saveTimer=null;

  function eligible(modal){
    return !!modal && modal.nodeType===1 && modal.classList.contains('mo') && modal.id && !DENY.has(modal.id);
  }

  // All form controls with an id, visible or not — a modal that's mid-close is display:none but
  // its fields still hold the user's text, and we want the close-flush to capture them.
  function fields(modal){
    return [...modal.querySelectorAll(FIELD_SEL)].filter(el=>el.id);
  }

  function keyFor(modal){
    const rec=[...modal.querySelectorAll('input[type=hidden]')]
      .filter(h=>h.id)
      .sort((a,b)=>a.id.localeCompare(b.id))
      .map(h=>h.value)
      .filter(Boolean)
      .join('|');
    return PREFIX+modal.id+':'+(rec||'new');
  }

  function snapshot(modal){
    const data={};
    fields(modal).forEach(el=>{
      if(el.type==='checkbox'||el.type==='radio') data[el.id]={c:el.checked};
      else data[el.id]=el.value;
    });
    return data;
  }

  // "The user actually typed something" — only free-text fields count. Selects, checkboxes,
  // and pre-filled date/time/number pickers all carry defaults and would otherwise flag every
  // freshly opened form as a draft worth restoring.
  const TYPED_INPUT=new Set(['text','search','url','email','tel','number']);
  function typedSomething(modal){
    return fields(modal).some(el=>{
      if(el.tagName==='TEXTAREA') return el.value.trim().length>0;
      if(el.tagName==='INPUT' && TYPED_INPUT.has(el.type)) return el.value.trim().length>0;
      return false;
    });
  }
  // Cheap sanity gate for a payload coming back out of storage (we only ever wrote one when
  // typedSomething() was true, so any non-empty string in it is real typed content).
  function looksReal(data){
    return !!data && Object.values(data).some(v=>typeof v==='string' && v.trim().length>0);
  }

  function readDraft(key){
    try{ return JSON.parse(localStorage.getItem(key)||'null'); }catch(e){ return null; }
  }
  function drop(key){ try{ localStorage.removeItem(key); }catch(e){} }

  function write(modal){
    if(modal.dataset.draftSaved) return;   // data already committed this session
    try{
      const key=keyFor(modal);
      if(typedSomething(modal)) localStorage.setItem(key,JSON.stringify({t:Date.now(),v:snapshot(modal)}));
      else drop(key);
    }catch(e){}
  }

  function apply(modal,data){
    // Selects first, each with a change event, so any dependent UI (conditional sections, a
    // dynamic sub-form like the meeting-note officer list, member auto-fill) rebuilds before we
    // pour the saved values back in.
    Object.keys(data).forEach(id=>{
      const el=document.getElementById(id);
      if(!el||el.tagName!=='SELECT') return;
      if([...el.options].some(o=>o.value===data[id])){
        el.value=data[id];
        el.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    Object.keys(data).forEach(id=>{
      const el=document.getElementById(id);
      if(!el) return;
      const val=data[id];
      if(el.type==='checkbox'||el.type==='radio'){
        if(val&&typeof val==='object'){
          el.checked=!!val.c;
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
      }else if(el.tagName==='TEXTAREA'||el.tagName==='INPUT'){
        el.value=val;
      }
    });
    modal.dataset.dirty='1';
  }

  async function offerRestore(modal){
    const key=keyFor(modal);
    const saved=readDraft(key);
    if(!saved||!looksReal(saved.v)) return;
    if(Date.now()-(saved.t||0)>TTL){ drop(key); return; }
    // Draft already matches what's in the form (e.g. reopening an edit right after saving it).
    if(JSON.stringify(snapshot(modal))===JSON.stringify(saved.v)){ drop(key); return; }
    const when=new Date(saved.t).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    const ok=await confirmDialog('Restore unsaved draft?','You have unsaved changes in this form from '+when+'. Restore what you had typed?','Restore',false);
    if(ok){
      if(modal.classList.contains('open')){ apply(modal,saved.v); toast('Draft restored','success'); }
    }else{
      drop(key);
    }
  }

  // ── autosave: ride the app-wide input/change stream ──
  function onEdit(e){
    const modal=e.target.closest?e.target.closest('.mo.open'):null;
    if(!eligible(modal)) return;
    delete modal.dataset.draftSaved;   // a real edit after a save re-arms drafting
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>write(modal),DEBOUNCE);
  }
  document.addEventListener('input',onEdit,true);
  document.addEventListener('change',onEdit,true);

  // ── restore on open / flush on close ──
  new MutationObserver(muts=>{
    muts.forEach(m=>{
      if(m.attributeName!=='class') return;
      const el=m.target;
      if(!el.classList||!el.classList.contains('mo')) return;
      const isOpen=el.classList.contains('open');
      const wasOpen=m.oldValue?m.oldValue.split(/\s+/).indexOf('open')!==-1:false;
      if(isOpen&&!wasOpen&&eligible(el)){
        clearTimeout(saveTimer);
        setTimeout(()=>{ if(el.classList.contains('open')) offerRestore(el); },0);
      }else if(!isOpen&&wasOpen&&eligible(el)){
        clearTimeout(saveTimer);
        if(!el.dataset.draftSaved) write(el);
        delete el.dataset.draftSaved;
      }
    });
  }).observe(document.body,{attributes:true,attributeFilter:['class'],attributeOldValue:true,subtree:true});

  // ── clear a form's draft the moment its data is committed ──
  if(typeof window.saveD==='function'){
    const orig=window.saveD;
    window.saveD=function(){
      try{
        document.querySelectorAll('.mo.open').forEach(m=>{
          if(!eligible(m)) return;
          drop(keyFor(m));
          m.dataset.draftSaved='1';
        });
      }catch(e){}
      return orig.apply(this,arguments);
    };
  }

  // ── sweep stale drafts on load ──
  try{
    for(let i=localStorage.length-1;i>=0;i--){
      const k=localStorage.key(i);
      if(!k||!k.startsWith(PREFIX)) continue;
      const d=readDraft(k);
      if(!d||Date.now()-(d.t||0)>TTL) drop(k);
    }
  }catch(e){}
})();

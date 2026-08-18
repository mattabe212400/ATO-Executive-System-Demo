// ══════════════════════════════════════════════
// Loads the demo app's plain <script>-tag files into one shared vm context, the same way
// index.html loads them into one shared browser global scope — these files aren't CommonJS
// modules (only js/recruitmentCalc.js and js/auth.js additionally export via module.exports for
// direct require()), so testing app behavior that spans files (like switchDemoRole() updating
// state that dashboard.js's renderDash() then reads) requires the real multi-file global-scope
// execution model, not one-file-at-a-time require().
//
// A hand-rolled stub DOM (no jsdom dependency — this repo has zero npm dependencies today and
// this keeps it that way) is permissive by design: every element already present in index.html's
// static markup (scraped once, see KNOWN_IDS below) auto-vivifies into a mutable stub on first
// access, so a test can read back exactly what a render wrote into it (e.g.
// document.getElementById('u-name').textContent after a role switch). Elements NOT in that set —
// i.e. anything created at runtime, like the guided tour's card — start out absent (getElementById
// returns null) until actually created via createElement()+appendChild(), same as a real browser.
// ══════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.resolve(__dirname, '..', '..', 'js');
const INDEX_HTML = path.resolve(__dirname, '..', '..', 'index.html');

// Script order copied from index.html's <script src="js/..."> tags — order matters here exactly
// as much as it does in the browser (e.g. recruitmentCalc.js's RC_STAGES must exist before
// recruitment.js runs, auth.js's DEFAULT_POSITIONS before demo.js's init() call).
const SCRIPT_ORDER = [
  'data.js','recruitmentCalc.js','helpers.js','members.js','events.js','notes.js',
  'dashboard.js','analytics.js','calendar.js',
  'judicial.js','committees.js','attendance.js','files.js','academics.js','recruitment.js',
  'finance.js','philanthropy.js','communityservice.js','alumni.js','ritual.js',
  'biblestudy.js','newmembereducation.js','social.js',
  'healthscore.js','kcrew.js','sober.js','houselife.js',
  'search.js','reports.js','import.js','truemerit.js','auth.js',
  'demo.js','demoTour.js',
];

function scrapeKnownIds() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const ids = new Set();
  for (const m of html.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

function makeStubElement(id, registry) {
  let innerHTMLValue = '';
  const el = {
    id, textContent: '', value: '', className: '', selectedIndex: 0,
    disabled: false, checked: false, children: [], childNodes: [],
    // A real setInnerHTML parses markup into live child nodes queryable via getElementById;
    // this stub can't parse HTML, but the app only ever needs id-addressability of whatever it
    // just wrote — so on write, scan for id="..." occurrences and register a stub per id (if not
    // already registered) into the same registry getElementById reads from. Good enough for code
    // that writes `<button id="x">` via a template string and immediately does
    // `document.getElementById('x').onclick = ...` (e.g. js/demoTour.js's dtRender()).
    get innerHTML() { return innerHTMLValue; },
    set innerHTML(html) {
      innerHTMLValue = html;
      if (registry && typeof html === 'string') {
        for (const m of html.matchAll(/\bid="([^"]+)"/g)) {
          if (!registry.has(m[1])) registry.set(m[1], makeStubElement(m[1], registry));
        }
      }
    },
    // Backed by a real object (not a discard-everything stub) so tests can actually assert on
    // style.display etc. after a render — e.g. "is this card hidden for a General Member."
    style: new Proxy({}, { get: (t, p) => (p in t ? t[p] : ''), set: (t, p, v) => { t[p] = v; return true; } }),
    classList: (() => {
      const classes = new Set();
      return {
        add(...c){ c.forEach(x => classes.add(x)); },
        remove(...c){ c.forEach(x => classes.delete(x)); },
        toggle(c, force){ const has = classes.has(c); const want = force === undefined ? !has : force; want ? classes.add(c) : classes.delete(c); return want; },
        contains(c){ return classes.has(c); },
      };
    })(),
    dataset: {},
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){}, hasAttribute(){ return false; },
    addEventListener(){}, removeEventListener(){},
    appendChild(child){ if (registry && child && child.id) registry.set(child.id, child); },
    insertAdjacentElement(_pos, child){ if (registry && child && child.id) registry.set(child.id, child); return child; },
    insertAdjacentHTML(){},
    remove(){ if (registry && this.id) registry.delete(this.id); },
    // Memoized per element (not a fresh stub every call) so code that does
    // `el.closest('.card').style.display='none'` and a test that later reads
    // `el.closest('.card').style.display` see the same object — there's no real DOM tree here to
    // walk, so this is a deliberate simplification: one "closest ancestor" stand-in per element,
    // regardless of the selector passed in.
    closest(){ if (!this._closestStub) this._closestStub = makeStubElement('__closest_of_' + id, registry); return this._closestStub; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    focus(){}, blur(){}, click(){}, scrollIntoView(){}, reset(){},
    contains(){ return false; },
  };
  return el;
}

function makeStubDocument(knownIds) {
  const byId = new Map();
  const doc = {
    title: '',
    body: makeStubElement('body', byId),
    documentElement: makeStubElement('html', byId),
    getElementById(id) {
      if (byId.has(id)) return byId.get(id);
      if (knownIds.has(id)) { const el = makeStubElement(id, byId); byId.set(id, el); return el; }
      return null; // matches real getElementById: an id absent from the document returns null
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return makeStubElement('__created_' + tag + '_' + Math.random().toString(36).slice(2), byId); },
    addEventListener(){}, removeEventListener(){},
    activeElement: makeStubElement('__active', byId),
  };
  return doc;
}

function makeStubLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

/** Boots a fresh demo environment (one vm context, all app scripts executed in load order) and
 * returns the sandbox — sandbox.CURRENT_USER, sandbox.D, sandbox.switchDemoRole(...), etc. are
 * all directly accessible, exactly like they would be as page globals in the browser. */
function loadDemoEnv() {
  // unref()'d timers — demo.js's resetInactivityTimer() schedules a real 4-hour setTimeout
  // during init() (TIMEOUT_MS in js/auth.js); without unref() that pending timer keeps the Node
  // process (and any test run) alive until it actually fires, hours later.
  const unrefSetTimeout = (fn, ms, ...args) => { const t = setTimeout(fn, ms, ...args); if (t.unref) t.unref(); return t; };
  const unrefSetInterval = (fn, ms, ...args) => { const t = setInterval(fn, ms, ...args); if (t.unref) t.unref(); return t; };
  const sandbox = {
    console,
    setTimeout: unrefSetTimeout, clearTimeout, setInterval: unrefSetInterval, clearInterval,
    navigator: { onLine: true },
    localStorage: makeStubLocalStorage(),
    location: { reload(){} },
    MutationObserver: class { observe(){} disconnect(){} },
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
    requestAnimationFrame(fn){ return unrefSetTimeout(fn, 0); }, cancelAnimationFrame(){},
  };
  sandbox.window = sandbox;
  sandbox.document = makeStubDocument(scrapeKnownIds());
  vm.createContext(sandbox);

  for (const file of SCRIPT_ORDER) {
    const src = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    vm.runInContext(src, sandbox, { filename: file });
  }

  // Bridge: `let`/`const` top-level bindings (CURRENT_USER, CURRENT_CHAPTER, D — declared with
  // `let` in js/auth.js and js/data.js) live in the vm context's lexical scope, not as properties
  // of the global object, so they're invisible to the host process as sandbox.X even though
  // plain `function` declarations (switchDemoRole, renderDash, etc.) ARE visible that way. This
  // copies them onto the sandbox object once, after init() has already run, so tests can read
  // (and, since switchDemoRole mutates CURRENT_USER's fields in place rather than reassigning it,
  // continue reading) them via env.CURRENT_USER etc.
  vm.runInContext('this.CURRENT_USER=CURRENT_USER; this.CURRENT_CHAPTER=CURRENT_CHAPTER; this.D=D;', sandbox);

  return sandbox;
}

module.exports = { loadDemoEnv, makeStubElement };

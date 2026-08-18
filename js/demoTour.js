// ══════════════════════════════════════════════
// DEMO GUIDED TOUR — demo-only, dismissible walkthrough of the app's main surfaces. Not part of
// the real ATO Executive System. Dismissal state lives in localStorage (demo-only, no existing
// preference system to reuse here) so it doesn't nag a visitor who already dismissed it, but a
// "Take the tour" link stays available in the demo banner so it's never permanently unreachable.
// Every step either navigates via the same rbacNav()/switchDemoRole() functions a visitor would
// click themselves, or points at a real on-screen control — no fake/simulated functionality.
// ══════════════════════════════════════════════

const DEMO_TOUR_DISMISS_KEY = 'ato_demo_tour_dismissed';

const DEMO_TOUR_STEPS = [
  {
    title: 'Executive Dashboard',
    body: 'This is what a chapter President or Vice President sees first: Chapter Health Score, active alerts, upcoming events, and overdue tasks, all in one view of what needs attention.',
    onEnter: () => { if (typeof rbacNav === 'function') rbacNav('dashboard', null); },
  },
  {
    title: 'Role Switcher',
    body: 'Use the switcher in the banner above to explore what each chapter position can see and do. Every role change here reflects the real permission system this app runs on, not a simplified stand-in.',
    highlight: 'demo-role-switcher',
  },
  {
    title: 'Recruitment CRM',
    body: 'Track prospects through a bid pipeline, from first contact to accepted, with pipeline analytics and a season goal that updates as prospects move through it.',
    onEnter: () => { if (typeof rbacNav === 'function') rbacNav('recruitment', null); },
  },
  {
    title: 'Attendance Tracking',
    body: 'Mark attendance for chapter events and see it roll up automatically into member standing, chapter-wide trends, and risk flags for officers to follow up on.',
    onEnter: () => { if (typeof rbacNav === 'function') rbacNav('attendance', null); },
  },
  {
    title: 'Role-Based Access',
    body: 'Every page and action is gated by the position holding it, not just what the sidebar happens to show. See it from a General Member\'s side:',
    action: { label: 'View as General Member', fn: () => { if (typeof switchDemoRole === 'function') switchDemoRole('General Member'); } },
  },
];

let _dtIdx = 0;
let _dtHighlightEl = null;

function dtDismissedBefore() {
  try { return localStorage.getItem(DEMO_TOUR_DISMISS_KEY) === '1'; } catch (e) { return false; }
}
function dtMarkDismissed() {
  try { localStorage.setItem(DEMO_TOUR_DISMISS_KEY, '1'); } catch (e) { /* ignore, e.g. private browsing */ }
}

function dtClearHighlight() {
  if (_dtHighlightEl) { _dtHighlightEl.classList.remove('demo-tour-highlight'); _dtHighlightEl = null; }
}

function dtRender() {
  const card = document.getElementById('dt-card');
  if (!card) return;
  const step = DEMO_TOUR_STEPS[_dtIdx];
  const isLast = _dtIdx === DEMO_TOUR_STEPS.length - 1;

  dtClearHighlight();
  if (step.highlight) {
    const t = document.getElementById(step.highlight);
    if (t) { t.classList.add('demo-tour-highlight'); _dtHighlightEl = t; }
  }
  if (step.onEnter) step.onEnter();

  card.innerHTML = `
    <div class="dt-step">Step ${_dtIdx + 1} of ${DEMO_TOUR_STEPS.length}</div>
    <div class="dt-title">${step.title}</div>
    <div class="dt-body">${step.body}</div>
    ${step.action ? `<button class="btn btn-p" style="width:100%;justify-content:center;margin-bottom:10px" id="dt-action-btn">${step.action.label}</button>` : ''}
    <div class="dt-actions">
      <div class="dt-dots" aria-hidden="true">${DEMO_TOUR_STEPS.map((s, i) => `<span class="dt-dot${i === _dtIdx ? ' active' : ''}"></span>`).join('')}</div>
      <div class="dt-btns">
        <button class="btn" id="dt-skip-btn" style="height:28px;font-size:11px">Skip tour</button>
        ${_dtIdx > 0 ? `<button class="btn" id="dt-back-btn" style="height:28px;font-size:11px">Back</button>` : ''}
        <button class="btn btn-p" id="dt-next-btn" style="height:28px;font-size:11px">${isLast ? 'Finish' : 'Next'}</button>
      </div>
    </div>`;

  document.getElementById('dt-skip-btn').onclick = dtEnd;
  const backBtn = document.getElementById('dt-back-btn');
  if (backBtn) backBtn.onclick = () => { _dtIdx--; dtRender(); };
  document.getElementById('dt-next-btn').onclick = () => { isLast ? dtEnd() : (_dtIdx++, dtRender()); };
  const actionBtn = document.getElementById('dt-action-btn');
  if (actionBtn) actionBtn.onclick = () => { step.action.fn(); };

  // Move focus into the card so screen readers announce the new step, and keyboard users land
  // somewhere sensible without the tour trapping focus (it's a non-modal aid, not a dialog — a
  // visitor can still Tab out to the rest of the page at any point).
  card.querySelector('.dt-title')?.setAttribute('tabindex', '-1');
  card.querySelector('.dt-title')?.focus();
}

function dtStart() {
  if (document.getElementById('dt-card')) return;
  _dtIdx = 0;
  const card = document.createElement('div');
  card.id = 'dt-card';
  card.className = 'dt-card';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'Guided tour');
  card.setAttribute('aria-live', 'polite');
  document.body.appendChild(card);
  document.addEventListener('keydown', dtOnKeydown);
  dtRender();
}

function dtEnd() {
  dtClearHighlight();
  dtMarkDismissed();
  const card = document.getElementById('dt-card');
  if (card) card.remove();
  document.removeEventListener('keydown', dtOnKeydown);
}

function dtOnKeydown(e) {
  if (e.key === 'Escape') dtEnd();
}

// Auto-start once, a moment after the demo finishes loading so the Dashboard is already visible
// underneath — never re-shows itself once dismissed (dtDismissedBefore), matching "don't reappear
// continuously." The "Take the tour" link in the demo banner (index.html) calls dtStart()
// directly, so the tour stays reachable on request even after dismissal.
window.addEventListener('load', () => {
  if (dtDismissedBefore()) return;
  setTimeout(() => { if (!dtDismissedBefore()) dtStart(); }, 1400);
});

// ══════════════════════════════════════════════
// END-OF-DEMO CTA — dismissible card near the bottom of the Dashboard (see the
// #demo-cta-card markup in index.html). Demo-only, localStorage-persisted dismissal, same
// "don't nag" rule as the guided tour above.
// ══════════════════════════════════════════════
const DEMO_CTA_DISMISS_KEY = 'ato_demo_cta_dismissed';
function dtCtaDismissedBefore() {
  try { return localStorage.getItem(DEMO_CTA_DISMISS_KEY) === '1'; } catch (e) { return false; }
}
function dtCtaInit() {
  const card = document.getElementById('demo-cta-card');
  if (!card || dtCtaDismissedBefore()) return;
  card.style.display = '';
  const dismissBtn = document.getElementById('demo-cta-dismiss');
  if (dismissBtn && !dismissBtn._wired) {
    dismissBtn._wired = true;
    dismissBtn.onclick = () => {
      try { localStorage.setItem(DEMO_CTA_DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
      card.style.display = 'none';
    };
  }
}

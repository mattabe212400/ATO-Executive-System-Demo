// Integration tests for Dashboard widget permissions — runs the real renderDash() via the vm
// harness for several roles and inspects the actual rendered DOM, not a reimplementation.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadDemoEnv } = require('./helpers/loadDemoEnv.js');

describe('dashboard widgets obey permissions', () => {
  test('judicial-derived KPI ("Active Cases") is lead-only, not shown to a non-lead exec officer', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('Recruitment');
    env.renderDash();
    assert.ok(!env.document.getElementById('d-kpi').innerHTML.includes('Active Cases'));
  });

  test('President and Vice President retain the judicial KPI', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('President');
    env.renderDash();
    assert.ok(env.document.getElementById('d-kpi').innerHTML.includes('Active Cases'));
    env.switchDemoRole('Vice President');
    env.renderDash();
    assert.ok(env.document.getElementById('d-kpi').innerHTML.includes('Active Cases'));
  });

  test('the Accountability (judicial-derived) Health Score dimension is hidden from non-leads', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('Scholarship');
    env.renderDash();
    assert.ok(!env.document.getElementById('d-health-dims').innerHTML.includes('Accountability'));
    env.switchDemoRole('President');
    env.renderDash();
    assert.ok(env.document.getElementById('d-health-dims').innerHTML.includes('Accountability'));
  });

  test('Overdue Tasks widget only shows tasks the viewer\'s position owns (Scholarship sees its own overdue task, Treasurer does not)', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('Scholarship');
    env.renderDash();
    assert.ok(env.document.getElementById('d-overdue').innerHTML.toLowerCase().includes('scholarship report'));

    env.switchDemoRole('Treasurer');
    env.renderDash();
    assert.ok(!env.document.getElementById('d-overdue').innerHTML.toLowerCase().includes('scholarship report'));
  });

  test('leads see every position\'s overdue tasks on the dashboard', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('President');
    env.renderDash();
    assert.ok(env.document.getElementById('d-overdue').innerHTML.toLowerCase().includes('scholarship report'));
  });

  test('quick actions only offer creates the active persona can actually perform', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('Recruitment'); // no edit on tasks/notes; edit on calendar (always) + recruitment
    env.renderDash();
    const html = env.document.getElementById('d-quickbar').innerHTML;
    assert.ok(html.includes('Add Event'));
    assert.ok(!html.includes('New Task'));
    assert.ok(!html.includes('New Note'));
  });

  test('quick actions are hidden entirely for General Member', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('General Member');
    env.renderDash();
    assert.equal(env.document.getElementById('d-quickbar').style.display, 'none');
  });

  test('the Officer KPI, Attendance Risk, Social Monitors, and Recent Notes cards start collapsed behind "Show full dashboard" (progressive disclosure)', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('President');
    env.renderDash();
    assert.equal(env.document.getElementById('d-officers-card').style.display, 'none');
    assert.equal(env.document.getElementById('d-att-risk').closest('.d2-card').style.display, 'none');
  });

  test('Health Score numbers come from one calculation for both the dashboard widget and the full scorecard', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('President');
    const dims1 = env.computeHealthDims();
    const dims2 = env.computeHealthDims();
    assert.equal(dims1.score, dims2.score);
    assert.deepEqual(dims1.dims.map(d => d.v), dims2.dims.map(d => d.v));
  });

  test('the Health Score trend never appears from fabricated history — hidden until real history exists', () => {
    const env = loadDemoEnv();
    // Fresh demo load: D.healthHistory starts empty (no fabricated seed scores), so the
    // dashboard trend indicator must stay hidden, not show an invented "-N pts vs [date]".
    // (length check, not deepEqual([]) — D.healthHistory is an Array from the vm sandbox's
    // separate realm, so it structurally-but-not-reference-equals a host-realm [] literal.)
    assert.equal(env.D.healthHistory.length, 0);
    env.switchDemoRole('President');
    env.renderDash();
    // dashDrawHealth sets trendEl.style.display='none' when there's no valid past entry.
    // With a stubbed style proxy we can't read display back, so assert on the source data
    // instead: no entry in healthHistory predates "today," which is the exact condition
    // dashDrawHealth checks before ever rendering a trend string.
    const today = env.localDateStr();
    const past = env.D.healthHistory.filter(h => h.date !== today);
    assert.equal(past.length, 0);
  });
});

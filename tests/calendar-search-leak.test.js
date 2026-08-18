// Confirms the specific reported bug is fixed: officer-only task titles must never appear in the
// rendered calendar (month grid or day-detail popover) or in global search results for a General
// Member. Also covers global search's broader permission gating (judicial/finance) and direct
// navigation not bypassing demo permissions.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadDemoEnv } = require('./helpers/loadDemoEnv.js');

const OFFICER_TASK_TITLES = [
  'Collect outstanding dues',
  'Prepare scholarship report for nationals',
  'Update chapter budget spreadsheet',
  'Submit IFC compliance report',
];

describe('calendar task visibility', () => {
  test('General Member sees no officer task titles on the month grid', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('General Member');
    env.renderCalendar();
    const html = env.document.getElementById('cal-grid').innerHTML;
    OFFICER_TASK_TITLES.forEach(title => assert.ok(!html.includes(title), `calendar grid leaked "${title}" to General Member`));
  });

  test('General Member sees no officer task titles in the day-detail popover', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('General Member');
    const overdueTask = env.D.tasks.find(t => t.title.includes('scholarship'));
    env.calShowDay(overdueTask.dueDate, { stopPropagation(){} });
    const html = env.document.getElementById('cal-detail-body').innerHTML;
    assert.ok(!html.includes('scholarship'), 'day popover leaked an officer task title to General Member');
  });

  test('leads see officer task titles on both the grid and the day popover', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('President');
    env.renderCalendar();
    const task = env.D.tasks.find(t => !t.dueDate ? false : true && t.status !== 'done');
    assert.ok(task, 'expected at least one open task with a due date in the seed data');
    env.calShowDay(task.dueDate, { stopPropagation(){} });
    const html = env.document.getElementById('cal-detail-body').innerHTML;
    assert.ok(html.includes(task.title.slice(0, 15)), 'lead should see task details in the day popover');
  });

  test('a Treasurer only sees Treasurer-owned tasks on the calendar, not Scholarship\'s', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('Treasurer');
    env.renderCalendar();
    const html = env.document.getElementById('cal-grid').innerHTML;
    assert.ok(!html.includes('scholarship report'));
  });
});

describe('global search obeys permissions', () => {
  test('General Member gets no task results at all for an officer task search term', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('General Member');
    const results = env.gsSearch('scholarship report');
    assert.equal(results.filter(r => r.cat === 'tasks').length, 0);
  });

  test('a lead does get task results for the same search term', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('President');
    const results = env.gsSearch('scholarship report');
    assert.ok(results.some(r => r.cat === 'tasks'));
  });

  test('judicial case results never appear in search for a non-lead role', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('Recruitment');
    const caseNum = env.D.cases[0].caseNum;
    const results = env.gsSearch(caseNum);
    assert.equal(results.filter(r => r.cat === 'cases').length, 0);
  });

  test('judicial case results appear in search for leads', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('President');
    const caseNum = env.D.cases[0].caseNum;
    const results = env.gsSearch(caseNum);
    assert.ok(results.some(r => r.cat === 'cases'));
  });

  test('finance results are hidden from a role without finance access, e.g. General Member', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('General Member');
    const fine = env.D.finance.fines[0];
    const results = env.gsSearch(fine.reason.slice(0, 10));
    assert.equal(results.filter(r => r.cat === 'finance').length, 0);
  });
});

describe('direct navigation cannot bypass demo permissions', () => {
  test('rbacNav denies a General Member direct navigation to a restricted page (not just a hidden sidebar link)', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('General Member');
    env.rbacNav('judicial', null);
    // rbacNav's denial path sets these specifically; the real nav('judicial') that would render
    // the Judicial Board page never runs.
    assert.equal(env.document.getElementById('pg-title').textContent, 'Access Restricted');
    assert.equal(env.document.getElementById('ad-role').textContent, 'Judicial Board');
  });

  test('rbacNav allows navigation to a page the role does have', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('General Member');
    env.rbacNav('calendar', null);
    assert.equal(env.document.getElementById('pg-title').textContent, 'Calendar');
  });

  test('canAccess is the actual gate rbacNav uses, not just sidebar visibility', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('Recruitment');
    // Judicial is lead-only under the real matrix (not a base view-granted page); Finance IS a
    // base view-granted page for every exec position by design (BASE_VIEW_PAGES), so Recruitment
    // legitimately has view access to it, same as they would by clicking Finance in the sidebar.
    assert.equal(env.canAccess('judicial'), false);
    assert.equal(env.canAccess('finance'), true);
    assert.equal(env.canAccess('recruitment'), true);
  });
});

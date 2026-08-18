// Broad smoke test: renders every page's real render function for a lead role and a couple of
// restricted roles, confirming this round of fixes didn't break existing functionality anywhere
// else in the app. Not a correctness check of each page's content (covered by the more targeted
// test files) — just "does it throw."
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadDemoEnv } = require('./helpers/loadDemoEnv.js');

// Mirrors js/reports.js's page->render-function map (R). renderRecruitment is async.
const RENDER_FNS = {
  dashboard: 'renderDash', attendance: 'renderAttendance', finance: 'renderFinance',
  calendar: 'renderCalendar', tasks: 'renderTasks', notes: 'renderNotes',
  judicial: 'renderJudicial', sober: 'renderSober', members: 'renderMembers',
  recruitment: 'renderRecruitment', academics: 'renderAcademics', committees: 'renderCommittees',
  analytics: 'renderAnalytics', files: 'renderFiles', transition: 'renderTransition',
  settings: 'renderSettings', philanthropy: 'renderPhilanthropy',
  communityService: 'renderCommunityService', alumni: 'renderAlumni', ritual: 'renderRitual',
  newMemberEducation: 'renderNewMemberEducation', healthscore: 'renderHealthScore',
  reports: 'renderReports', kcrew: 'renderKcrew', social: 'renderSocial', houseLife: 'renderHouseLife',
};

async function renderEveryAccessiblePage(env, role) {
  env.switchDemoRole(role);
  const failures = [];
  for (const [page, fnName] of Object.entries(RENDER_FNS)) {
    if (!env.canAccess(page)) continue;
    try {
      const result = env[fnName]();
      if (result && typeof result.then === 'function') await result;
    } catch (e) {
      failures.push(`${page} (${fnName}): ${e.message}`);
    }
  }
  return failures;
}

describe('existing functionality remains operational', () => {
  test('every page a President can access renders without throwing', async () => {
    const env = loadDemoEnv();
    const failures = await renderEveryAccessiblePage(env, 'President');
    assert.deepEqual(failures, []);
  });

  test('every page a Recruitment officer can access renders without throwing', async () => {
    const env = loadDemoEnv();
    const failures = await renderEveryAccessiblePage(env, 'Recruitment');
    assert.deepEqual(failures, []);
  });

  test('every page a General Member can access renders without throwing', async () => {
    const env = loadDemoEnv();
    const failures = await renderEveryAccessiblePage(env, 'General Member');
    assert.deepEqual(failures, []);
  });

  test('the demo boots to a usable state (no console errors during init, CURRENT_USER/D populated)', () => {
    const env = loadDemoEnv();
    assert.ok(env.CURRENT_USER);
    assert.ok(env.D);
    assert.ok(Array.isArray(env.D.members) && env.D.members.length > 0);
    assert.ok(Array.isArray(env.D.recruitment.rushees) && env.D.recruitment.rushees.length > 0);
  });

  test('switching through every role in the demo selector does not throw', () => {
    const env = loadDemoEnv();
    const roles = ['President','Vice President','Treasurer','Secretary','Risk Manager','Recruitment','Scholarship','Philanthropy','Community Service','Alumni','House Manager','Membership Educator','Chaplain','Social','Public Relations','General Member'];
    roles.forEach(role => assert.doesNotThrow(() => env.switchDemoRole(role), `switching to ${role} threw`));
  });

  test('attendance seeding is deterministic across environment loads (no Math.random drift)', () => {
    const env1 = loadDemoEnv();
    const env2 = loadDemoEnv();
    const avg1 = Math.round(env1.D.members.reduce((s, m) => s + env1.aR(m.id), 0) / env1.D.members.length);
    const avg2 = Math.round(env2.D.members.reduce((s, m) => s + env2.aR(m.id), 0) / env2.D.members.length);
    assert.equal(avg1, avg2, 'chapter attendance average differed between two fresh loads — seeding is not deterministic');
  });
});

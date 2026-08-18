// Tests for js/auth.js's RBAC and task-visibility logic — direct require(), no DOM needed (see
// auth.js's module.exports guard + setCurrentUser/setCurrentChapter helpers for why this works).
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../js/auth.js');

function setRole(title, opts = {}) {
  auth.setCurrentChapter({ enabledModules: auth.ALL_PAGES, positions: auth.DEFAULT_POSITIONS });
  auth.setCurrentUser({ role: opts.role || (title === 'General Member' ? 'viewer' : 'exec'), title, secondaryTitle: opts.secondaryTitle || null, mid: opts.mid || 'm01' });
}

const TASKS = [
  { id: 't1', title: 'Collect outstanding dues (4 members)', positionTitle: 'Treasurer' },
  { id: 't2', title: 'Prepare scholarship report for nationals', positionTitle: 'Scholarship' },
  { id: 't3', title: 'Submit IFC compliance report', positionTitle: 'Vice President' },
  { id: 't4', title: 'Draft recruitment email sequence', positionTitle: 'Recruitment' },
];

describe('permission matrix', () => {
  test('President and Vice President retain full access', () => {
    setRole('President');
    assert.equal(auth.isLeadUser(), true);
    auth.ALL_PAGES.forEach(p => assert.equal(auth.canAccess(p), true, `President should access ${p}`));
    setRole('Vice President');
    assert.equal(auth.isLeadUser(), true);
  });

  test('judicial is lead-only, not a base view-granted page like Attendance/Finance', () => {
    setRole('Recruitment');
    assert.equal(auth.canAccess('judicial'), false);
    assert.equal(auth.canAccess('attendance'), true); // BASE_VIEW_PAGES grants this broadly, by design
  });

  test('General Member cannot access officer-only pages', () => {
    setRole('General Member');
    assert.equal(auth.canAccess('tasks'), false);
    assert.equal(auth.canAccess('finance'), false);
    assert.equal(auth.canAccess('judicial'), false);
    assert.equal(auth.canAccess('recruitment'), false);
    // But shared/personal pages remain visible.
    assert.equal(auth.canAccess('calendar'), true);
    assert.equal(auth.canAccess('members'), true);
  });

  test('canEditPage requires an edit grant, not just view access', () => {
    setRole('Treasurer');
    assert.equal(auth.canEditPage('finance'), true);
    assert.equal(auth.canEditPage('recruitment'), false); // Treasurer only has view on this
  });
});

describe('task visibility (visibleTasksFor)', () => {
  test('leads see every position\'s tasks', () => {
    setRole('President');
    const visible = auth.visibleTasksFor(TASKS);
    assert.equal(visible.length, TASKS.length);
  });

  test('a non-lead officer only sees their own position\'s tasks', () => {
    setRole('Recruitment', { mid: 'm05' });
    const visible = auth.visibleTasksFor(TASKS);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, 't4');
  });

  test('General Member sees no position-owned tasks at all', () => {
    setRole('General Member');
    const visible = auth.visibleTasksFor(TASKS);
    assert.equal(visible.length, 0);
    // Specifically: none of the officer-only task titles ever appear.
    const titles = visible.map(t => t.title);
    assert.ok(!titles.includes('Collect outstanding dues (4 members)'));
    assert.ok(!titles.includes('Prepare scholarship report for nationals'));
    assert.ok(!titles.includes('Submit IFC compliance report'));
  });

  test('an officer holding a secondary position sees both positions\' tasks', () => {
    setRole('Recruitment', { mid: 'm05', secondaryTitle: 'Treasurer' });
    const visible = auth.visibleTasksFor(TASKS);
    const ids = visible.map(t => t.id).sort();
    assert.deepEqual(ids, ['t1', 't4']);
  });

  test('a task with no positionTitle is invisible to non-leads (unassigned = lead-only, not a shared bucket)', () => {
    setRole('Treasurer', { mid: 'm03' });
    const visible = auth.visibleTasksFor([{ id: 'x', title: 'Orphaned task', positionTitle: null }]);
    assert.equal(visible.length, 0);
  });
});

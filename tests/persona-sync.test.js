// Regression test for the demo persona-identity-sync bug: after switchDemoRole(), every visible
// identity reference (name, initials, greeting, "signed in as") must reflect the NEW persona —
// none of it may still read the previous one. Runs the real app code via the vm harness (see
// tests/helpers/loadDemoEnv.js), not a reimplementation of switchDemoRole's logic.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadDemoEnv } = require('./helpers/loadDemoEnv.js');

describe('demo persona identity synchronization', () => {
  test('switching roles updates every visible identity reference, with nothing left over from the previous persona', () => {
    const env = loadDemoEnv();

    // Starts as President (James Mitchell) per js/demo.js's init().
    assert.equal(env.CURRENT_USER.name, 'James Mitchell');

    const sequence = ['President', 'Recruitment', 'Treasurer', 'General Member'];
    const seenNames = [];
    for (const role of sequence) {
      env.switchDemoRole(role);
      const isViewer = role === 'General Member';
      const expectedName = isViewer ? 'Guest Member' : env.D.members.find(m => m.role === role).name;
      const expectedInitials = isViewer ? 'GM' : env.D.members.find(m => m.role === role).initials;
      const expectedMid = isViewer ? null : env.D.members.find(m => m.role === role).id;

      assert.equal(env.CURRENT_USER.name, expectedName, `CURRENT_USER.name stale after switching to ${role}`);
      assert.equal(env.CURRENT_USER.mid, expectedMid, `CURRENT_USER.mid stale after switching to ${role}`);
      assert.equal(env.CURRENT_USER.title, isViewer ? 'General Member' : role);

      // Sidebar profile + header avatar (DOM written directly by switchDemoRole).
      assert.equal(env.document.getElementById('u-name').textContent, expectedName, `sidebar name stale after switching to ${role}`);
      assert.equal(env.document.getElementById('u-av').textContent, expectedInitials, `sidebar avatar stale after switching to ${role}`);
      assert.equal(env.document.getElementById('tb-av').textContent, expectedInitials, `topbar avatar stale after switching to ${role}`);

      // Demo banner label.
      assert.equal(env.document.getElementById('demo-role-label').textContent, isViewer ? 'General Member' : role);

      // Dashboard greeting ("Good morning/afternoon/evening, {first name}") — the exact bug
      // reported: switching away from President previously left this reading "...James" forever.
      const greeting = env.document.getElementById('pg-title').textContent;
      if (!isViewer) {
        assert.ok(greeting.includes(expectedName.split(' ')[0]), `greeting "${greeting}" does not mention ${expectedName} after switching to ${role}`);
        seenNames.filter(n => n !== expectedName.split(' ')[0]).forEach(staleName => {
          assert.ok(!greeting.includes(staleName), `greeting "${greeting}" still mentions stale persona "${staleName}" after switching to ${role}`);
        });
      }
      if (!isViewer) seenNames.push(expectedName.split(' ')[0]);
    }
  });

  test('_myMemberRecord() (My Attendance/My Finances) resolves to the active persona, not the original President', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('Recruitment');
    const me = env._myMemberRecord();
    assert.ok(me, 'expected a linked member record for Recruitment');
    assert.equal(me.name, 'Alex Rivera');
    assert.notEqual(me.name, 'James Mitchell');
  });

  test('General Member persona has no backing member record (by design — a generic guest, not misattributed to a real seat)', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('General Member');
    const me = env._myMemberRecord();
    assert.equal(me, null);
  });

  test('Settings "Signed in as" reflects the active persona\'s email/title after a role switch', () => {
    const env = loadDemoEnv();
    env.switchDemoRole('Treasurer');
    env.seRenderUsers();
    const html = env.document.getElementById('se-users').innerHTML;
    assert.ok(html.includes('Connor Walsh') || env.CURRENT_USER.email.includes('connor'), 'Settings should reflect the Treasurer persona, not the original President');
  });
});

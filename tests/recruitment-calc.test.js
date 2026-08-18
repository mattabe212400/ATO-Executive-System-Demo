// Pure-function tests for js/recruitmentCalc.js — no DOM, no vm harness needed. Fixture data
// mirrors the shape (not the literal content) of js/demo.js's seeded rushees so these tests don't
// silently start passing/failing just because the fictional dataset changes later.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  RC_STAGES, RC_HOT_THRESHOLD,
  rcTotalRushees, rcActiveProspects, rcHotProspects, rcBidReady, rcLateStageProspects,
  rcAccepted, rcEventAttendances, rcGoalProgress, rcStageDistribution, rcCumulativeRetention,
  rcOverviewStats,
} = require('../js/recruitmentCalc.js');

// 14 rushees: New Lead x1, Contacted x1, Attended Event x2, Active Rush x3, Interviewed x1,
// Bid Ready x3, Bid Extended x1, Accepted x2 — same distribution as the actual demo seed data.
function makeRushees() {
  const stageCounts = { 'New Lead': 1, 'Contacted': 1, 'Attended Event': 2, 'Active Rush': 3, 'Interviewed': 1, 'Bid Ready': 3, 'Bid Extended': 1, 'Accepted': 2 };
  const rushees = [];
  let i = 0, bidScore = 30;
  for (const [stage, n] of Object.entries(stageCounts)) {
    for (let k = 0; k < n; k++) {
      i++;
      rushees.push({ id: 'r' + i, name: 'Rushee ' + i, stage, bidScore: (bidScore += 7) % 100, eventsAttended: i % 5 });
    }
  }
  return rushees;
}

describe('recruitment canonical calculations', () => {
  test('total rushees counts every prospect passed in', () => {
    assert.equal(rcTotalRushees(makeRushees()), 14);
  });

  test('bid ready is an exact stage match, never a union with Bid Extended/Accepted', () => {
    const rushees = makeRushees();
    assert.equal(rcBidReady(rushees).length, 3);
    // The broader bucket is a distinct function/number, not silently swapped in for Bid Ready.
    assert.equal(rcLateStageProspects(rushees).length, 6); // Bid Ready(3) + Bid Extended(1) + Accepted(2)
    assert.notEqual(rcBidReady(rushees).length, rcLateStageProspects(rushees).length);
  });

  test('accepted is an exact stage match', () => {
    assert.equal(rcAccepted(makeRushees()).length, 2);
  });

  test('active prospects excludes only Accepted', () => {
    assert.equal(rcActiveProspects(makeRushees()).length, 12);
  });

  test('hot prospects uses the documented bid-score threshold', () => {
    const rushees = [{ stage: 'New Lead', bidScore: RC_HOT_THRESHOLD - 1 }, { stage: 'New Lead', bidScore: RC_HOT_THRESHOLD }, { stage: 'New Lead', bidScore: RC_HOT_THRESHOLD + 10 }];
    assert.equal(rcHotProspects(rushees).length, 2);
  });

  test('event attendances sums recorded attendance across rushees', () => {
    const rushees = [{ eventsAttended: 4 }, { eventsAttended: 3 }, { eventsAttended: 0 }];
    assert.equal(rcEventAttendances(rushees), 7);
  });

  test('season goal progress uses Accepted, never total pipeline size', () => {
    const rushees = makeRushees(); // 14 total, 2 accepted
    const goal = rcGoalProgress(rushees, { target: 20 });
    assert.equal(goal.accepted, 2);
    assert.equal(goal.target, 20);
    assert.equal(goal.pct, 10); // 2/20, not 14/20 (which would read 70%)
    assert.equal(goal.remaining, 18);
  });

  test('season goal progress never exceeds 100%', () => {
    const rushees = Array.from({ length: 30 }, (_, i) => ({ id: 'r' + i, stage: 'Accepted' }));
    const goal = rcGoalProgress(rushees, { target: 20 });
    assert.equal(goal.pct, 100);
  });

  test('stage distribution sums to at most 100% and covers every RC_STAGES entry', () => {
    const dist = rcStageDistribution(makeRushees());
    assert.equal(dist.length, RC_STAGES.length);
    const totalPct = dist.reduce((s, d) => s + d.pct, 0);
    assert.ok(totalPct <= 100, `stage percentages summed to ${totalPct}, expected <=100`);
    dist.forEach(d => assert.ok(d.pct >= 0 && d.pct <= 100, `${d.stage} pct ${d.pct} out of 0-100 range`));
  });

  test('cumulative retention rates are always between 0 and 100 (bounded by construction)', () => {
    const pairs = rcCumulativeRetention(makeRushees());
    assert.ok(pairs.length > 0);
    pairs.forEach(p => {
      assert.ok(p.rate >= 0 && p.rate <= 100, `${p.from}->${p.to} rate ${p.rate} exceeds 0-100 bound`);
      assert.ok(p.toN <= p.fromN, `${p.from}->${p.to}: toN (${p.toN}) exceeded fromN (${p.fromN})`);
    });
  });

  test('overview stats are internally consistent (same numbers as the individual functions)', () => {
    const rushees = makeRushees();
    const stats = rcOverviewStats(rushees, { target: 20 });
    assert.equal(stats.total, rcTotalRushees(rushees));
    assert.equal(stats.bidReady, rcBidReady(rushees).length);
    assert.equal(stats.accepted, rcAccepted(rushees).length);
    assert.equal(stats.goal.pct, rcGoalProgress(rushees, { target: 20 }).pct);
  });

  test('empty pipeline never divides by zero or produces NaN/Infinity', () => {
    const goal = rcGoalProgress([], { target: 20 });
    assert.equal(goal.accepted, 0);
    assert.equal(goal.pct, 0);
    const dist = rcStageDistribution([]);
    dist.forEach(d => assert.equal(d.pct, 0));
    assert.deepEqual(rcCumulativeRetention([]), []);
  });
});

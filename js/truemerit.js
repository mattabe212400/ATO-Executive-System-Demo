// ══════════════════════════════════════════════
// TRUE MERIT REPORT ASSISTANT
//
// Turns a chapter's year-round operational data (the same D{} object every other page reads)
// into a normalized, privacy-safe, academic-year-scoped JSON export. Pairs with Alpha Tau
// Omega's nationally-supplied True Merit template + an AI workflow OUTSIDE this app — this file
// never contacts an external AI provider and never writes a completed submission itself.
//
// Architecture note: everything above the "── DOM LAYER ──" marker is a pure function — no
// `document`/`window`/Firebase/CURRENT_USER references, only the arguments it's given. Same
// reason js/defaultPositions.js is written the same way: it lets tests/truemerit/*.test.js
// `require()` this file directly under plain Node, with mock chapter data, with zero DOM
// shimming. The DOM layer at the bottom is the only part that touches globals, and it's a thin
// wrapper — read the data already in memory, call the pure builder, trigger a download.
// ══════════════════════════════════════════════

const TM_SCHEMA_VERSION = '1.0';

// ── SEMESTER / ACADEMIC YEAR HELPERS ──
// Mirrors js/auth.js's semesterDateRange()/semesterSortKey() exactly (same "Fall = Jun 1-Dec 31,
// Spring = Jan 1-May 31" boundary) — duplicated here rather than imported because this file must
// stay requireable under plain Node for tests, and auth.js is full of DOM/Firebase globals.
function tmSemesterDateRange(label) {
  const m = /^(Spring|Fall)\s+(\d+)$/.exec(label || '');
  if (!m) return null;
  const year = m[2];
  return m[1] === 'Fall' ? { start: year + '-06-01', end: year + '-12-31' } : { start: year + '-01-01', end: year + '-05-31' };
}

// "Fall 2026" -> academic year "2026-2027"; "Spring 2027" -> "2026-2027". An academic year is
// always Fall <year> + Spring <year+1>, so this never needs a chapter-specific lookup table.
function tmAcademicYearForSemester(label) {
  const m = /^(Spring|Fall)\s+(\d+)$/.exec(label || '');
  if (!m) return null;
  const year = parseInt(m[2], 10);
  return m[1] === 'Fall' ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// Academic year "2026-2027" -> { semesters: ["Fall 2026","Spring 2027"], start, end }. Every
// chapter uses this same derivation — nothing chapter-specific, nothing hard-coded to one year.
function tmAcademicYearRange(academicYear) {
  const m = /^(\d{4})-(\d{4})$/.exec(academicYear || '');
  if (!m || parseInt(m[2], 10) !== parseInt(m[1], 10) + 1) return null;
  const fall = 'Fall ' + m[1];
  const spring = 'Spring ' + m[2];
  const fallRange = tmSemesterDateRange(fall);
  const springRange = tmSemesterDateRange(spring);
  return { semesters: [fall, spring], start: fallRange.start, end: springRange.end };
}

// getSemester()'s current-semester label, translated to its academic year — used only to compute
// tmAcademicYearOptions()'s default/current entry. Takes `now` as a parameter (defaults to
// `new Date()`) so tests can pin a specific date instead of depending on the real clock.
function tmCurrentAcademicYear(now) {
  const d = now || new Date();
  const label = d.getMonth() >= 5 ? 'Fall ' + d.getFullYear() : 'Spring ' + d.getFullYear();
  return tmAcademicYearForSemester(label);
}

// Small fixed window (current academic year, plus the two before and one after) rather than
// scanning every collection for every semester label a chapter has ever used — simpler, and a
// True Merit project lead is realistically only ever generating this year's or last year's
// report. data_completeness (not this list) is what tells them whether a year actually has data.
function tmAcademicYearOptions(now) {
  const m = /^(\d{4})-(\d{4})$/.exec(tmCurrentAcademicYear(now));
  const currentStart = parseInt(m[1], 10);
  const years = [];
  for (let offset = 1; offset >= -2; offset--) {
    const start = currentStart + offset;
    years.push(`${start}-${start + 1}`);
  }
  return years;
}

function tmDateInRange(dateStr, range) {
  return !!(dateStr && range && dateStr >= range.start && dateStr <= range.end);
}
function tmSemesterInSet(semesterLabel, semesterSet) {
  return !!(semesterLabel && semesterSet.includes(semesterLabel));
}
// Reverse of tmSemesterDateRange() — same Jun 1/Jan 1 boundary as js/auth.js's
// semesterLabelForDate(), reimplemented here for the same Node-testability reason as everything
// else in this file. Used for date-stamped records (events) that have no stored .semester field.
function tmSemesterForDate(dateStr) {
  if (!dateStr) return null;
  const year = dateStr.slice(0, 4), month = dateStr.slice(5, 7);
  return month >= '06' ? 'Fall ' + year : 'Spring ' + year;
}

// ── FILENAME ──
// ATO_True_Merit_Data_<ChapterName>_<AcademicYear>.json — spaces/punctuation collapsed to
// underscores so the download works identically on every OS's filesystem.
function tmSanitizeForFilename(str) {
  return String(str || 'Chapter').trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Chapter';
}
function tmFilename(chapterName, academicYear) {
  return `ATO_True_Merit_Data_${tmSanitizeForFilename(chapterName)}_${academicYear}.json`;
}

// ── SMALL MATH HELPERS (defensive: never divide by zero, never fabricate a value) ──
function tmPct(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal place, as a 0-100 number
}
function tmRound2(n) {
  return Math.round(n * 100) / 100;
}

// ══════════════════════════════════════════════
// SECTION BUILDERS — each takes the already-scoped slice of D it needs (never the whole D
// object) plus the shared `ctx` (academic year range/semesters, chapter positions). Keeping each
// builder narrow is what makes the privacy story auditable: a section that never receives
// D.finance.dues cannot possibly leak an individual balance, by construction, not by convention.
// ══════════════════════════════════════════════

// ── REPORT METADATA ──
function tmBuildMetadata(ctx) {
  return {
    chapter_id: ctx.chapterId || null,
    chapter_name: ctx.chapterName || null,
    university: ctx.university || null,
    academic_year: ctx.academicYear,
    included_semesters: ctx.semesters,
    generated_at: ctx.generatedAt,
    generated_by_role: ctx.generatedByRole || null,
    system: 'ATO Executive System',
  };
}

// ── CHAPTER OVERVIEW ──
function tmBuildChapterOverview(D, ctx) {
  const members = D.members || [];
  const newMembers = members.filter(m => tmDateInRange(m.joinDate, ctx.range));
  return {
    chapter_name: ctx.chapterName || null,
    university: ctx.university || null,
    academic_year: ctx.academicYear,
    included_semesters: ctx.semesters,
    // Only the roster snapshot AT EXPORT TIME is knowable — the system has no beginning-of-year
    // headcount or graduation tracking (members leave the roster via hard delete, with no
    // "Alumni"/"Graduated" status or history retained). See data_completeness for both gaps.
    active_member_count: members.length,
    beginning_of_year_membership: null,
    ending_membership: members.length,
    new_members_count: newMembers.length,
    graduates_count: null,
    officer_positions: Object.keys(ctx.positions || {}).sort(),
    committees: (D.committees || []).map(c => ({
      name: c.name,
      chair_position: c.chair ? true : false,
      member_count: Array.isArray(c.members) ? c.members.length : 0,
    })),
  };
}

// ── MEMBERSHIP ──
function tmBuildMembership(D, ctx) {
  const members = D.members || [];
  const byClassYear = {};
  const byStatus = {};
  members.forEach(m => {
    const cy = m.classYear || 'Unknown';
    const st = m.memberStatus || 'Active';
    byClassYear[cy] = (byClassYear[cy] || 0) + 1;
    byStatus[st] = (byStatus[st] || 0) + 1;
  });
  const newMembers = members.filter(m => tmDateInRange(m.joinDate, ctx.range));
  const bySemester = {};
  ctx.semesters.forEach(sem => {
    const range = tmSemesterDateRange(sem);
    bySemester[sem] = newMembers.filter(m => tmDateInRange(m.joinDate, range)).length;
  });
  return {
    total_members: members.length,
    live_in_count: members.filter(m => m.liveIn).length,
    by_class_year: byClassYear,
    by_status: byStatus,
    new_members_count: newMembers.length,
    new_members_by_semester: bySemester,
  };
}

// ── LEADERSHIP, GOALS, TASKS, COMMITTEES ──
function tmBuildLeadershipAndGoals(D, ctx) {
  const goals = (D.goals || []).filter(g => tmSemesterInSet(g.semester, ctx.semesters));
  const tasks = (D.tasks || []).filter(t => tmSemesterInSet(t.semester, ctx.semesters));

  const goalEntries = goals.map(g => {
    // Legacy goals (pre-redesign) may still carry target/current/unit and support a computed
    // status; current-format goals are a plain statement with nothing to compute — status stays
    // null rather than a fabricated "in progress"/"completed" guess. See DESIGN notes in
    // js/calendar.js renderTasks() for the same principle applied to the live UI.
    const hasTarget = typeof g.target === 'number' && g.target > 0;
    const pct = hasTarget ? tmPct(Math.min(g.current || 0, g.target), g.target) : null;
    return {
      position: g.positionTitle || 'Unassigned',
      goal: g.title,
      semester: g.semester || null,
      metric: hasTarget ? (g.unit || null) : null,
      target: hasTarget ? g.target : null,
      actual: hasTarget ? (g.current ?? null) : null,
      completion_percentage: pct,
      status: pct === null ? null : (pct >= 100 ? 'completed' : 'in_progress'),
    };
  });

  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < ctx.generatedAtDate).length;

  const byPosition = {};
  tasks.forEach(t => {
    const p = t.positionTitle || 'Unassigned';
    if (!byPosition[p]) byPosition[p] = { position: p, tasks_total: 0, tasks_completed: 0, tasks_overdue: 0 };
    byPosition[p].tasks_total++;
    if (t.status === 'done') byPosition[p].tasks_completed++;
    else if (t.dueDate && t.dueDate < ctx.generatedAtDate) byPosition[p].tasks_overdue++;
  });
  Object.values(byPosition).forEach(row => {
    row.completion_rate = tmPct(row.tasks_completed, row.tasks_total);
  });

  const committees = (D.committees || []).map(c => ({
    name: c.name,
    description: c.desc || null,
    has_chair: !!c.chair,
    member_count: Array.isArray(c.members) ? c.members.length : 0,
    program_weeks: Array.isArray(c.program) ? c.program.length : 0,
  }));

  return {
    goals: goalEntries,
    tasks_summary: {
      total: tasks.length,
      completed: doneTasks,
      overdue: overdueTasks,
      completion_rate: tmPct(doneTasks, tasks.length),
    },
    tasks_by_position: Object.values(byPosition),
    committees,
  };
}

// ── ATTENDANCE ──
// Same present/excused-over-eligible-mandatory-events formula as js/helpers.js's aR()/
// aRForSemester() (documented there), reimplemented as a pure function over passed-in
// members/events/attendance rather than the global D — the two must stay in sync by formula, not
// by literally sharing code, since aR() reads globals this file can't depend on.
function tmAttendanceRateForRange(members, events, attendance, range) {
  const mandatory = events.filter(e => e.mandatory && tmDateInRange(e.date, range));
  if (!mandatory.length || !members.length) return null;
  let sumRates = 0;
  members.forEach(m => {
    const eligible = m.joinDate ? mandatory.filter(e => e.date >= m.joinDate) : mandatory;
    if (!eligible.length) { sumRates += 100; return; }
    let present = 0;
    eligible.forEach(e => {
      const rec = (attendance[e.id] || {})[m.id];
      if (rec === 'present' || rec === 'excused') present++;
    });
    sumRates += (present / eligible.length) * 100;
  });
  return tmRound2(sumRates / members.length);
}

function tmBuildAttendance(D, ctx) {
  const members = D.members || [];
  const events = (D.events || []).filter(e => tmDateInRange(e.date, ctx.range));
  const attendance = D.attendance || {};
  const mandatoryEvents = events.filter(e => e.mandatory);

  const bySemester = {};
  ctx.semesters.forEach(sem => {
    const range = tmSemesterDateRange(sem);
    const semEvents = (D.events || []).filter(e => tmDateInRange(e.date, range));
    bySemester[sem] = {
      attendance_rate: tmAttendanceRateForRange(members, semEvents, attendance, range),
      mandatory_events: semEvents.filter(e => e.mandatory).length,
    };
  });

  // Event-level summary — counts only, no per-member breakdown (a full per-person attendance
  // history isn't included; see Part 7's "prefer organizational aggregates" instruction).
  const eventSummaries = mandatoryEvents.map(e => {
    const rec = attendance[e.id] || {};
    const present = Object.values(rec).filter(v => v === 'present' || v === 'excused').length;
    return { title: e.title, date: e.date, type: e.type || null, semester: tmSemesterForDate(e.date), present_count: present, tracked_count: Object.keys(rec).length };
  });

  return {
    chapter_attendance_rate: tmAttendanceRateForRange(members, events, attendance, ctx.range),
    total_tracked_events: events.length,
    mandatory_event_count: mandatoryEvents.length,
    by_semester: bySemester,
    event_summaries: eventSummaries,
  };
}

// ── RECRUITMENT ──
function tmBuildRecruitment(D, ctx) {
  const rushees = (D.recruitment?.rushees || []).filter(r => tmSemesterInSet(r.semester, ctx.semesters));
  const events = (D.events || []).filter(e => e.type === 'recruitment' && tmDateInRange(e.date, ctx.range));

  const byStage = {};
  rushees.forEach(r => { byStage[r.stage] = (byStage[r.stage] || 0) + 1; });

  const bidsExtended = rushees.filter(r => ['Bid Extended', 'Accepted'].includes(r.stage)).length;
  const bidsAccepted = (typeof rcAccepted === 'function' ? rcAccepted(rushees) : rushees.filter(r => r.stage === 'Accepted')).length;

  // Recruitment goal — current shape is per-semester ({semester: {target,label}}); a chapter
  // that hasn't migrated yet may still have the old flat {target,label} object, in which case
  // it's treated as applying to every semester (same fallback the live Recruitment page uses).
  const goalRaw = D.recruitment?.goal || null;
  const goalsBySemester = {};
  ctx.semesters.forEach(sem => {
    const g = goalRaw && goalRaw[sem] ? goalRaw[sem] : (goalRaw && typeof goalRaw.target === 'number' ? goalRaw : null);
    const actual = rushees.filter(r => r.semester === sem && r.stage === 'Accepted').length;
    goalsBySemester[sem] = g ? { target: g.target, label: g.label || null, actual, status: actual >= g.target ? 'completed' : 'in_progress' } : null;
  });

  return {
    total_prospects: rushees.length,
    pipeline_by_stage: byStage,
    bids_extended: bidsExtended,
    bids_accepted: bidsAccepted,
    // The pipeline has no distinct "declined"/"not interested" stage — a prospect who doesn't
    // continue is simply removed from the roster, so declines can't be counted here. See
    // data_completeness.
    bids_declined: null,
    new_members_from_recruitment: bidsAccepted,
    bid_acceptance_rate: tmPct(bidsAccepted, bidsExtended),
    conversion_rate: tmPct(bidsAccepted, rushees.length),
    goals_by_semester: goalsBySemester,
    recruitment_events: events.map(e => ({ title: e.title, date: e.date, semester: null, location: e.location || null, mandatory: !!e.mandatory })),
  };
}

// ── MEMBER EDUCATION ──
function tmBuildMemberEducation(D, ctx) {
  const members = D.members || [];
  const newMemberClass = members.filter(m => m.memberStatus === 'New Member' || tmDateInRange(m.joinDate, ctx.range));
  const requirements = D.newMemberEducation?.requirements || [];
  const progress = D.newMemberEducation?.progress || {};
  const events = (D.events || []).filter(e => e.type === 'pledge' && tmDateInRange(e.date, ctx.range));

  const requirementCompletion = requirements.map(req => {
    const completedCount = newMemberClass.filter(m => !!(progress[m.id] && progress[m.id][req.id])).length;
    return { title: req.title, due: req.due || null, completion_rate: tmPct(completedCount, newMemberClass.length) };
  });

  return {
    new_member_class_size: newMemberClass.length,
    requirements_total: requirements.length,
    requirement_completion: requirementCompletion,
    programming_events: events.map(e => ({ title: e.title, date: e.date, location: e.location || null })),
  };
}

// ── BROTHERHOOD & PROGRAMMING ──
function tmBuildBrotherhoodAndProgramming(D, ctx) {
  const events = (D.events || []).filter(e => ['brotherhood', 'faith'].includes(e.type) && tmDateInRange(e.date, ctx.range));
  const attendance = D.attendance || {};
  const chaplainHub = D.chaplainHub || {};
  return {
    events: events.map(e => {
      const rec = attendance[e.id] || {};
      const present = Object.values(rec).filter(v => v === 'present' || v === 'excused').length;
      return { title: e.title, date: e.date, type: e.type, location: e.location || null, attendance_count: Object.keys(rec).length ? present : null };
    }),
    faith_programming_counts: {
      bible_studies: Array.isArray(chaplainHub.bibleStudies) ? chaplainHub.bibleStudies.length : 0,
      devotionals: Array.isArray(chaplainHub.devotionals) ? chaplainHub.devotionals.length : 0,
      chaplain_events: Array.isArray(chaplainHub.events) ? chaplainHub.events.filter(e => tmDateInRange(e.date, ctx.range)).length : 0,
    },
  };
}

// ── ACADEMICS (organizational-level only — no individual GPA records) ──
function tmBuildAcademics(D, ctx) {
  const history = (D.academics?.history || []).filter(h => tmSemesterInSet(h.semester, ctx.semesters));
  const bySemester = {};
  history.forEach(h => {
    bySemester[h.semester] = { chapter_gpa: h.chapterGpa ?? null, cumulative_chapter_gpa: h.cumulativeChapterGpa ?? null, members_reporting: h.memberCount ?? null };
  });
  const sorted = [...history].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let trend = null;
  if (sorted.length >= 2) {
    const first = parseFloat(sorted[0].chapterGpa), last = parseFloat(sorted[sorted.length - 1].chapterGpa);
    if (!isNaN(first) && !isNaN(last)) trend = tmRound2(last - first);
  }
  return {
    by_semester: bySemester,
    gpa_trend: trend,
    semesters_with_data: Object.keys(bySemester),
  };
}

// ── PHILANTHROPY ──
function tmBuildPhilanthropy(D, ctx) {
  const logs = (D.philanthropy?.fundraisingLogs || []).filter(l => tmDateInRange(l.date, ctx.range));
  const events = (D.events || []).filter(e => e.type === 'philanthropy' && tmDateInRange(e.date, ctx.range));
  const attendance = D.attendance || {};
  const totalRaised = logs.reduce((s, l) => s + (l.amount || 0), 0);

  const bySemester = {};
  ctx.semesters.forEach(sem => {
    const range = tmSemesterDateRange(sem);
    bySemester[sem] = tmRound2(logs.filter(l => tmDateInRange(l.date, range)).reduce((s, l) => s + (l.amount || 0), 0));
  });

  return {
    total_raised: tmRound2(totalRaised),
    raised_by_semester: bySemester,
    event_count: events.length,
    organizations: (D.philanthropy?.organizations || []).map(o => (typeof o === 'string' ? o : o.name)).filter(Boolean),
    goal: D.philanthropy?.goals || null,
    events: events.map(e => {
      const rec = attendance[e.id] || {};
      const present = Object.values(rec).filter(v => v === 'present' || v === 'excused').length;
      return { title: e.title, date: e.date, attendance_count: Object.keys(rec).length ? present : null, amount_raised: tmRound2(logs.filter(l => l.eventId === e.id).reduce((s, l) => s + (l.amount || 0), 0)) };
    }),
  };
}

// ── COMMUNITY SERVICE ──
function tmBuildCommunityService(D, ctx) {
  const hours = (D.communityService?.hours || []).filter(h => tmDateInRange(h.date, ctx.range) || tmSemesterInSet(h.semester, ctx.semesters));
  const events = (D.events || []).filter(e => e.type === 'service' && tmDateInRange(e.date, ctx.range));
  const totalHours = hours.reduce((s, h) => s + (h.hours || 0), 0);
  const uniqueParticipants = new Set(hours.map(h => h.memberId).filter(Boolean)).size;

  const bySemester = {};
  ctx.semesters.forEach(sem => {
    const range = tmSemesterDateRange(sem);
    bySemester[sem] = tmRound2(hours.filter(h => tmDateInRange(h.date, range) || h.semester === sem).reduce((s, h) => s + (h.hours || 0), 0));
  });

  return {
    total_hours: tmRound2(totalHours),
    hours_by_semester: bySemester,
    event_count: events.length,
    participant_count: uniqueParticipants,
    avg_hours_per_participant: uniqueParticipants ? tmRound2(totalHours / uniqueParticipants) : null,
    partner_organizations: (D.communityService?.locations || []).map(l => (typeof l === 'string' ? l : l.name)).filter(Boolean),
    events: events.map(e => ({ title: e.title, date: e.date, hours_logged: tmRound2(hours.filter(h => h.eventId === e.id).reduce((s, h) => s + (h.hours || 0), 0)) })),
  };
}

// ── ALUMNI RELATIONS (chapter performance only — no contact directory) ──
function tmBuildAlumniRelations(D, ctx) {
  const events = (D.alumni?.events || []).filter(e => tmDateInRange(e.date, ctx.range));
  const outreach = (D.alumni?.outreach || []).filter(o => tmDateInRange(o.date, ctx.range));
  const byMethod = {};
  outreach.forEach(o => { byMethod[o.method || 'Other'] = (byMethod[o.method || 'Other'] || 0) + 1; });
  return {
    total_alumni_engaged: (D.alumni?.contacts || []).length,
    events: events.map(e => ({ title: e.title, date: e.date, type: e.type || null, location: e.location || null })),
    outreach_touches: outreach.length,
    outreach_by_method: byMethod,
  };
}

// ── PUBLIC RELATIONS (no dedicated module exists today — see data_completeness) ──
function tmBuildPublicRelations() {
  return {
    tracked: false,
    note: 'ATO Executive System does not currently have a dedicated Public Relations/Communications module. This section cannot be populated automatically.',
  };
}

// A member's D.finance.dues[memberId] record is either the current shape ({semesterLabel:
// {semesterDues,paid,status,...}}) or, until this browser session has visited the Finance page
// at least once, the pre-migration flat shape ({semesterDues,paid,status,...} directly — see
// finEnsureDuesMigrated() in js/finance.js, which only runs on-demand when Finance renders). The
// True Merit export can be the very first page a lead visits this session, so it can't assume
// that lazy migration has already happened — this reads the flat shape the same way
// finEnsureDuesMigrated() would, without mutating D itself (this function is read-only/pure).
function tmNormalizeDuesRecord(rec, nowSemester) {
  if (!rec) return {};
  const looksFlat = ('paid' in rec) || ('status' in rec) || ('semesterDues' in rec);
  return looksFlat ? { [nowSemester]: rec } : rec;
}

// ── FINANCE (aggregate only — no individual balances/fines/payment plans) ──
function tmBuildFinance(D, ctx) {
  const dues = D.finance?.dues || {};
  const members = D.members || [];
  let totalDue = 0, totalPaid = 0;
  const statusCounts = {};
  const bySemester = {};
  ctx.semesters.forEach(sem => {
    let semDue = 0, semPaid = 0;
    members.forEach(m => {
      const rec = tmNormalizeDuesRecord(dues[m.id], ctx.nowSemester)[sem];
      if (!rec) return;
      semDue += rec.semesterDues || 0;
      semPaid += rec.paid || 0;
      statusCounts[rec.status || 'Unknown'] = (statusCounts[rec.status || 'Unknown'] || 0) + 1;
    });
    totalDue += semDue; totalPaid += semPaid;
    bySemester[sem] = { total_due: tmRound2(semDue), total_paid: tmRound2(semPaid), collection_rate: tmPct(semPaid, semDue) };
  });

  const fines = (D.finance?.fines || []).filter(f => tmDateInRange(f.date, ctx.range));
  const expenses = (D.finance?.expenses || []).filter(e => tmDateInRange(e.date, ctx.range));
  const expensesByCategory = {};
  expenses.forEach(e => { expensesByCategory[e.category || 'Uncategorized'] = tmRound2((expensesByCategory[e.category || 'Uncategorized'] || 0) + (e.amount || 0)); });

  return {
    dues_collection_rate: tmPct(totalPaid, totalDue),
    total_dues_billed: tmRound2(totalDue),
    total_dues_collected: tmRound2(totalPaid),
    total_outstanding: tmRound2(totalDue - totalPaid),
    dues_status_breakdown: statusCounts,
    by_semester: bySemester,
    fines_total_count: fines.length,
    fines_total_amount: tmRound2(fines.reduce((s, f) => s + (f.amount || 0), 0)),
    expenses_by_category: expensesByCategory,
    total_expenses: tmRound2(expenses.reduce((s, e) => s + (e.amount || 0), 0)),
    payment_plan_count: (D.finance?.plans || []).filter(p => p.status === 'Active').length,
    approved_budget: D.finance?.budget || {},
  };
}

// ── JUDICIAL BOARD / ACCOUNTABILITY (the most sensitive section — aggregate counts only) ──
function tmBuildJudicial(D, ctx) {
  const cases = (D.cases || []).filter(c => tmSemesterInSet(c.semester, ctx.semesters));
  const resolved = cases.filter(c => c.status === 'resolved' || c.status === 'dismissed');
  const open = cases.filter(c => c.status !== 'resolved' && c.status !== 'dismissed');
  const categories = {};
  cases.forEach(c => { categories[c.type || 'unspecified'] = (categories[c.type || 'unspecified'] || 0) + 1; });
  const bySemester = {};
  ctx.semesters.forEach(sem => { bySemester[sem] = cases.filter(c => c.semester === sem).length; });

  return {
    cases_total: cases.length,
    cases_resolved: resolved.length,
    cases_open: open.length,
    resolution_rate: tmPct(resolved.length, cases.length),
    // The system does not store a resolution timestamp separately from the case's other fields
    // (only a hearing date, which isn't the same thing) — this can never be computed accurately,
    // so it is always null rather than approximated from an unrelated date.
    average_resolution_days: null,
    case_categories: categories,
    semester_breakdown: bySemester,
    sanction_categories: {},
    accountability_programs: [],
  };
}

// ── CHAPTER EVENTS (normalized index of every dated event in range) ──
function tmBuildChapterEvents(D, ctx) {
  const events = (D.events || []).filter(e => tmDateInRange(e.date, ctx.range));
  const attendance = D.attendance || {};
  const fundraising = D.philanthropy?.fundraisingLogs || [];
  const serviceHours = D.communityService?.hours || [];
  return events.map(e => {
    const rec = attendance[e.id] || {};
    const present = Object.values(rec).filter(v => v === 'present' || v === 'excused').length;
    const raised = fundraising.filter(l => l.eventId === e.id).reduce((s, l) => s + (l.amount || 0), 0);
    const hours = serviceHours.filter(h => h.eventId === e.id).reduce((s, h) => s + (h.hours || 0), 0);
    return {
      id: e.id,
      title: e.title,
      type: e.type || null,
      date: e.date,
      semester: tmSemesterForDate(e.date),
      location: e.location || null,
      committee_id: e.committeeId || null,
      mandatory: !!e.mandatory,
      attendance_count: Object.keys(rec).length ? present : null,
      amount_raised: raised || null,
      service_hours: hours || null,
    };
  });
}

// ── AWARDS & ACHIEVEMENTS ──
// Backed by D.achievements — a lightweight, chapter-entered record (see tmAddAchievement in the
// DOM layer below). Empty by default; this is intentionally the one section that starts with
// nothing until the chapter records its own wins, per Part 19's "do not overbuild" guidance.
function tmBuildAwardsAndAchievements(D, ctx) {
  const items = (D.achievements || []).filter(a => tmDateInRange(a.date, ctx.range) || tmSemesterInSet(a.semester, ctx.semesters));
  return items.map(a => ({ title: a.title, category: a.category || null, date: a.date || null, semester: a.semester || null, description: a.description || null }));
}

// ── STRATEGIC INITIATIVES / EXECUTIVE NOTES ──
// Derived from D.goals (already computed above) plus retreat/exec meeting notes — never a raw
// dump of full meeting-note bodies (see Part 20's "avoid dumping enormous raw meeting notes").
function tmBuildStrategicInitiatives(D, ctx, leadershipAndGoals) {
  const initiatives = (leadershipAndGoals.goals || []).map(g => ({
    title: g.goal,
    owner: g.position,
    semester: g.semester,
    goal: g.goal,
    result: g.status === 'completed' ? 'Completed' : null,
    related_events: [],
  }));
  const notes = (D.notes || []).filter(n => ['retreat', 'exec'].includes(n.type) && tmDateInRange(n.date, ctx.range));
  notes.forEach(n => {
    initiatives.push({ title: n.title, owner: null, semester: tmSemesterForDate(n.date), goal: null, result: null, related_events: [] });
  });
  return initiatives;
}

function tmBuildExecutiveNotes(D, ctx) {
  const notes = (D.notes || []).filter(n => tmDateInRange(n.date, ctx.range));
  return notes.map(n => ({ title: n.title, type: n.type || null, date: n.date, action_item_count: Array.isArray(n.actions) ? n.actions.length : 0 }));
}

// ── DATA COMPLETENESS ──
// Determined conservatively: a section is only "complete" when it has real records AND no known
// structural gap; "partial" when it has some data but a documented limitation applies; the
// section itself decides its own status rather than this function guessing from record counts
// alone (a section existing in Firestore is not the same as it being usable for True Merit).
function tmBuildDataCompleteness(report) {
  const sections = {};

  const mark = (key, recordCount, missing) => {
    sections[key] = {
      status: missing.length ? (recordCount > 0 ? 'partial' : (missing.some(m => m.startsWith('__unavailable__')) ? 'unavailable' : 'partial')) : 'complete',
      record_count: recordCount,
      missing: missing.map(m => m.replace('__unavailable__', '')),
    };
  };

  mark('chapter_overview', 1, [
    ...(report.chapter_overview.beginning_of_year_membership === null ? ['Beginning-of-year membership count (not tracked — no historical roster snapshot)'] : []),
    ...(report.chapter_overview.graduates_count === null ? ['Graduate count (member status has no "Graduated"/"Alumni" state; departed members are removed from the roster)'] : []),
  ]);

  mark('membership', (report.membership.total_members || 0), []);

  mark('leadership_and_goals', report.leadership_and_goals.goals.length + report.leadership_and_goals.tasks_summary.total,
    report.leadership_and_goals.goals.some(g => g.completion_percentage === null) ? ['Some goals have no target/actual to measure — reported as a statement only, not a percentage'] : []);

  mark('attendance', report.attendance.total_tracked_events, report.attendance.chapter_attendance_rate === null ? ['No mandatory events with attendance recorded in this academic year'] : []);

  mark('recruitment', report.recruitment.total_prospects, ['Declined/not-interested prospects are not tracked as a distinct pipeline stage']);

  mark('member_education', report.member_education.new_member_class_size, report.member_education.requirements_total === 0 ? ['No new member education requirements configured'] : []);

  mark('brotherhood_and_programming', report.brotherhood_and_programming.events.length, []);

  mark('academics', report.academics.semesters_with_data.length, ctx_missingAcademicSemesters(report));

  mark('philanthropy', report.philanthropy.events.length, []);

  mark('community_service', report.community_service.events.length, []);

  mark('alumni_relations', report.alumni_relations.events.length + report.alumni_relations.outreach_touches, []);

  mark('public_relations', 0, ['__unavailable__No Public Relations/Communications module exists in ATO Executive System yet']);

  mark('finance', Object.keys(report.finance.by_semester).length, []);

  mark('judicial_and_accountability', report.judicial_and_accountability.cases_total, ['Average resolution time is not tracked (no resolution date stored on a case, only a hearing date)']);

  mark('chapter_events', report.chapter_events.length, []);

  mark('awards_and_achievements', report.awards_and_achievements.length, report.awards_and_achievements.length === 0 ? ['No achievements recorded yet — add them from Settings before generating a final export'] : []);

  mark('strategic_initiatives', report.strategic_initiatives.length, []);

  const anyPartial = Object.values(sections).some(s => s.status !== 'complete');
  return { overall_status: anyPartial ? 'partial' : 'complete', sections };
}
function ctx_missingAcademicSemesters(report) {
  const missing = [];
  Object.keys(report.academics.by_semester).length === 0 && missing.push('No chapter GPA history recorded for this academic year');
  return missing;
}

// ══════════════════════════════════════════════
// TOP-LEVEL ASSEMBLY
// ══════════════════════════════════════════════
// D: the chapter's full in-memory data object (already chapter-scoped by Firestore rules/query
//    before it ever reaches this function — see js/data.js's FS_ID scoping. This function never
//    takes a chapterId and fetches anything itself, so it cannot cross a chapter boundary).
// meta: { chapterId, chapterName, university, positions, academicYear, generatedByRole, now }
function tmBuildAnnualReport(D, meta) {
  const range = tmAcademicYearRange(meta.academicYear);
  if (!range) throw new Error('Invalid academic year: ' + meta.academicYear);
  const now = meta.now || new Date();
  const ctx = {
    range,
    semesters: range.semesters,
    positions: meta.positions || {},
    generatedAtDate: now.toISOString().slice(0, 10),
    chapterName: meta.chapterName || null,
    university: meta.university || null,
    academicYear: meta.academicYear,
    // Same "Fall = Jun-Dec, Spring = Jan-May" boundary as getSemester() in js/auth.js — needed
    // only to interpret un-migrated legacy dues records (see tmNormalizeDuesRecord below).
    nowSemester: now.getMonth() >= 5 ? 'Fall ' + now.getFullYear() : 'Spring ' + now.getFullYear(),
  };

  const chapterOverview = tmBuildChapterOverview(D, ctx);
  const membership = tmBuildMembership(D, ctx);
  const leadershipAndGoals = tmBuildLeadershipAndGoals(D, ctx);
  const attendance = tmBuildAttendance(D, ctx);
  const recruitment = tmBuildRecruitment(D, ctx);
  const memberEducation = tmBuildMemberEducation(D, ctx);
  const brotherhoodAndProgramming = tmBuildBrotherhoodAndProgramming(D, ctx);
  const academics = tmBuildAcademics(D, ctx);
  const philanthropy = tmBuildPhilanthropy(D, ctx);
  const communityService = tmBuildCommunityService(D, ctx);
  const alumniRelations = tmBuildAlumniRelations(D, ctx);
  const publicRelations = tmBuildPublicRelations();
  const finance = tmBuildFinance(D, ctx);
  const judicial = tmBuildJudicial(D, ctx);
  const chapterEvents = tmBuildChapterEvents(D, ctx);
  const awardsAndAchievements = tmBuildAwardsAndAchievements(D, ctx);
  const strategicInitiatives = tmBuildStrategicInitiatives(D, ctx, leadershipAndGoals);
  const executiveNotes = tmBuildExecutiveNotes(D, ctx);

  const report = {
    schema_version: TM_SCHEMA_VERSION,
    report_metadata: tmBuildMetadata({
      chapterId: meta.chapterId, chapterName: meta.chapterName, university: meta.university,
      academicYear: meta.academicYear, semesters: range.semesters,
      generatedAt: now.toISOString(), generatedByRole: meta.generatedByRole,
    }),
    chapter_overview: chapterOverview,
    membership,
    leadership_and_goals: leadershipAndGoals,
    attendance,
    recruitment,
    member_education: memberEducation,
    brotherhood_and_programming: brotherhoodAndProgramming,
    academics,
    philanthropy,
    community_service: communityService,
    alumni_relations: alumniRelations,
    public_relations: publicRelations,
    finance,
    judicial_and_accountability: judicial,
    chapter_events: chapterEvents,
    awards_and_achievements: awardsAndAchievements,
    strategic_initiatives: strategicInitiatives,
    executive_notes: executiveNotes,
  };
  report.data_completeness = tmBuildDataCompleteness(report);
  return report;
}

// Requireable under plain Node (see tests/truemerit/*.test.js) — no-op in the browser, same
// guard js/defaultPositions.js uses.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TM_SCHEMA_VERSION,
    tmSemesterDateRange, tmAcademicYearForSemester, tmAcademicYearRange, tmCurrentAcademicYear, tmAcademicYearOptions,
    tmDateInRange, tmSemesterInSet, tmSemesterForDate, tmSanitizeForFilename, tmFilename,
    tmPct, tmRound2, tmNormalizeDuesRecord,
    tmBuildAnnualReport, tmBuildDataCompleteness,
  };
}

// ══════════════════════════════════════════════
// ── DOM LAYER ── everything below here touches document/CURRENT_USER/CURRENT_CHAPTER/D and is
// never required from Node — it's the thin bridge between the pure builder above and the app.
// ══════════════════════════════════════════════

// Same permission tier as the existing raw "Export all data (JSON)" action (js/helpers.js
// xport('all')) — an organizational annual export is at least as sensitive as the full backup,
// so it reuses that exact gate rather than introducing a second, possibly-inconsistent
// permission concept for "who can export chapter data."
function tmCanGenerateReport() {
  return typeof isLeadUser === 'function' && isLeadUser();
}

function tmOpenModal() {
  if (!tmCanGenerateReport()) { toast('Only the President or Vice President can generate a True Merit data export.', 'error'); return; }
  const sel = document.getElementById('tm-ay');
  if (sel && !sel._tmInit) {
    const options = tmAcademicYearOptions();
    const current = tmCurrentAcademicYear();
    sel.innerHTML = options.map(y => `<option value="${y}"${y === current ? ' selected' : ''}>${y}</option>`).join('');
    sel._tmInit = true;
  }
  tmUpdatePreview();
  openM('m-truemerit');
}

function tmUpdatePreview() {
  const sel = document.getElementById('tm-ay');
  const ay = sel ? sel.value : tmCurrentAcademicYear();
  const range = tmAcademicYearRange(ay);
  const semEl = document.getElementById('tm-semesters');
  if (semEl && range) semEl.textContent = range.semesters.join(' + ');
}

async function tmGenerateAndDownload() {
  if (!tmCanGenerateReport()) { toast('Only the President or Vice President can generate a True Merit data export.', 'error'); return; }
  const sel = document.getElementById('tm-ay');
  const academicYear = sel ? sel.value : tmCurrentAcademicYear();
  const btn = document.getElementById('tm-generate-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  try {
    const chapterName = (D.settings && D.settings.chapterName) || (typeof CURRENT_USER !== 'undefined' && CURRENT_USER?.chapterName) || (typeof CURRENT_CHAPTER !== 'undefined' && CURRENT_CHAPTER?.name) || 'Chapter';
    const university = (D.settings && D.settings.university) || (typeof CURRENT_USER !== 'undefined' && CURRENT_USER?.university) || (typeof CURRENT_CHAPTER !== 'undefined' && CURRENT_CHAPTER?.university) || null;
    const report = tmBuildAnnualReport(D, {
      chapterId: typeof FS_ID !== 'undefined' ? FS_ID : null,
      chapterName, university,
      positions: (typeof CURRENT_CHAPTER !== 'undefined' && CURRENT_CHAPTER?.positions) || {},
      academicYear,
      generatedByRole: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER?.title) || null,
    });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = tmFilename(chapterName, academicYear); a.click();
    URL.revokeObjectURL(url);
    if (typeof _xportAudit === 'function') _xportAudit('true_merit_' + academicYear);
    closeM(null, document.getElementById('m-truemerit'));
    if (report.data_completeness.overall_status === 'complete') {
      toast('Annual export generated', 'success');
    } else {
      toast('Some report sections are incomplete. The export was generated with available data. Review the Data Completeness section before using it for True Merit reporting.', 'info', 7000);
    }
  } catch (e) {
    console.error('True Merit export failed:', e);
    toast('Could not generate the annual export. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Generate & Download JSON'; }
  }
}

// ── CHAPTER ACHIEVEMENTS (feeds awards_and_achievements) ──
// Deliberately minimal per Part 19 — a flat, chapter-entered list, same CRUD shape as every other
// simple array-backed module in this app (e.g. Officer Transition Hub's issues list). Lives on
// Settings (lead-only, same as the True Merit action itself) rather than a new standalone page.
function tmRenderAchievements() {
  const el = document.getElementById('tm-achievements-list');
  if (!el) return;
  const items = [...(D.achievements || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  el.innerHTML = items.length ? items.map(a => `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--bdr)">
      <i class="ti ti-award" style="font-size:14px;color:var(--gold-tx);margin-top:2px;flex-shrink:0"></i>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:500">${esc(a.title)}</div>
        <div style="font-size:10.5px;color:var(--mt)">${esc(a.category || 'Achievement')}${a.date ? ' · ' + fds(a.date) : ''}</div>
      </div>
      <button class="ib" style="width:26px;height:26px;font-size:11px;color:var(--ht)" onclick="tmDeleteAchievement('${a.id}')" aria-label="Delete achievement ${esc(a.title)}" title="Delete"><i class="ti ti-x"></i></button>
    </div>`).join('') : '<div style="color:var(--ht);font-size:12px;padding:8px 0">No achievements recorded yet.</div>';
}

async function tmAddAchievement() {
  if (!tmCanGenerateReport()) { toast('Only the President or Vice President can record chapter achievements.', 'error'); return; }
  const title = document.getElementById('tma-title').value.trim();
  if (!title) { toast('Title is required', 'error'); return; }
  const achievement = {
    id: uid(), title,
    category: document.getElementById('tma-category').value || 'Chapter Achievement',
    date: document.getElementById('tma-date').value || localDateStr(),
    description: document.getElementById('tma-desc').value.trim(),
    semester: getSemester(),
  };
  if (!D.achievements) D.achievements = [];
  D.achievements.push(achievement);
  try {
    await saveD('achievements');
    closeM(null, document.getElementById('m-add-achievement'));
    ['tma-title', 'tma-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    tmRenderAchievements();
    toast('Achievement added', 'success');
  } catch (e) {
    D.achievements = D.achievements.filter(a => a.id !== achievement.id);
    toast('Failed to save achievement. Please try again.', 'error');
  }
}

async function tmDeleteAchievement(id) {
  if (!tmCanGenerateReport()) { toast('Only the President or Vice President can remove chapter achievements.', 'error'); return; }
  const removed = (D.achievements || []).find(a => a.id === id);
  const ok = await confirmDialog('Delete Achievement', `Remove "${removed ? removed.title : 'this achievement'}"?`);
  if (!ok) return;
  D.achievements = (D.achievements || []).filter(a => a.id !== id);
  try {
    await saveD('achievements');
    tmRenderAchievements();
    toast('Achievement removed', 'info');
  } catch (e) {
    if (removed) D.achievements.push(removed);
    toast('Failed to remove achievement. Please try again.', 'error');
  }
}

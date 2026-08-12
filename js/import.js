// ══════════════════════════════════════════════
// CSV IMPORT — MEMBERS & GRADES
// ══════════════════════════════════════════════

let _importType = null; // 'members' | 'grades' | 'positionGoals' | 'bylaws' | 'committeeProgram' | 'bibleStudyProgram' | 'bibleStudyChapters'
let _importRows = [];   // parsed rows staged for commit
let _lastCsvText = null; // cached for update-mode toggle re-parse
// Which committee a 'committeeProgram' import targets — set by coOpenImportProgram() (js/committees.js)
// just before calling openImportModal('committeeProgram'). Unlike every other import type, this one
// isn't chapter-singleton (there are many committees), so the modal needs to know which one.
let _importCommitteeId = null;

// ── ENTRY POINTS ──

function openImportModal(type) {
  // Each import type writes to a different Firestore key with its own permission —
  // members/grades are position-gated (members, academics); positionGoals and bylaws are both
  // lead-only (positionGoals since each CSV row can name any position with no per-row ownership
  // check, unlike the New Task/Add Goal modals which are scoped to the officer's own position;
  // bylaws rides on 'settings', same as the Judicial Board page gate).
  // committeeProgram is scoped to whichever committee _importCommitteeId names — a committee's
  // own Chair can import its program even without chapter-wide Committees access (mirrors the
  // rest of that committee-leader permission path in js/committees.js). bibleStudyProgram is
  // chapter-wide (one program, not per-committee), gated the same as the Chaplain Hub page itself.
  const allowed = type === 'members' ? canEditPage('members')
    : type === 'grades' ? acCanAccess()
    : type === 'bylaws' ? isLeadUser()
    // Each CSV row can name an arbitrary Position column with no per-row ownership check —
    // restricted to leads only (same tier as Bylaws above) so it can't be used to bulk-create
    // goals for positions the importer doesn't hold, bypassing Tasks & Goals' position scoping.
    : type === 'positionGoals' ? isLeadUser()
    : type === 'committeeProgram' ? (typeof canEditCommittee === 'function' && D.committees.find(c => c.id === _importCommitteeId) && canEditCommittee(D.committees.find(c => c.id === _importCommitteeId)))
    : type === 'bibleStudyProgram' ? (typeof canEditRitual === 'function' && canEditRitual())
    : type === 'bibleStudyChapters' ? (typeof bsFull === 'function' && bsFull())
    : type === 'alumni' ? canEditPage('alumni')
    : canWrite();
  if (!allowed) { toast('You do not have permission to import this data.', 'error'); return; }
  _importType = type;
  _importRows = [];
  const titles = { members: 'Import Members', grades: 'Import Grades', positionGoals: 'Import Goal Sheet', bylaws: 'Import Bylaws', committeeProgram: 'Import Committee Program', bibleStudyProgram: 'Import Bible Study Program', bibleStudyChapters: 'Import Bible Study Program', alumni: 'Import Alumni Directory' };
  const instructions = {
    members: `Upload a CSV with these columns (header row required):<br><strong>Name</strong> (required), <em>Grad Year</em>, <em>Class Year</em>, <em>Role</em>, <em>Live In</em>, <em>Major</em>, <em>Email</em>, <em>Phone</em>, <em>Hometown</em><br><span style="color:var(--ht)">Toggle "Update existing members" below to overwrite info for names already in the roster.</span>`,
    grades:  `Upload a CSV with these columns (header row required):<br><strong>Name</strong> (required), <em>Cumulative GPA</em>, <em>Semester GPA</em><br><span style="color:var(--ht)">Members must already exist in the roster. Unmatched names are skipped.</span>`,
    positionGoals: `Upload a CSV with these columns (header row required):<br><strong>Position</strong> (required, must match one of this chapter's officer titles), <strong>Title</strong> (required), <em>Target</em>, <em>Current</em>, <em>Unit</em><br><span style="color:var(--ht)">One row per semester goal. Rows with a Position that doesn't match a real officer title are skipped.</span>`,
    bylaws:  `Upload a CSV with these columns (header row required):<br><strong>Article</strong> (required), <em>Section</em>, <strong>Content</strong> (required, HTML supported e.g. &lt;strong&gt;, &lt;ul&gt;&lt;li&gt;)<br><span style="color:var(--ht)">One row per section. Rows sharing the same Article are combined into one bylaw article, in the order they appear. This replaces your chapter's entire Bylaws section.</span>`,
    committeeProgram: `Upload a CSV with these columns (header row required):<br><strong>Week</strong>, <strong>Topic</strong> (required), <em>Notes</em><br><span style="color:var(--ht)">One row per week/session of this committee's program. This replaces this committee's entire program. Other committees are unaffected.</span>`,
    bibleStudyProgram: `Upload a CSV with these columns (header row required):<br><strong>Week</strong>, <strong>Topic</strong> (required), <em>Notes</em>, <em>Understanding</em>, <em>Discussion</em><br><span style="color:var(--ht)">One row per week of the Bible study curriculum. Understanding and Discussion are optional, longer-form fields shown in each week's click-through detail view. Use &lt;br&gt; for line breaks instead of a literal line break inside the cell. This replaces the chapter's entire Bible Study Program.</span>`,
    bibleStudyChapters: `Upload a CSV with these columns (header row required):<br><strong>Week</strong>, <strong>Topic</strong> (required), <em>Notes</em>, <em>PassageToRead</em>, <em>LeaderSummary</em>, <em>GroupDiscussionFocus</em>, <em>LeaderPageRange</em>, <em>DiscussionPageRange</em>, <em>ExpectedPdfFilename</em>, <em>EstimatedPreparationMinutes</em>, <em>EstimatedSessionMinutes</em><br><span style="color:var(--ht)">One row per chapter. Only Week and Topic are required. This updates matching chapters in place by week number (PDFs, schedules, attendance, and notes on other chapters are never touched). The chapter PDF itself is uploaded separately via Manage Chapter PDFs, not through this CSV.</span>`,
    alumni: `Upload a CSV with these columns (header row required):<br><strong>Name</strong> (required), <em>Number</em>, <em>Email</em>, <em>Initiation Date</em><br><span style="color:var(--ht)">Adds new alumni to the directory. Rows whose name already matches someone in the directory are skipped: industry, current location, and LinkedIn can be filled in afterward from the directory table.</span>`,
  };
  document.getElementById('imp-title').textContent = titles[type] || 'Import';
  document.getElementById('imp-instructions').innerHTML = instructions[type] || '';
  document.getElementById('imp-preview').innerHTML = '';
  document.getElementById('imp-commit').style.display = 'none';
  document.getElementById('imp-file').value = '';
  document.getElementById('imp-fname').textContent = '';
  _lastCsvText = null;
  const toggleDiv = document.getElementById('imp-update-toggle');
  if (toggleDiv) toggleDiv.style.display = type === 'members' ? '' : 'none';
  const updateCb = document.getElementById('imp-update-mode');
  if (updateCb) updateCb.checked = false;
  openM('m-import');
}

// ── FILE INPUT HANDLER ──

function impHandleFile(input) {
  const file = input.files[0];
  if (!file) return;
  const fnEl = document.getElementById('imp-fname');
  if (fnEl) fnEl.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => { _lastCsvText = e.target.result; impPreview(_lastCsvText); };
  reader.readAsText(file);
}

// ── CSV PARSING ──

function impParseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = impSplitLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z ]/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = impSplitLine(lines[i]);
    if (vals.every(v => !v.trim())) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function impSplitLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function impCol(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
}

function impNormClassYear(val) {
  const v = (val || '').trim().toLowerCase();
  if (v.startsWith('se')) return 'Senior';
  if (v.startsWith('ju')) return 'Junior';
  if (v.startsWith('so')) return 'Sophomore';
  if (v.startsWith('fr')) return 'Freshman';
  return 'Junior';
}

// Normalizes a free-text date cell (spreadsheets export "9/15/2020", "Sept 15, 2020", etc.) to
// the YYYY-MM-DD shape every <input type="date"> in this app expects — without this, a value
// that survives into the record verbatim can't be displayed by a date input (silently blanks)
// and breaks fds()'s "<date>T12:00:00" parsing (renders the literal string "Invalid Date").
function impNormDate(val) {
  const v = (val || '').trim();
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function impClassYearFromGradYear(gradYear) {
  const yr = parseInt(gradYear);
  if (!yr) return 'Junior';
  const now = new Date().getFullYear();
  const diff = yr - now;
  if (diff <= 1) return 'Senior';
  if (diff === 2) return 'Junior';
  if (diff === 3) return 'Sophomore';
  return 'Freshman';
}

// ── PREVIEW ──

function impPreview(text) {
  const { rows } = impParseCSV(text);
  const preview = document.getElementById('imp-preview');
  const commitBtn = document.getElementById('imp-commit');

  if (!rows.length) {
    preview.innerHTML = `<div style="color:var(--rd);font-size:12px;padding:8px 0">No data rows found. Make sure the file has a header row and at least one data row.</div>`;
    commitBtn.style.display = 'none';
    return;
  }

  _importRows = _importType === 'members' ? impBuildMemberRows(rows, preview)
    : _importType === 'positionGoals' ? impBuildPositionGoalRows(rows, preview)
    : _importType === 'bylaws' ? impBuildBylawRows(rows, preview)
    : (_importType === 'committeeProgram' || _importType === 'bibleStudyProgram') ? impBuildWeeklyProgramRows(rows, preview)
    : _importType === 'bibleStudyChapters' ? impBuildBsChapterRows(rows, preview)
    : _importType === 'alumni' ? impBuildAlumniRows(rows, preview)
    : impBuildGradeRows(rows, preview);

  if (_importRows.length > 0) {
    commitBtn.style.display = '';
    commitBtn.textContent = `Import ${_importRows.length} Record${_importRows.length !== 1 ? 's' : ''}`;
  } else {
    commitBtn.style.display = 'none';
  }
}

function impToggleUpdate() {
  if (_lastCsvText) impPreview(_lastCsvText);
}

function impBuildMemberRows(rows, previewEl) {
  const updateMode = document.getElementById('imp-update-mode')?.checked;
  const toAdd = [], toUpdate = [], skipped = [];

  rows.forEach(row => {
    const name = impCol(row, 'name', 'full name', 'member name');
    if (!name) { skipped.push('(blank name)'); return; }
    const existing = D.members.find(m => m.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (existing && !updateMode) { skipped.push(name + ': already in roster'); return; }
    const gradYearRaw = impCol(row, 'grad year', 'graduation year', 'grad', 'graduation');
    const classYearRaw = impCol(row, 'class year', 'class', 'year in school', 'standing', 'academic year');
    const classYear = classYearRaw ? impNormClassYear(classYearRaw)
      : (gradYearRaw ? impClassYearFromGradYear(gradYearRaw) : existing ? existing.classYear : 'Junior');
    const role = impCol(row, 'role', 'position', 'title', 'officer') || (existing ? existing.role : 'Member');
    const liveInRaw = impCol(row, 'live in', 'lives in', 'livein', 'house resident', 'in house');
    const liveIn = liveInRaw ? /^(yes|true|1|y)$/i.test(liveInRaw.trim()) : (existing ? existing.liveIn : false);
    const major = impCol(row, 'major', 'field of study', 'program', 'concentration') || (existing ? existing.major||'' : '');
    const email = impCol(row, 'email', 'email address', 'e-mail') || (existing ? existing.email||'' : '');
    const phone = impCol(row, 'phone', 'phone number', 'cell', 'mobile', 'telephone') || (existing ? existing.phone||'' : '');
    const hometown = impCol(row, 'hometown', 'home town', 'home city', 'city', 'from') || (existing ? existing.hometown||'' : '');
    const ini = name.split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
    const gradYear = gradYearRaw ? +gradYearRaw : (existing ? existing.year : new Date().getFullYear() + 2);
    if (existing) {
      toUpdate.push({ _update: true, id: existing.id, name, year: gradYear, classYear, liveIn, role, initials: ini, major, email, phone, hometown });
    } else {
      toAdd.push({ id: uid(), name, year: gradYear, classYear, liveIn, role, initials: ini, major, email, phone, hometown });
    }
  });

  const th = `<thead><tr style="background:var(--surf2)"><th style="padding:5px 8px;text-align:left">Name</th><th style="padding:5px 8px;text-align:left">Major</th><th style="padding:5px 8px;text-align:left">Email</th><th style="padding:5px 8px;text-align:left">Class</th><th style="padding:5px 8px;text-align:left">Role</th></tr></thead>`;
  let html = '';
  if (toUpdate.length) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--navy);margin-bottom:6px">${toUpdate.length} member${toUpdate.length !== 1 ? 's' : ''} to update:</div>`;
    html += `<div style="max-height:150px;overflow-y:auto;border:1px solid var(--bdr);border-radius:7px;margin-bottom:10px"><table style="width:100%;border-collapse:collapse;font-size:11.5px">${th}<tbody>`;
    toUpdate.forEach((m, i) => {
      const bg = i % 2 === 0 ? 'var(--surf)' : 'var(--surf2)';
      html += `<tr style="background:${bg}"><td style="padding:5px 8px">${esc(m.name)}</td><td style="padding:5px 8px">${esc(m.major||'N/A')}</td><td style="padding:5px 8px;font-size:10.5px">${esc(m.email||'N/A')}</td><td style="padding:5px 8px">${esc(m.classYear)}</td><td style="padding:5px 8px">${esc(m.role)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }
  if (toAdd.length) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--gn);margin-bottom:6px">${toAdd.length} new member${toAdd.length !== 1 ? 's' : ''} to add:</div>`;
    html += `<div style="max-height:150px;overflow-y:auto;border:1px solid var(--bdr);border-radius:7px"><table style="width:100%;border-collapse:collapse;font-size:11.5px">${th}<tbody>`;
    toAdd.forEach((m, i) => {
      const bg = i % 2 === 0 ? 'var(--surf)' : 'var(--surf2)';
      html += `<tr style="background:${bg}"><td style="padding:5px 8px">${esc(m.name)}</td><td style="padding:5px 8px">${esc(m.major||'N/A')}</td><td style="padding:5px 8px;font-size:10.5px">${esc(m.email||'N/A')}</td><td style="padding:5px 8px">${esc(m.classYear)}</td><td style="padding:5px 8px">${esc(m.role)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }
  if (skipped.length) {
    html += `<div style="font-size:11.5px;color:var(--ht);margin-top:8px"><strong>${skipped.length} skipped:</strong> ${skipped.map(s => esc(s)).join('; ')}</div>`;
  }
  previewEl.innerHTML = html;
  return [...toUpdate, ...toAdd];
}

function impBuildGradeRows(rows, previewEl) {
  const toUpdate = [], skipped = [];
  const membersByName = {};
  D.members.forEach(m => { membersByName[m.name.toLowerCase().trim()] = m; });

  rows.forEach(row => {
    const name = impCol(row, 'name', 'full name', 'member name', 'member');
    if (!name) { skipped.push('(blank name)'); return; }
    const member = membersByName[name.toLowerCase().trim()];
    if (!member) { skipped.push(name + ': not in roster'); return; }
    const cumRaw = impCol(row, 'cumulative gpa', 'cumulative', 'cum gpa', 'gpa', 'overall gpa', 'cgpa');
    const semRaw = impCol(row, 'semester gpa', 'semester', 'sem gpa', 'prior gpa', 'term gpa', 'last semester', 'sgpa');
    const cumGpa = cumRaw ? parseFloat(cumRaw) : NaN;
    const semGpa = semRaw ? parseFloat(semRaw) : NaN;
    if (isNaN(cumGpa) && isNaN(semGpa)) { skipped.push(name + ': no valid GPA values'); return; }
    toUpdate.push({ member, cumGpa: isNaN(cumGpa) ? null : cumGpa, semGpa: isNaN(semGpa) ? null : semGpa });
  });

  let html = '';
  if (toUpdate.length) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--gn);margin-bottom:6px">${toUpdate.length} member${toUpdate.length !== 1 ? 's' : ''} to update:</div>`;
    html += `<div style="max-height:180px;overflow-y:auto;border:1px solid var(--bdr);border-radius:7px"><table style="width:100%;border-collapse:collapse;font-size:11.5px">`;
    html += `<thead><tr style="background:var(--surf2)"><th style="padding:5px 8px;text-align:left">Name</th><th style="padding:5px 8px;text-align:left">Cumulative GPA</th><th style="padding:5px 8px;text-align:left">Semester GPA</th></tr></thead><tbody>`;
    toUpdate.forEach((u, i) => {
      const bg = i % 2 === 0 ? 'var(--surf)' : 'var(--surf2)';
      html += `<tr style="background:${bg}"><td style="padding:5px 8px">${esc(u.member.name)}</td><td style="padding:5px 8px">${u.cumGpa !== null ? u.cumGpa.toFixed(2) : 'N/A'}</td><td style="padding:5px 8px">${u.semGpa !== null ? u.semGpa.toFixed(2) : 'N/A'}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }
  if (skipped.length) {
    html += `<div style="font-size:11.5px;color:var(--ht);margin-top:8px"><strong>${skipped.length} skipped:</strong> ${skipped.map(s => esc(s)).join('; ')}</div>`;
  }
  previewEl.innerHTML = html;
  return toUpdate;
}

function impBuildPositionGoalRows(rows, previewEl) {
  const toAdd = [], skipped = [];
  // Case-insensitive match against this chapter's real officer titles — a typo'd or made-up
  // Position isn't silently accepted, since the whole point of this import is one goal sheet
  // per position, and a goal nobody's position dropdown can find is worse than no goal at all.
  const titlesByLower = {};
  chapterPositionTitles().forEach(t => { titlesByLower[t.toLowerCase().trim()] = t; });

  rows.forEach((row, i) => {
    // 'title' is deliberately NOT a synonym for Position here (unlike the member-import position
    // column) — in this CSV shape it's the goal's own Title column, and the two must not collide.
    const positionRaw = impCol(row, 'position', 'officer', 'officer title', 'role');
    const position = positionRaw ? titlesByLower[positionRaw.toLowerCase().trim()] : null;
    if (!positionRaw) { skipped.push('Row ' + (i + 2) + ': blank position'); return; }
    if (!position) { skipped.push('Row ' + (i + 2) + ': "' + positionRaw + '" doesn\'t match a chapter position'); return; }
    const title = impCol(row, 'title', 'goal', 'goal title', 'task', 'name');
    if (!title) { skipped.push('Row ' + (i + 2) + ': blank goal title'); return; }
    const target = parseFloat(impCol(row, 'target', 'goal target')) || 0;
    const current = parseFloat(impCol(row, 'current', 'progress')) || 0;
    const unit = impCol(row, 'unit', 'units') || '';
    toAdd.push({ id: uid(), title, positionTitle: position, target, current, unit });
  });

  let html = '';
  if (toAdd.length) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--gn);margin-bottom:6px">${toAdd.length} goal${toAdd.length !== 1 ? 's' : ''} to import:</div>`;
    html += `<div style="max-height:200px;overflow-y:auto;border:1px solid var(--bdr);border-radius:7px"><table style="width:100%;border-collapse:collapse;font-size:11.5px">`;
    html += `<thead><tr style="background:var(--surf2)"><th style="padding:5px 8px;text-align:left">Position</th><th style="padding:5px 8px;text-align:left">Goal</th><th style="padding:5px 8px;text-align:left">Target</th></tr></thead><tbody>`;
    toAdd.forEach((g, i) => {
      const bg = i % 2 === 0 ? 'var(--surf)' : 'var(--surf2)';
      html += `<tr style="background:${bg}"><td style="padding:5px 8px;font-weight:500">${esc(g.positionTitle)}</td><td style="padding:5px 8px;color:var(--mt)">${esc(g.title)}</td><td style="padding:5px 8px;color:var(--mt)">${g.current}/${g.target} ${esc(g.unit)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }
  if (skipped.length) {
    html += `<div style="font-size:11.5px;color:var(--ht);margin-top:8px"><strong>${skipped.length} skipped:</strong> ${skipped.map(s => esc(s)).join('; ')}</div>`;
  }
  previewEl.innerHTML = html;
  return toAdd;
}

function impBuildBylawRows(rows, previewEl) {
  // One row per Section, grouped into one bylaw article per unique Article value (preserving
  // first-seen order) — an article with multiple sections is just multiple rows sharing the
  // same Article column value.
  const order = [], byArticle = {}, skipped = [];
  rows.forEach((row, i) => {
    const article = impCol(row, 'article', 'article title', 'title');
    if (!article) { skipped.push('Row ' + (i + 2) + ': blank article'); return; }
    const section = impCol(row, 'section', 'sec');
    const content = impCol(row, 'content', 'body', 'text');
    if (!content) { skipped.push(article + (section ? ' ' + section : '') + ': blank content'); return; }
    if (!byArticle[article]) { byArticle[article] = []; order.push(article); }
    byArticle[article].push(section ? `<p><strong>${esc(section)}</strong> ${content}</p>` : `<p>${content}</p>`);
  });
  const arts = order.map(t => ({ t, b: byArticle[t].join('') }));

  let html = '';
  if (arts.length) {
    const sectionCount = rows.length - skipped.length;
    html += `<div style="font-size:12px;font-weight:600;color:var(--rd);margin-bottom:6px">This will replace all current bylaw articles with ${arts.length} imported article${arts.length !== 1 ? 's' : ''} (${sectionCount} section${sectionCount !== 1 ? 's' : ''} total):</div>`;
    html += `<div style="max-height:220px;overflow-y:auto;border:1px solid var(--bdr);border-radius:7px">`;
    arts.forEach((a, i) => {
      const bg = i % 2 === 0 ? 'var(--surf)' : 'var(--surf2)';
      const n = byArticle[a.t].length;
      html += `<div style="padding:7px 10px;background:${bg};border-bottom:1px solid var(--bdr);font-size:11.5px;font-weight:500">${esc(a.t)} <span style="color:var(--mt);font-weight:400">(${n} section${n !== 1 ? 's' : ''})</span></div>`;
    });
    html += `</div>`;
  }
  if (skipped.length) {
    html += `<div style="font-size:11.5px;color:var(--ht);margin-top:8px"><strong>${skipped.length} skipped:</strong> ${skipped.map(s => esc(s)).join('; ')}</div>`;
  }
  previewEl.innerHTML = html;
  return arts;
}

function impBuildWeeklyProgramRows(rows, previewEl) {
  // Full replace, like bylaws — this is meant to be the one authoritative program for the
  // committee/study it's imported into, not an incrementally-appended list. Understanding and
  // Discussion are optional, longer-form columns (used by Bible Study Program's per-week detail
  // view) — a plain Week/Topic/Notes CSV (Committee Program's shape) still works fine without
  // them, those two keys just come back as empty strings. Like Bylaws' Content column, embed
  // paragraph breaks with <br> rather than literal newlines — the CSV parser splits on newlines
  // before it looks at quoting, so a raw line break inside a cell would corrupt the row.
  const toAdd = [], skipped = [];
  rows.forEach((row, i) => {
    const topic = impCol(row, 'topic', 'theme', 'title');
    if (!topic) { skipped.push('Row ' + (i + 2) + ': blank topic'); return; }
    const weekRaw = impCol(row, 'week', 'week number', 'wk');
    const week = parseInt(weekRaw) || (toAdd.length + 1);
    const notes = impCol(row, 'notes', 'description');
    const understanding = impCol(row, 'understanding', 'leader prep', 'leader notes', 'background');
    const discussion = impCol(row, 'discussion', 'discussion guide', 'discussion points', 'talking points');
    toAdd.push({ id: uid(), week, topic, notes, understanding, discussion });
  });
  toAdd.sort((a, b) => a.week - b.week);

  let html = '';
  if (toAdd.length) {
    const hasExtra = toAdd.some(a => a.understanding || a.discussion);
    html += `<div style="font-size:12px;font-weight:600;color:var(--rd);margin-bottom:6px">This will replace the current program with ${toAdd.length} week${toAdd.length !== 1 ? 's' : ''}${hasExtra ? ', including expanded content for each week' : ''}:</div>`;
    html += `<div style="max-height:220px;overflow-y:auto;border:1px solid var(--bdr);border-radius:7px"><table style="width:100%;border-collapse:collapse;font-size:11.5px">`;
    html += `<thead><tr style="background:var(--surf2)"><th style="padding:5px 8px;text-align:left">Week</th><th style="padding:5px 8px;text-align:left">Topic</th><th style="padding:5px 8px;text-align:left">Notes</th></tr></thead><tbody>`;
    toAdd.forEach((a, i) => {
      const bg = i % 2 === 0 ? 'var(--surf)' : 'var(--surf2)';
      html += `<tr style="background:${bg}"><td style="padding:5px 8px;font-weight:600">${a.week}</td><td style="padding:5px 8px;font-weight:500">${esc(a.topic)}</td><td style="padding:5px 8px;color:var(--mt)">${esc(a.notes||'N/A')}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }
  if (skipped.length) {
    html += `<div style="font-size:11.5px;color:var(--ht);margin-top:8px"><strong>${skipped.length} skipped:</strong> ${skipped.map(s => esc(s)).join('; ')}</div>`;
  }
  previewEl.innerHTML = html;
  return toAdd;
}

// Bible Study Program (js/biblestudy.js, D.bibleStudyCurriculum) — unlike every other import
// type here, this one updates existing chapter records in place by week number rather than
// doing a full-array replace, since a chapter can already carry an uploaded PDF, a schedule,
// attendance history, and private notes by the time someone re-imports a corrected CSV. Only
// Week and Topic are required; every other column is optional and only overwrites a field when
// present in the row (blank cells leave the existing value alone). The chapter PDF itself is
// never touched by this importer — that's a separate upload flow (Manage Chapter PDFs).
function impBuildBsChapterRows(rows, previewEl) {
  const toAdd = [], skipped = [];
  rows.forEach((row, i) => {
    const topic = impCol(row, 'topic', 'title');
    if (!topic) { skipped.push('Row ' + (i + 2) + ': blank topic'); return; }
    const weekRaw = impCol(row, 'week', 'week number', 'wk');
    const week = parseInt(weekRaw);
    if (!week) { skipped.push('Row ' + (i + 2) + ': blank or invalid week'); return; }
    const prepMinRaw = impCol(row, 'estimatedpreparationminutes', 'estimated preparation minutes', 'prep minutes');
    const sessMinRaw = impCol(row, 'estimatedsessionminutes', 'estimated session minutes', 'session minutes');
    toAdd.push({
      week, topic,
      notes: impCol(row, 'notes', 'summary', 'description'),
      passageToRead: impCol(row, 'passagetoread', 'passage to read', 'passage'),
      leaderSummary: impCol(row, 'leadersummary', 'leader summary', 'understanding'),
      groupDiscussionFocus: impCol(row, 'groupdiscussionfocus', 'group discussion focus', 'discussion'),
      leaderPageRange: impCol(row, 'leaderpagerange', 'leader page range', 'leader pages'),
      discussionPageRange: impCol(row, 'discussionpagerange', 'discussion page range', 'discussion pages'),
      expectedPdfFilename: impCol(row, 'expectedpdffilename', 'expected pdf filename', 'pdf filename', 'filename'),
      estimatedPreparationMinutes: parseInt(prepMinRaw) || null,
      estimatedSessionMinutes: parseInt(sessMinRaw) || null
    });
  });
  toAdd.sort((a, b) => a.week - b.week);

  let html = '';
  if (toAdd.length) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--rd);margin-bottom:6px">This will update ${toAdd.length} chapter${toAdd.length !== 1 ? 's' : ''} by week number. Chapters not listed here, and every chapter's PDF/schedule/attendance/private notes, are left untouched:</div>`;
    html += `<div style="max-height:220px;overflow-y:auto;border:1px solid var(--bdr);border-radius:7px"><table style="width:100%;border-collapse:collapse;font-size:11.5px">`;
    html += `<thead><tr style="background:var(--surf2)"><th style="padding:5px 8px;text-align:left">Week</th><th style="padding:5px 8px;text-align:left">Topic</th><th style="padding:5px 8px;text-align:left">Notes</th></tr></thead><tbody>`;
    toAdd.forEach((a, i) => {
      const bg = i % 2 === 0 ? 'var(--surf)' : 'var(--surf2)';
      html += `<tr style="background:${bg}"><td style="padding:5px 8px;font-weight:600">${a.week}</td><td style="padding:5px 8px;font-weight:500">${esc(a.topic)}</td><td style="padding:5px 8px;color:var(--mt)">${esc(a.notes || 'N/A')}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }
  if (skipped.length) {
    html += `<div style="font-size:11.5px;color:var(--ht);margin-top:8px"><strong>${skipped.length} skipped:</strong> ${skipped.map(s => esc(s)).join('; ')}</div>`;
  }
  previewEl.innerHTML = html;
  return toAdd;
}

// Alumni Directory (js/alumni.js, D.alumni.contacts) — add-only, like Members import without
// update mode: industry, current location, and LinkedIn aren't in this CSV shape at all (those
// stay manual, filled in per-alumni from the directory table after import), so re-importing the
// same roster would only ever create blanks for those fields, never overwrite what's there. Rows
// whose name already matches an existing contact are skipped rather than silently duplicated.
function impBuildAlumniRows(rows, previewEl) {
  const toAdd = [], skipped = [];
  const existingNames = new Set(D.alumni.contacts.map(a => a.name.toLowerCase().trim()));
  rows.forEach((row, i) => {
    const name = impCol(row, 'name', 'full name', 'alumni name');
    if (!name) { skipped.push('Row ' + (i + 2) + ': blank name'); return; }
    if (existingNames.has(name.toLowerCase().trim())) { skipped.push(name + ': already in directory'); return; }
    const phone = impCol(row, 'number', 'phone', 'phone number', 'cell', 'mobile');
    const email = impCol(row, 'email', 'email address', 'e-mail');
    const initiationDate = impNormDate(impCol(row, 'initiation date', 'initiationdate', 'initiated', 'date initiated'));
    toAdd.push({ id: uid(), name, phone, email, initiationDate, employer: '', industry: '', location: '', linkedin: '', notes: '' });
    existingNames.add(name.toLowerCase().trim());
  });

  let html = '';
  if (toAdd.length) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--gn);margin-bottom:6px">${toAdd.length} alumni to add:</div>`;
    html += `<div style="max-height:220px;overflow-y:auto;border:1px solid var(--bdr);border-radius:7px"><table style="width:100%;border-collapse:collapse;font-size:11.5px">`;
    html += `<thead><tr style="background:var(--surf2)"><th style="padding:5px 8px;text-align:left">Name</th><th style="padding:5px 8px;text-align:left">Email</th><th style="padding:5px 8px;text-align:left">Phone</th><th style="padding:5px 8px;text-align:left">Initiation Date</th></tr></thead><tbody>`;
    toAdd.forEach((a, i) => {
      const bg = i % 2 === 0 ? 'var(--surf)' : 'var(--surf2)';
      html += `<tr style="background:${bg}"><td style="padding:5px 8px;font-weight:500">${esc(a.name)}</td><td style="padding:5px 8px;font-size:10.5px">${esc(a.email || 'N/A')}</td><td style="padding:5px 8px">${esc(a.phone || 'N/A')}</td><td style="padding:5px 8px">${esc(a.initiationDate || 'N/A')}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }
  if (skipped.length) {
    html += `<div style="font-size:11.5px;color:var(--ht);margin-top:8px"><strong>${skipped.length} skipped:</strong> ${skipped.map(s => esc(s)).join('; ')}</div>`;
  }
  previewEl.innerHTML = html;
  return toAdd;
}

// ── COMMIT ──

async function doImport() {
  if (!_importRows.length) return;
  const commitBtn = document.getElementById('imp-commit');
  commitBtn.disabled = true;
  commitBtn.textContent = 'Importing…';
  try {
    if (_importType === 'members') {
      const toAdd = _importRows.filter(m => !m._update);
      const toUpdate = _importRows.filter(m => m._update);
      toAdd.forEach(m => D.members.push(m));
      toUpdate.forEach(u => {
        const ex = D.members.find(m => m.id === u.id);
        if (ex) { const {_update, ...fields} = u; Object.assign(ex, fields); }
      });
      await saveD('members');
      renderMembers();
      const parts = []; if (toAdd.length) parts.push(`${toAdd.length} added`); if (toUpdate.length) parts.push(`${toUpdate.length} updated`);
      toast(`Members: ${parts.join(', ')}`, 'success');
    } else if (_importType === 'positionGoals') {
      if (!D.goals) D.goals = [];
      _importRows.forEach(g => D.goals.push(g));
      await saveD('goals');
      renderTasks();
      toast(`${_importRows.length} goal${_importRows.length !== 1 ? 's' : ''} imported`, 'success');
    } else if (_importType === 'bylaws') {
      if (!D.settings) D.settings = {};
      D.settings.bylaws = _importRows;
      await saveD('settings');
      renderBylaws();
      toast(`Bylaws replaced with ${_importRows.length} imported article${_importRows.length !== 1 ? 's' : ''}`, 'success');
    } else if (_importType === 'committeeProgram') {
      const c = D.committees.find(c => c.id === _importCommitteeId);
      if (!c) throw new Error('Committee not found');
      c.program = _importRows;
      await saveD('committees');
      if (typeof coRenderProgramTable === 'function') coRenderProgramTable(c);
      if (typeof renderCommittees === 'function') renderCommittees();
      toast(`${c.name} program replaced with ${_importRows.length} week${_importRows.length !== 1 ? 's' : ''}`, 'success');
    } else if (_importType === 'bibleStudyProgram') {
      D.chaplainHub.bibleStudyProgram = _importRows;
      await saveD('chaplainHub');
      toast(`Bible Study Program replaced with ${_importRows.length} week${_importRows.length !== 1 ? 's' : ''}`, 'success');
    } else if (_importType === 'bibleStudyChapters') {
      if (!D.bibleStudyCurriculum) D.bibleStudyCurriculum = { title: 'Bible Study Program', subtitle: '', source: { name: '', organization: '', attribution: '' }, schemaVersion: 1, chapters: [] };
      let updated = 0, created = 0;
      _importRows.forEach(row => {
        let c = D.bibleStudyCurriculum.chapters.find(x => x.weekNumber === row.week);
        if (!c) {
          c = (typeof bscBlankChapter === 'function')
            ? bscBlankChapter({ weekNumber: row.week, title: row.topic })
            : { id: uid(), weekNumber: row.week, title: row.topic, topic: row.topic, status: 'not_started', preparationChecklist: [], sessions: [], pdf: null, archived: false };
          D.bibleStudyCurriculum.chapters.push(c);
          created++;
        } else {
          updated++;
        }
        c.title = row.topic; c.topic = row.topic;
        if (row.notes) c.summary = row.notes;
        if (row.passageToRead) { c.passageToRead = row.passageToRead; c.scripturePassages = row.passageToRead; }
        if (row.leaderSummary) c.leaderSummary = row.leaderSummary;
        if (row.groupDiscussionFocus) c.groupDiscussionFocus = row.groupDiscussionFocus;
        if (row.leaderPageRange) c.leaderPageRange = row.leaderPageRange;
        if (row.discussionPageRange) c.discussionPageRange = row.discussionPageRange;
        if (row.expectedPdfFilename) c.expectedPdfFilename = row.expectedPdfFilename;
        if (row.estimatedPreparationMinutes) c.estimatedPreparationMinutes = row.estimatedPreparationMinutes;
        if (row.estimatedSessionMinutes) c.estimatedSessionMinutes = row.estimatedSessionMinutes;
      });
      await saveD('bibleStudyCurriculum');
      if (typeof bscRenderProgram === 'function') bscRenderProgram();
      const parts = [];
      if (updated) parts.push(`${updated} updated`);
      if (created) parts.push(`${created} created`);
      toast(`Bible Study Program: ${parts.join(', ')}`, 'success');
      const missingPdf = D.bibleStudyCurriculum.chapters.filter(c => !c.pdf && !c.archived).length;
      if (missingPdf) {
        setTimeout(() => toast(`${missingPdf} chapter${missingPdf !== 1 ? 's' : ''} still need a PDF. Open Manage Chapter PDFs to upload.`, 'warning', 7000), 400);
      }
    } else if (_importType === 'alumni') {
      _importRows.forEach(a => D.alumni.contacts.push(a));
      await saveD('alumni');
      renderAlumni();
      toast(`${_importRows.length} alumni added to the directory`, 'success');
    } else {
      if (!D.academics) D.academics = {};
      if (!D.academics.gpas) D.academics.gpas = {};
      _importRows.forEach(u => {
        const existing = D.academics.gpas[u.member.id] || {};
        if (u.cumGpa !== null) existing.cumulativeGpa = u.cumGpa;
        if (u.semGpa !== null) existing.priorGpa = u.semGpa;
        D.academics.gpas[u.member.id] = existing;
      });
      await saveD('academics');
      renderAcademics();
      toast(`Grades updated for ${_importRows.length} member${_importRows.length !== 1 ? 's' : ''}`, 'success');
    }
    closeM(null, document.getElementById('m-import'));
  } catch(e) {
    toast('Import failed. Please try again.', 'error');
    commitBtn.disabled = false;
    commitBtn.textContent = `Import ${_importRows.length} Record${_importRows.length !== 1 ? 's' : ''}`;
  }
}

// ── TEMPLATE DOWNLOAD ──

function impDownloadTemplate(type) {
  let csv, filename;
  if (type === 'members') {
    csv = 'Name,Grad Year,Class Year,Role,Live In,Major,Email,Phone,Hometown\nJohn Smith,2026,Senior,President,Yes,Finance,jsmith@iastate.edu,515-555-0101,"Des Moines, IA"\nJane Doe,2027,Junior,Member,No,Marketing,jdoe@iastate.edu,515-555-0102,"Ames, IA"';
    filename = 'members_template.csv';
  } else if (type === 'sober') {
    csv = 'Thursday Date,Thu Event,Thu Members,Fri Event,Fri Members,Sat Event,Sat Members\n2026-09-03,,John Smith;Jane Doe,,John Smith;Jane Doe,Bid Day,John Smith;Jane Doe;Alex Brown';
    filename = 'sober_schedule_template.csv';
  } else if (type === 'positionGoals') {
    csv = 'Position,Title,Target,Current,Unit\n'
      + 'President,Chapter GPA above 3.2,3.2,3.05,GPA\n'
      + 'Treasurer,Collect dues on time,95,60,% paid\n'
      + 'Philanthropy,Raise funds for national philanthropy,5000,1200,dollars raised\n'
      + 'Social,Host social events this semester,6,2,events';
    filename = 'goal_sheet_template.csv';
  } else if (type === 'bylaws') {
    // Blank on purpose — headers only, no pre-filled articles/content, since bylaws vary
    // chapter to chapter and shouldn't nudge anyone toward reusing someone else's wording.
    csv = 'Article,Section,Content';
    filename = 'bylaws_template.csv';
  } else if (type === 'committeeProgram') {
    csv = 'Week,Topic,Notes\n'
      + '1,Kickoff & Goal Setting,Review this semester\'s goals and assign initial owners\n'
      + '2,Planning Session,Break the semester goal into concrete action items\n'
      + '3,Progress Check-In,Status update from each member on their action items\n'
      + '4,Event/Initiative Execution,Run the planned event or initiative\n'
      + '5,Wrap-Up & Handoff Notes,Debrief what worked and document for next semester\'s chair';
    filename = 'committee_program_template.csv';
  } else if (type === 'bibleStudyProgram') {
    csv = 'Week,Topic,Notes,Understanding,Discussion\n'
      + '1,Faith & Brotherhood,Proverbs 27:17: how brothers sharpen each other,'
      + '"Iron sharpening iron is a picture of mutual growth, not one-sided correction -- brotherhood only sharpens when both sides show up honestly.",'
      + '"What does it look like for a brother to sharpen you, specifically? Where have you let a friendship go dull instead?"\n'
      + '2,Forgiveness,Matthew 18:21-22: dealing with conflict in the chapter,'
      + '"Peter\'s question assumes a limit; Jesus answers with a number that removes the limit -- forgiveness in community is a posture, not a tally."'
      + ',"Is there someone in the chapter you\'re still keeping score with? What would it cost to let that go?"\n'
      + '3,Servant Leadership,Mark 10:42-45: leading by serving others,,\n'
      + '4,Integrity,Proverbs 10:9: walking with integrity on and off campus,,\n'
      + '5,Gratitude,1 Thessalonians 5:16-18: practicing gratitude under pressure,,';
    filename = 'bible_study_program_template.csv';
  } else if (type === 'bibleStudyChapters') {
    csv = 'Week,Topic,Notes,PassageToRead,LeaderSummary,GroupDiscussionFocus,LeaderPageRange,DiscussionPageRange,ExpectedPdfFilename,EstimatedPreparationMinutes,EstimatedSessionMinutes\n'
      + '1,"God\'s Design","Creation, image and likeness, the fall, and the first Gospel","Genesis 1:1-13,14-15,26-27; 2:16-17; 3:1-6,15",'
      + '"Review creation, God\'s fatherhood, the serpent\'s strategy, and the New Adam","Discuss God\'s design, trust, sin, and hope",6-15,16-26,01_Gods_Design.pdf,45,60\n'
      + '2,"A New Creation","Cain vs. Seth, the flood as re-creation, Noah\'s fall","Genesis 4:17-24; 4:26-5:32; 6:1-3,8-10,11-13; 7:11-12; 9:20-27",,,,,02_A_New_Creation.pdf,45,60';
    filename = 'bible_study_program_chapters_template.csv';
  } else if (type === 'alumni') {
    csv = 'Name,Number,Email,Initiation Date\nJohn Smith,515-555-0101,jsmith@iastate.edu,2020-09-15\nJane Doe,515-555-0102,jdoe@iastate.edu,2019-09-20';
    filename = 'alumni_directory_template.csv';
  } else {
    csv = 'Name,Cumulative GPA,Semester GPA\nJohn Smith,3.45,3.20\nJane Doe,2.89,3.10';
    filename = 'grades_template.csv';
  }
  downloadCSV(filename, csv);
}

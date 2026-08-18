// ══════════════════════════════════════════════
// RECRUITMENT CALCULATIONS — single source of truth for every recruitment number shown anywhere
// in the app (Overview KPIs, funnel, pipeline board, season goal, alerts, reports, Chapter
// Intelligence). Pure functions only — no document/CURRENT_USER/D references — so this file is
// both a browser global (loaded before js/recruitment.js in index.html) and requireable under
// plain Node for tests, same pattern as js/truemerit.js's pure-function section.
//
// Definitions (see tests/recruitment-calc.test.js for the numbers these lock in):
//   Total Rushees      — every prospect in the array passed in (callers scope this to a
//                         semester/period first via rcVisibleRushees()).
//   Active Prospects   — prospects not yet Accepted. This pipeline has no "declined"/"rejected"
//                         stage (a prospect who doesn't continue is simply removed from the
//                         roster — see js/truemerit.js's bids_declined note), so "not yet
//                         Accepted" is the complete definition here, not an approximation.
//   Hot Prospects      — bidScore >= RC_HOT_THRESHOLD (70).
//   Bid Ready          — current stage is exactly 'Bid Ready'. Never a union with Bid
//                         Extended/Accepted — use rcLateStageProspects() for that broader bucket
//                         and label it distinctly (never call that count "Bid Ready").
//   Accepted           — current stage is exactly 'Accepted'.
//   Event Attendances  — sum of eventsAttended across the given rushees.
//   Season Goal        — Accepted count / target, never total pipeline size.
// ══════════════════════════════════════════════

const RC_STAGES=['New Lead','Contacted','Attended Event','Active Rush','Interviewed','Bid Ready','Bid Extended','Accepted'];
const RC_STAGE_COLORS=['#4FB6EC','#4FB6EC','#F5A623','#22C55E','#7b5ea7','#F0554A','#D6AD4E','#22C55E'];
const RC_HOT_THRESHOLD=70;

function rcTotalRushees(rushees){ return (rushees||[]).length; }

function rcActiveProspects(rushees){ return (rushees||[]).filter(r=>r.stage!=='Accepted'); }

function rcHotProspects(rushees){ return (rushees||[]).filter(r=>(r.bidScore||0)>=RC_HOT_THRESHOLD); }

function rcBidReady(rushees){ return (rushees||[]).filter(r=>r.stage==='Bid Ready'); }

// Broader "late stage" bucket — a distinct metric from Bid Ready, only ever surfaced under its
// own label (e.g. "Bid Ready or Later"), never presented as "Bid Ready" itself.
function rcLateStageProspects(rushees){ return (rushees||[]).filter(r=>['Bid Ready','Bid Extended','Accepted'].includes(r.stage)); }

function rcAccepted(rushees){ return (rushees||[]).filter(r=>r.stage==='Accepted'); }

function rcEventAttendances(rushees){ return (rushees||[]).reduce((s,r)=>s+(r.eventsAttended||0),0); }

// Season Goal Progress — Accepted / target, capped at 100%. Two accepted against a goal of 20
// reads "2 of 20, 10% complete," never total pipeline size over target.
function rcGoalProgress(rushees,goal){
  const target=(goal&&goal.target)||20;
  const accepted=rcAccepted(rushees).length;
  const pct=target?Math.min(100,Math.round(accepted/target*100)):0;
  return {accepted,target,pct,remaining:Math.max(0,target-accepted)};
}

// Current stage distribution — a share of today's pipeline, not a conversion rate. This data
// model has no stage-history/transition log (stage changes overwrite r.stage in place with
// nothing appended anywhere), so there is no valid way to compute a real stage-to-stage
// conversion rate. Presenting this as "conversion" would be misleading since bucket sizes aren't
// monotonically decreasing (a later stage can currently hold more prospects than an earlier one).
function rcStageDistribution(rushees){
  const total=rcTotalRushees(rushees)||1;
  return RC_STAGES.map((stage,i)=>{
    const count=(rushees||[]).filter(r=>r.stage===stage).length;
    return {stage,count,pct:Math.round(count/total*100),color:RC_STAGE_COLORS[i]};
  });
}

// Cumulative pipeline retention — what share of prospects who've reached stage i (or later) are
// currently at stage i+1 or later. Bounded 0-100% by construction, unlike a raw adjacent-bucket
// ratio (the "at or past i+1" bucket is always a subset of "at or past i"). Still a today's-
// snapshot estimate, not a tracked historical cohort — callers must label it that way, never as
// a historical trend.
function rcCumulativeRetention(rushees){
  const pairs=[];
  for(let i=0;i<RC_STAGES.length-1;i++){
    const from=(rushees||[]).filter(r=>RC_STAGES.indexOf(r.stage)>=i).length;
    const to=(rushees||[]).filter(r=>RC_STAGES.indexOf(r.stage)>=i+1).length;
    if(from===0)continue;
    pairs.push({from:RC_STAGES[i],to:RC_STAGES[i+1],fromN:from,toN:to,rate:Math.round(to/from*100)});
  }
  return pairs;
}

// Everything the Overview tab's KPI strip needs, computed once from the same canonical functions
// every other surface (funnel, goal panel, alerts, reports, Chapter Intelligence) also calls.
function rcOverviewStats(rushees,goal){
  return {
    total: rcTotalRushees(rushees),
    active: rcActiveProspects(rushees).length,
    hot: rcHotProspects(rushees).length,
    bidReady: rcBidReady(rushees).length,
    lateStage: rcLateStageProspects(rushees).length,
    accepted: rcAccepted(rushees).length,
    eventAttendances: rcEventAttendances(rushees),
    goal: rcGoalProgress(rushees,goal),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RC_STAGES, RC_STAGE_COLORS, RC_HOT_THRESHOLD,
    rcTotalRushees, rcActiveProspects, rcHotProspects, rcBidReady, rcLateStageProspects,
    rcAccepted, rcEventAttendances, rcGoalProgress, rcStageDistribution, rcCumulativeRetention,
    rcOverviewStats,
  };
}

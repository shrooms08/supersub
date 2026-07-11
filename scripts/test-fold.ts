// Fold verification against the real France v Morocco log (fixture
// 18209181, 1116 raw PascalCase events including the VAR-discarded Morocco
// goal at 48:44, action id 495). Run with: npm run test:fold
//
// Checks, all derived from the spike findings:
//   1. Final score folds to France 2-0 Morocco (a naive carry-forward
//      accumulator gets 2-1).
//   2. Folding the prefix up to Seq 534 shows the Morocco goal standing
//      (0-1); the prefix up to Seq 535 shows it erased (0-0).
//   3. Phase derives finished via game_finalised; the prefix before the
//      final status events derives live; the pre-kickoff prefix derives
//      upcoming. GameState (stuck on "scheduled") is never consulted.
//   4. The win probability series prefers the feed's demargined Pct, holds
//      value through suspensions, and moves from about 52 percent to about
//      86 percent across the France goal at the hour mark.
//   5. Scoring: an entry on Morocco at minute 40 of a 2-0 France win folds
//      to two conceded goals plus no bonuses, floored at zero; an entry on
//      France at minute 40 folds to two goals, clean sheet, win.

import * as fs from "node:fs";
import * as path from "node:path";
import {
  normalizeMatchEvent,
  normalizeOddsUpdate,
} from "../src/lib/feed/normalize";
import { foldMatch, regulationLog } from "../src/lib/state/fold";
import { foldProbSeries, probAt, teamProb } from "../src/lib/state/winprob";
import { multiplierForProb, scoreWindow, finalPoints } from "../src/lib/state/scoring";
import type { MatchEvent, OddsUpdate } from "../src/lib/feed/types";

const DATA = path.join(process.cwd(), "data", "replay", "18209181");
const rawEvents = JSON.parse(fs.readFileSync(path.join(DATA, "scores.json"), "utf8")) as unknown[];
const rawOdds = JSON.parse(fs.readFileSync(path.join(DATA, "odds-1x2.json"), "utf8")) as unknown[];

const events = rawEvents
  .map(normalizeMatchEvent)
  .filter((e): e is MatchEvent => e !== null);
const odds = rawOdds
  .map(normalizeOddsUpdate)
  .filter((o): o is OddsUpdate => o !== null);

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${detail})`);
  if (!ok) failures++;
}

// 1. Final state
const final = foldMatch(events);
check(
  "final score 2-0",
  final.score.p1 === 2 && final.score.p2 === 0,
  `folded ${final.score.p1}-${final.score.p2}`
);
check("final phase finished", final.phase === "finished", `${final.phase} by ${final.finishedBy}`);

// 2. VAR rollback across Seq 534/535
const upTo534 = foldMatch(events.filter((e) => e.seq <= 534));
const upTo535 = foldMatch(events.filter((e) => e.seq <= 535));
check(
  "Morocco goal stands at Seq 534",
  upTo534.score.p1 === 0 && upTo534.score.p2 === 1,
  `folded ${upTo534.score.p1}-${upTo534.score.p2}`
);
check(
  "VAR erases it at Seq 535",
  upTo535.score.p1 === 0 && upTo535.score.p2 === 0,
  `folded ${upTo535.score.p1}-${upTo535.score.p2}`
);
const overturned = upTo535.countables.find((c) => c.id === 495);
check(
  "discarded goal visible for the UI",
  overturned !== undefined && overturned.discarded,
  `id 495 discarded=${overturned?.discarded}`
);

// 3. Phase on prefixes
const preKickoff = foldMatch(events.filter((e) => e.seq < 19));
check("pre-kickoff phase upcoming", preKickoff.phase === "upcoming", preKickoff.phase);
const midMatch = foldMatch(events.filter((e) => e.seq <= 600));
check("mid-match phase live", midMatch.phase === "live", midMatch.phase);

// 4. Win probability
const series = foldProbSeries(odds);
check("prob series non-empty", series.length > 1000, `${series.length} ticks`);
const franceGoalTs = events.find((e) => e.id === 683 && e.action === "goal")!.ts;
const before = probAt(series, franceGoalTs - 1_000)!;
const after = probAt(series, franceGoalTs + 120_000)!;
check(
  "P(France) jumps across the 60' goal",
  teamProb(before, 1) > 0.4 && teamProb(before, 1) < 0.6 && teamProb(after, 1) > 0.8,
  `before ${(100 * teamProb(before, 1)).toFixed(1)}%, after ${(100 * teamProb(after, 1)).toFixed(1)}%`
);
const suspendedTicks = series.filter((t) => t.suspended).length;
check("suspended ticks held", suspendedTicks > 0, `${suspendedTicks} suspended ticks`);

// 5. Scoring
const kickoffTs = final.kickoffTs!;
const entryTs = kickoffTs + 40 * 60_000; // minute 40 of feed time, before all goals
const stateAtEntry = foldMatch(events.filter((e) => e.ts <= entryTs));

const morocco = scoreWindow(
  {
    team: 2,
    entryFeedTs: entryTs,
    scoreTeamAtEntry: stateAtEntry.score.p2,
    scoreOppAtEntry: stateAtEntry.score.p1,
  },
  final
);
check(
  "Morocco entry: two conceded, no bonuses",
  morocco.windowPoints === -100 && morocco.breakdown.filter((b) => b.type === "goal_conceded").length === 2,
  `window ${morocco.windowPoints}, items ${morocco.breakdown.map((b) => b.type).join(",")}`
);
const moroccoProb = teamProb(probAt(series, entryTs)!, 2);
const moroccoMult = multiplierForProb(moroccoProb);
check(
  "Morocco final floored at zero",
  finalPoints(morocco.windowPoints, moroccoMult) === 0,
  `max(0, ${morocco.windowPoints}) x ${moroccoMult.toFixed(2)}`
);

const france = scoreWindow(
  {
    team: 1,
    entryFeedTs: entryTs,
    scoreTeamAtEntry: stateAtEntry.score.p1,
    scoreOppAtEntry: stateAtEntry.score.p2,
  },
  final
);
check(
  "France entry: 2 goals + clean sheet + win = 340",
  france.windowPoints === 340,
  `window ${france.windowPoints}`
);
const franceProb = teamProb(probAt(series, entryTs)!, 1);
const franceMult = multiplierForProb(franceProb);
console.log(
  `info  France entry at 40': P(win) ${(100 * franceProb).toFixed(1)}%, multiplier ${franceMult.toFixed(2)}x, final ${finalPoints(france.windowPoints, franceMult)}`
);

// Multiplier shape
check("multiplier at p=0.75 is 1.0", multiplierForProb(0.75) === 1.0, "");
check("multiplier at p=0.05 is 10.0", multiplierForProb(0.05) === 10.0, "");
check(
  "multiplier midpoint linear",
  Math.abs(multiplierForProb(0.4) - 5.5) < 1e-9,
  `${multiplierForProb(0.4)}`
);

// 6. Regression, fixture 18202701 (Argentina v Egypt): coverage starts at
// the second half, Egypt's first-half goal exists ONLY in cumulative
// totals, and the VAR discard event itself carries a fresh Score map.
// The old reconciliation subtracted the discarded goal from baselines
// that already excluded it, erasing the pre-coverage goal and folding a
// real 3-2 into 3-1 (audited against the raw log and TxLINE's canonical
// snapshot; see SMOKE9.md).
const argRaw = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "replay", "18202701", "scores.json"), "utf8")
) as unknown[];
const argEvents = argRaw
  .map(normalizeMatchEvent)
  .filter((e): e is MatchEvent => e !== null);
const argFinal = foldMatch(argEvents);
check(
  "18202701 final folds 3-2 (pre-coverage H1 goal survives the later VAR discard)",
  argFinal.score.p1 === 3 && argFinal.score.p2 === 2,
  `folded ${argFinal.score.p1}-${argFinal.score.p2}`
);
const argAfterDiscard = foldMatch(argEvents.filter((e) => e.seq <= 647));
check(
  "18202701 is 0-1 right after the discard at Seq 647 (discard event refreshes the baseline)",
  argAfterDiscard.score.p1 === 0 && argAfterDiscard.score.p2 === 1,
  `folded ${argAfterDiscard.score.p1}-${argAfterDiscard.score.p2}`
);
const argAfterSecond = foldMatch(argEvents.filter((e) => e.seq <= 730));
check(
  "18202701 is 0-2 after the standing 67' goal (Seq 730)",
  argAfterSecond.score.p1 === 0 && argAfterSecond.score.p2 === 2,
  `folded ${argAfterSecond.score.p1}-${argAfterSecond.score.p2}`
);
check(
  "18202701 keeps the overturned 58' goal visible as discarded",
  argFinal.countables.some((c) => c.id === 570 && c.kind === "goal" && c.discarded)
);

// 7. Knockout handling, fixture 18202783 (Switzerland v Colombia, 0-0
// after extra time, Switzerland 4-3 on penalties). The ruling is
// REGULATION ONLY: the 1X2 odds that set the multiplier price
// regulation time, so windows settle at the regulation whistle. The
// log has no goal actions at all, so the extra-time leak is proven
// with a synthetic ET goal injected after the real regulation
// boundary: the full fold counts it (which is why scoring must never
// see the full fold), the regulation fold does not, and scoreWindow
// keeps it out of the breakdown even when handed the full fold.
const suiRaw = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "replay", "18202783", "scores.json"), "utf8")
) as unknown[];
const suiEvents = suiRaw
  .map(normalizeMatchEvent)
  .filter((e): e is MatchEvent => e !== null);
const suiFull = foldMatch(suiEvents);
check(
  "18202783 regulation boundary at Seq 963 (StatusId 6, extra time coming)",
  suiFull.regulationEndSeq === 963,
  `regulationEndSeq ${suiFull.regulationEndSeq}`
);
check("18202783 went to extra time", suiFull.wentToExtraTime, `${suiFull.wentToExtraTime}`);
check(
  "18202783 shootout read for display: 4-3",
  suiFull.shootout?.p1 === 4 && suiFull.shootout?.p2 === 3,
  `${suiFull.shootout?.p1}-${suiFull.shootout?.p2}`
);
check(
  "18202783 regulation fold and full fold both 0-0 (no goal actions, PE excluded)",
  suiFull.score.p1 === 0 && suiFull.score.p2 === 0 &&
    (() => { const r = foldMatch(regulationLog(suiEvents)); return r.score.p1 === 0 && r.score.p2 === 0; })(),
  `full ${suiFull.score.p1}-${suiFull.score.p2}`
);

// Synthetic extra-time goal for Colombia, stamped inside ET1 on a log
// truncated to mid extra time (the live shape the provisional path
// sees). Like a real goal event it carries a fresh Score map whose
// Total INCLUDES the ET goal; that is how the feed reports extra time
// (proven by this log's yellow cards: H2 2 + ET1 1 = Total 3), and it
// is the path an ET goal would leak through.
const midEt = suiEvents.filter((e) => e.seq <= 1100);
const lastTs = midEt[midEt.length - 1].ts;
const etGoal: MatchEvent = {
  fixtureId: 18202783,
  seq: 1101,
  id: 99999,
  ts: lastTs + 1_000,
  action: "goal",
  statusId: 7,
  confirmed: true,
  participant: 2,
  clock: { running: true, seconds: 100 * 60 },
  score: {
    p1: { goals: 0, corners: 3, yellowCards: 3, redCards: 0 },
    p2: { goals: 1, corners: 7, yellowCards: 2, redCards: 0 },
  },
};
const withEtGoal = [...midEt, etGoal];
const fullWithEt = foldMatch(withEtGoal);
const regWithEt = foldMatch(regulationLog(withEtGoal));
check(
  "18202783+ET-goal: full fold counts it (0-1), which scoring must never see",
  fullWithEt.score.p1 === 0 && fullWithEt.score.p2 === 1,
  `full ${fullWithEt.score.p1}-${fullWithEt.score.p2}`
);
check(
  "18202783+ET-goal: regulation fold excludes it (0-0)",
  regWithEt.score.p1 === 0 && regWithEt.score.p2 === 0,
  `regulation ${regWithEt.score.p1}-${regWithEt.score.p2}`
);
const suiEntryTs = suiEvents.find((e) => e.seq === 900)!.ts; // late second half, 0-0
const suiWindow = scoreWindow(
  { team: 1, entryFeedTs: suiEntryTs, scoreTeamAtEntry: 0, scoreOppAtEntry: 0 },
  regWithEt
);
check(
  "18202783+ET-goal: window vs regulation fold is clean sheet only (40, no conceded)",
  suiWindow.windowPoints === 40 &&
    suiWindow.breakdown.every((b) => b.type !== "goal_conceded") &&
    suiWindow.finalScoreOpp === 0,
  `window ${suiWindow.windowPoints}, final ${suiWindow.finalScoreTeam}-${suiWindow.finalScoreOpp}`
);
const suiWindowFullState = scoreWindow(
  { team: 1, entryFeedTs: suiEntryTs, scoreTeamAtEntry: 0, scoreOppAtEntry: 0 },
  fullWithEt
);
check(
  "18202783+ET-goal: scoreWindow guard keeps the ET goal out even on the full fold",
  suiWindowFullState.breakdown.every((b) => b.type !== "goal_conceded"),
  suiWindowFullState.breakdown.map((b) => b.type).join(",")
);

// Regulation-only matches are untouched by the boundary.
const franceReg = foldMatch(regulationLog(events));
check(
  "18209181 regulation fold matches full fold (2-0, regulation finish)",
  franceReg.score.p1 === 2 && franceReg.score.p2 === 0 && !final.wentToExtraTime && final.shootout === null,
  `regulation ${franceReg.score.p1}-${franceReg.score.p2}, ET ${final.wentToExtraTime}, shootout ${final.shootout === null ? "null" : "set"}`
);
const argReg = foldMatch(regulationLog(argEvents));
check(
  "18202701 regulation fold matches full fold (3-2)",
  argReg.score.p1 === 3 && argReg.score.p2 === 2,
  `regulation ${argReg.score.p1}-${argReg.score.p2}`
);

console.log(failures === 0 ? "\nAll fold checks passed." : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);

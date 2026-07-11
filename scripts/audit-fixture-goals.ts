// Goal-history audit for a bundled fixture: every goal-related action
// from the RAW event log (goal, var, var_end, action_discarded,
// action_amend touching goals, and any unknown action types), with the
// raw score-relevant keys as they appear on the wire (no zero-fill, no
// normalization) plus the fold's running score after each event. Ends
// with the raw feed's FINAL encoded state versus the fold's final.
//
//   npx tsx scripts/audit-fixture-goals.ts <fixtureId>

import * as fs from "node:fs";
import * as path from "node:path";
import { normalizeMatchEvent } from "../src/lib/feed/normalize";
import { foldMatch } from "../src/lib/state/fold";
import type { MatchEvent } from "../src/lib/feed/types";

const fixtureId = Number(process.argv[2] ?? 18202701);
const base = ["data", ".cache"]
  .map((d) => path.join(process.cwd(), d, "replay", String(fixtureId)))
  .find((p) => fs.existsSync(p));
if (!base) throw new Error(`no replay bundle for ${fixtureId}`);

type Raw = Record<string, any>;
const raw = (JSON.parse(fs.readFileSync(path.join(base, "scores.json"), "utf8")) as Raw[]).sort(
  (a, b) => (a.Seq ?? 0) - (b.Seq ?? 0)
);
const normalized = raw
  .map(normalizeMatchEvent)
  .filter((e): e is MatchEvent => e !== null);

// Raw score-relevant extraction WITHOUT normalization: show exactly which
// keys exist. "-" means the key is absent on the wire.
function rawGoals(e: Raw, part: 1 | 2): string {
  const score = e.Score ?? e.score;
  if (score === undefined || score === null) return "noScore";
  const entry = score[`Participant${part}`] ?? score[`participant${part}`];
  if (entry === undefined || entry === null) return "noPart";
  const total = entry.Total ?? entry.total;
  if (total === undefined || total === null) return "noTotal";
  const goals = total.Goals ?? total.goals;
  return goals === undefined ? "keyAbsent" : String(goals);
}
function rawStats(e: Raw): string {
  const stats = e.Stats ?? e.stats;
  if (!stats || Object.keys(stats).length === 0) return "-";
  const g1 = stats["1"];
  const g2 = stats["2"];
  return `${g1 === undefined ? "?" : g1}/${g2 === undefined ? "?" : g2}`;
}

const GOAL_ACTIONS = new Set([
  "goal",
  "var",
  "var_end",
  "action_discarded",
  "action_amend",
  "penalty",
  "penalty_outcome",
  "status",
  "game_finalised",
  "halftime_finalised",
]);

// Track which action ids belong to goals so discard/amend rows can say so.
const goalIds = new Set<number>();
for (const e of raw) {
  if ((e.Action ?? e.action) === "goal") goalIds.add(e.Id ?? e.id);
}

// Every distinct action string in the log, to catch unknown types the
// fold might silently ignore.
const actionCounts = new Map<string, number>();
for (const e of raw) {
  const a = String(e.Action ?? e.action ?? "?");
  actionCounts.set(a, (actionCounts.get(a) ?? 0) + 1);
}

console.log(`fixture ${fixtureId}: ${raw.length} raw events, ${normalized.length} normalized (${raw.length - normalized.length} dropped by normalization)`);
console.log(`all action types: ${[...actionCounts.entries()].map(([a, n]) => `${a}(${n})`).join(" ")}`);
console.log("");
console.log("Seq   | clock  | action           | id   | team | conf  | rawG1 | rawG2 | stats1/2 | fold");
console.log("------|--------|------------------|------|------|-------|-------|-------|----------|------");

let shownAny = false;
for (let i = 0; i < raw.length; i++) {
  const e = raw[i];
  const action = String(e.Action ?? e.action ?? "?");
  const id = e.Id ?? e.id;
  const isGoalRelated =
    action === "goal" ||
    action === "var" ||
    action === "var_end" ||
    ((action === "action_discarded" || action === "action_amend") && goalIds.has(id)) ||
    action === "game_finalised" ||
    (action === "status" && (e.StatusId === 5 || e.StatusId === 100));
  if (!isGoalRelated) continue;
  shownAny = true;
  const upTo = normalized.filter((n) => n.seq <= (e.Seq ?? 0));
  const fold = foldMatch(upTo);
  const clock = e.Clock?.Seconds !== undefined ? `${Math.floor(e.Clock.Seconds / 60) + 1}'` : "--";
  console.log(
    `${String(e.Seq).padEnd(5)} | ${clock.padEnd(6)} | ${action.padEnd(16)} | ${String(id).padEnd(4)} | ${String(e.Participant ?? "-").padEnd(4)} | ${String(e.Confirmed ?? "-").padEnd(5)} | ${rawGoals(e, 1).padEnd(5)} | ${rawGoals(e, 2).padEnd(5)} | ${rawStats(e).padEnd(8)} | ${fold.score.p1}-${fold.score.p2}`
  );
}
if (!shownAny) console.log("(no goal-related actions)");

// FINAL raw state: the last Score-bearing event and the last non-empty
// Stats map, straight off the wire.
let lastScoreEvent: Raw | null = null;
let lastStatsEvent: Raw | null = null;
for (const e of raw) {
  const score = e.Score ?? e.score;
  if (score && (score.Participant1 || score.Participant2)) lastScoreEvent = e;
  const stats = e.Stats ?? e.stats;
  if (stats && Object.keys(stats).length > 0) lastStatsEvent = e;
}
console.log("");
console.log("FINAL raw encodings:");
if (lastScoreEvent) {
  console.log(
    `  last Score-bearing event: Seq ${lastScoreEvent.Seq} (${lastScoreEvent.Action}) -> ` +
      `P1 Goals=${rawGoals(lastScoreEvent, 1)}, P2 Goals=${rawGoals(lastScoreEvent, 2)} ` +
      `(keyAbsent means zero by feed contract)`
  );
  console.log(`  full Score map: ${JSON.stringify(lastScoreEvent.Score)}`);
}
if (lastStatsEvent) {
  const stats = lastStatsEvent.Stats ?? {};
  console.log(
    `  last non-empty Stats: Seq ${lastStatsEvent.Seq} (${lastStatsEvent.Action}) -> ` +
      `key1(P1 goals)=${stats["1"] ?? "absent"}, key2(P2 goals)=${stats["2"] ?? "absent"}`
  );
}
const finalFold = foldMatch(normalized);
console.log(`  fold final: ${finalFold.score.p1}-${finalFold.score.p2} (phase ${finalFold.phase} by ${finalFold.finishedBy})`);
console.log(
  `  standing goals in fold: ${finalFold.countables
    .filter((c) => c.kind === "goal")
    .map((c) => `id${c.id} P${c.participant} ${Math.floor(c.clockSeconds / 60) + 1}'${c.discarded ? " DISCARDED" : ""}`)
    .join(", ")}`
);

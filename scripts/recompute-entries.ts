// Recompute stored entry scores for a fixture against the current fold.
// Built for the 18202701 audit: the fold fix (discardedAtSeq gate in
// src/lib/state/fold.ts) changed that fixture's final from 3-1 to 3-2,
// so stored final_score_team/final_score_opp may be stale. Window and
// final points are recomputed too, from the stored entry parameters
// (entry_feed_ts, team, scores at entry) and the stored multiplier, so
// any drift is corrected in the same pass.
//
// Dry run by default; nothing is written without --execute.
//
//   npx tsx scripts/recompute-entries.ts <fixtureId> [--execute]
//
// Uses the service-role client (scripts/lib/admin-client.mjs) because
// migration 0006 removed anon UPDATE-anything convenience for tooling;
// the app's own resolve path is untouched.

import * as fs from "node:fs";
import * as path from "node:path";
import { normalizeMatchEvent } from "../src/lib/feed/normalize";
import { foldMatch } from "../src/lib/state/fold";
import { scoreWindow, finalPoints } from "../src/lib/state/scoring";
import type { MatchEvent } from "@/lib/feed/types";
// @ts-expect-error plain mjs module without types
import { adminClient } from "./lib/admin-client.mjs";

const fixtureId = Number(process.argv[2]);
const execute = process.argv.includes("--execute");
if (!fixtureId) {
  console.error("usage: npx tsx scripts/recompute-entries.ts <fixtureId> [--execute]");
  process.exit(1);
}

const bundle = path.join(process.cwd(), "data", "replay", String(fixtureId), "scores.json");
const raw = JSON.parse(fs.readFileSync(bundle, "utf8")) as unknown[];
const events = raw.map(normalizeMatchEvent).filter((e): e is MatchEvent => e !== null);
const finalState = foldMatch(events);
console.log(
  `[recompute] fixture ${fixtureId}: fold final ${finalState.score.p1}-${finalState.score.p2} (${finalState.phase} by ${finalState.finishedBy})`
);

const sb = adminClient();

async function main() {
  const { data: entries, error } = await sb
    .from("entries")
    .select("*, players(name, shirt_number)")
    .eq("fixture_id", fixtureId)
    .order("created_at");
  if (error) throw new Error(error.message);
  if (!entries || entries.length === 0) {
    console.log("[recompute] no entries stored for this fixture");
    return;
  }
  console.log(`[recompute] ${entries.length} stored entr${entries.length === 1 ? "y" : "ies"}, ${execute ? "EXECUTE" : "DRY RUN"}`);

  for (const entry of entries) {
    const who = entry.players ? `${entry.players.name} #${entry.players.shirt_number}` : entry.user_id;
    if (!entry.resolved_at) {
      console.log(`  ${who}: unresolved, skipping (resolve computes it fresh)`);
      continue;
    }
    const window = scoreWindow(
      {
        team: entry.team as 1 | 2,
        entryFeedTs: Number(entry.entry_feed_ts),
        scoreTeamAtEntry: entry.score_team_at_entry,
        scoreOppAtEntry: entry.score_opp_at_entry,
      },
      finalState
    );
    const points = finalPoints(window.windowPoints, entry.multiplier);
    const before = `final ${entry.final_score_team}-${entry.final_score_opp}, window ${entry.window_points}, points ${entry.final_points}`;
    const after = `final ${window.finalScoreTeam}-${window.finalScoreOpp}, window ${window.windowPoints}, points ${points}`;
    const changed =
      entry.final_score_team !== window.finalScoreTeam ||
      entry.final_score_opp !== window.finalScoreOpp ||
      entry.window_points !== window.windowPoints ||
      entry.final_points !== points;

    console.log(`  ${who} (entered ${entry.entry_minute}' on ${entry.team_name}, x${entry.multiplier})`);
    console.log(`    stored:     ${before}`);
    console.log(`    recomputed: ${after}${changed ? "  <- CHANGED" : "  (no change)"}`);

    if (changed && execute) {
      const { error: updateErr } = await sb
        .from("entries")
        .update({
          window_points: window.windowPoints,
          final_points: points,
          final_score_team: window.finalScoreTeam,
          final_score_opp: window.finalScoreOpp,
          breakdown: window.breakdown,
        })
        .eq("id", entry.id);
      if (updateErr) throw new Error(`update ${entry.id}: ${updateErr.message}`);
      console.log("    written.");
    }
  }
  if (!execute) console.log("[recompute] dry run complete; re-run with --execute to write changes");
}

main().catch((err) => {
  console.error(`[recompute] FAILED: ${err.message}`);
  process.exit(1);
});

// Recompute stored entry scores against the current scoring engine.
// Built first for the 18202701 fold fix, then reused for the /10 scale
// rescale: window points and final points are recomputed from each
// entry's own parameters (team, entry_feed_ts, at-entry scores) and its
// stored multiplier, folding the REGULATION log so extra-time goals
// never leak into a window. The final score is refreshed too.
//
// Two run shapes:
//   npx tsx scripts/recompute-entries.ts <fixtureId> [--execute]
//     Reads the entries for one fixture from the DB via the admin
//     client (needs SUPABASE_SERVICE_ROLE_KEY) and writes them back.
//   npx tsx scripts/recompute-entries.ts --from <entries.json>
//     Reads an entries array from a file (id, fixture_id, team,
//     entry_feed_ts, multiplier, stored window_points/final_points),
//     computes new values against the bundled logs, prints before/after
//     and the UPDATE SQL, and writes nothing. Use this when the
//     service-role key is not on the machine (the SQL runs through a
//     privileged console instead). No DB access at all.
//
// Dry run by default in the DB shape; nothing is written without
// --execute.

import * as fs from "node:fs";
import * as path from "node:path";
import { normalizeMatchEvent } from "../src/lib/feed/normalize";
import { foldMatch, regulationLog } from "../src/lib/state/fold";
import { scoreWindow, finalPoints } from "../src/lib/state/scoring";
import type { MatchEvent } from "@/lib/feed/types";

interface EntryLike {
  id: string;
  fixture_id: number;
  team: 1 | 2;
  entry_feed_ts: number;
  score_team_at_entry: number;
  score_opp_at_entry: number;
  multiplier: number;
  window_points: number | null;
  final_points: number | null;
  final_score_team: number | null;
  final_score_opp: number | null;
  resolved_at: string | null;
  name?: string;
  shirt_number?: number;
}

const bundleCache = new Map<number, ReturnType<typeof foldMatch>>();
function regulationState(fixtureId: number) {
  const cached = bundleCache.get(fixtureId);
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "replay", String(fixtureId), "scores.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown[];
  const events = raw.map(normalizeMatchEvent).filter((e): e is MatchEvent => e !== null);
  const state = foldMatch(regulationLog(events));
  bundleCache.set(fixtureId, state);
  return state;
}

function recompute(entry: EntryLike) {
  const state = regulationState(entry.fixture_id);
  const window = scoreWindow(
    {
      team: entry.team,
      entryFeedTs: Number(entry.entry_feed_ts),
      scoreTeamAtEntry: entry.score_team_at_entry,
      scoreOppAtEntry: entry.score_opp_at_entry,
    },
    state
  );
  const points = finalPoints(window.windowPoints, entry.multiplier);
  return { window, points };
}

function printRow(entry: EntryLike, window: ReturnType<typeof recompute>["window"], points: number) {
  const who = entry.name ? `${entry.name} #${entry.shirt_number}` : entry.id;
  const changed =
    entry.window_points !== window.windowPoints ||
    entry.final_points !== points ||
    entry.final_score_team !== window.finalScoreTeam ||
    entry.final_score_opp !== window.finalScoreOpp;
  console.log(`  ${who} · fixture ${entry.fixture_id} · x${entry.multiplier.toFixed(3)}`);
  console.log(
    `    before: window ${entry.window_points}, final ${entry.final_points}, score ${entry.final_score_team}-${entry.final_score_opp}`
  );
  console.log(
    `    after:  window ${window.windowPoints}, final ${points}, score ${window.finalScoreTeam}-${window.finalScoreOpp}${changed ? "  <- CHANGED" : "  (no change)"}`
  );
  return changed;
}

async function runFromFile(file: string) {
  const entries = JSON.parse(fs.readFileSync(file, "utf8")) as EntryLike[];
  console.log(`[recompute] ${entries.length} entr${entries.length === 1 ? "y" : "ies"} from ${file} (compute only, emitting SQL)`);
  const sql: string[] = [];
  for (const entry of entries) {
    if (!entry.resolved_at) {
      console.log(`  ${entry.id}: unresolved, skipping`);
      continue;
    }
    const { window, points } = recompute(entry);
    printRow(entry, window, points);
    sql.push(
      `update public.entries set window_points = ${window.windowPoints}, ` +
        `final_points = ${points}, final_score_team = ${window.finalScoreTeam}, ` +
        `final_score_opp = ${window.finalScoreOpp}, ` +
        `breakdown = '${JSON.stringify(window.breakdown).replace(/'/g, "''")}'::jsonb ` +
        `where id = '${entry.id}';`
    );
  }
  console.log("\n-- UPDATE SQL (run through a privileged console):");
  console.log(sql.join("\n"));
}

async function runFromDb(fixtureId: number, execute: boolean) {
  // @ts-expect-error plain mjs module without types
  const { adminClient } = await import("./lib/admin-client.mjs");
  const sb = adminClient();
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
  console.log(`[recompute] fixture ${fixtureId}: ${entries.length} entries, ${execute ? "EXECUTE" : "DRY RUN"}`);
  for (const row of entries as EntryLike[]) {
    if (!row.resolved_at) {
      console.log(`  ${row.id}: unresolved, skipping`);
      continue;
    }
    const { window, points } = recompute(row);
    const changed = printRow(row, window, points);
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
        .eq("id", row.id);
      if (updateErr) throw new Error(`update ${row.id}: ${updateErr.message}`);
      console.log("    written.");
    }
  }
  if (!execute) console.log("[recompute] dry run complete; re-run with --execute to write");
}

async function main() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf("--from");
  if (fromIdx !== -1 && args[fromIdx + 1]) {
    await runFromFile(args[fromIdx + 1]);
    return;
  }
  const fixtureId = Number(args[0]);
  if (!fixtureId) {
    console.error(
      "usage: recompute-entries.ts <fixtureId> [--execute]  |  recompute-entries.ts --from <entries.json>"
    );
    process.exit(1);
  }
  await runFromDb(fixtureId, args.includes("--execute"));
}

main().catch((err) => {
  console.error(`[recompute] FAILED: ${err.message}`);
  process.exit(1);
});

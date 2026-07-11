// General badge re-evaluation. Replays the exact resolution-time badge
// logic (src/lib/career/badges.ts) over every stored resolved entry,
// in resolution order so the appearance-gated badges (first_whistle at
// the first appearance, ever_present at the fifth) evaluate the same way
// they would live. Produces, per player:
//   - toAward:  badges now earned but not currently held (attributed to
//               the earliest entry that earns them)
//   - toRevoke: badges currently held that no entry earns any more
// It AWARDS the first set and only LISTS the second: revoking is never
// automatic. This is a general tool, not a one-off; run it whenever a
// score correction could change what a past entry earned.
//
// Two shapes, matching recompute-entries.ts:
//   npx tsx scripts/backfill-badges.ts [--execute]
//     Reads entries and badges from the DB via the admin client (needs
//     SUPABASE_SERVICE_ROLE_KEY) and writes awards back.
//   npx tsx scripts/backfill-badges.ts --from <data.json>
//     Reads { entries, badges } from a file, computes the delta, prints
//     it, and emits INSERT SQL for the awards. No DB access; run the SQL
//     through a privileged console.
//
// Dry run by default in the DB shape; nothing is written without
// --execute. Revocations are printed for a human to approve separately.

import * as fs from "node:fs";
import { evaluateBadges, type ResolvedEntryFacts, type BadgeKey } from "../src/lib/career/badges";

interface EntryRow extends ResolvedEntryFacts {
  id: string;
  player_id: string;
  name?: string;
  shirt_number?: number;
  resolved_at: string;
}
interface BadgeRow {
  player_id: string;
  badge: string;
  entry_id: string | null;
}

// The full set of badges a player should hold, plus which entry earns
// each (the earliest, in resolution order). Mirrors live awarding:
// evaluateBadges is called per entry with appearances = its 1-based
// index in the player's resolution-ordered history.
function shouldHold(entries: EntryRow[]): Map<BadgeKey, string> {
  const ordered = [...entries].sort((a, b) =>
    a.resolved_at < b.resolved_at ? -1 : a.resolved_at > b.resolved_at ? 1 : 0
  );
  const earnedBy = new Map<BadgeKey, string>();
  ordered.forEach((entry, i) => {
    const earned = evaluateBadges(entry, i + 1);
    for (const badge of earned) if (!earnedBy.has(badge)) earnedBy.set(badge, entry.id);
  });
  return earnedBy;
}

interface Delta {
  playerId: string;
  name: string;
  toAward: { badge: BadgeKey; entryId: string }[];
  toRevoke: string[];
}

function computeDeltas(entries: EntryRow[], badges: BadgeRow[]): Delta[] {
  const byPlayer = new Map<string, EntryRow[]>();
  for (const e of entries) {
    const list = byPlayer.get(e.player_id) ?? [];
    list.push(e);
    byPlayer.set(e.player_id, list);
  }
  const heldByPlayer = new Map<string, Set<string>>();
  for (const b of badges) {
    const set = heldByPlayer.get(b.player_id) ?? new Set<string>();
    set.add(b.badge);
    heldByPlayer.set(b.player_id, set);
  }

  const deltas: Delta[] = [];
  for (const [playerId, playerEntries] of byPlayer) {
    const should = shouldHold(playerEntries);
    const held = heldByPlayer.get(playerId) ?? new Set<string>();
    const toAward = [...should.entries()]
      .filter(([badge]) => !held.has(badge))
      .map(([badge, entryId]) => ({ badge, entryId }));
    const toRevoke = [...held].filter((badge) => !should.has(badge as BadgeKey));
    if (toAward.length > 0 || toRevoke.length > 0) {
      deltas.push({ playerId, name: playerEntries[0].name ?? playerId, toAward, toRevoke });
    }
  }
  return deltas;
}

function report(deltas: Delta[]) {
  if (deltas.length === 0) {
    console.log("[backfill] no changes: every held badge is still earned and nothing new qualifies");
    return;
  }
  for (const d of deltas) {
    console.log(`  ${d.name} (${d.playerId})`);
    for (const a of d.toAward) console.log(`    AWARD  ${a.badge}  (earned by entry ${a.entryId})`);
    for (const r of d.toRevoke) console.log(`    REVOKE ${r}  <- LISTED ONLY, not applied; approve separately`);
  }
}

function runFromFile(file: string) {
  const { entries, badges } = JSON.parse(fs.readFileSync(file, "utf8")) as {
    entries: EntryRow[];
    badges: BadgeRow[];
  };
  console.log(`[backfill] ${entries.length} resolved entries, ${badges.length} held badges (compute only)`);
  const deltas = computeDeltas(entries, badges);
  report(deltas);
  const inserts = deltas.flatMap((d) =>
    d.toAward.map(
      (a) =>
        `insert into public.player_badges (player_id, badge, entry_id) values ('${d.playerId}', '${a.badge}', '${a.entryId}') on conflict (player_id, badge) do nothing;`
    )
  );
  if (inserts.length > 0) {
    console.log("\n-- AWARD SQL (run through a privileged console):");
    console.log(inserts.join("\n"));
  }
  const revokes = deltas.flatMap((d) => d.toRevoke.map((r) => `${d.name}: ${r}`));
  if (revokes.length > 0) {
    console.log("\n-- REVOCATIONS held back for approval (NOT emitted as SQL):");
    console.log(revokes.map((r) => `--   ${r}`).join("\n"));
  }
}

async function runFromDb(execute: boolean) {
  // @ts-expect-error plain mjs module without types
  const { adminClient } = await import("./lib/admin-client.mjs");
  const sb = adminClient();
  const { data: entries, error: e1 } = await sb
    .from("entries")
    .select("*, players(name, shirt_number)")
    .not("resolved_at", "is", null);
  if (e1) throw new Error(e1.message);
  const { data: badges, error: e2 } = await sb.from("player_badges").select();
  if (e2) throw new Error(e2.message);
  const rows: EntryRow[] = (entries ?? []).map((e: Record<string, unknown> & { players?: { name: string; shirt_number: number } }) => ({
    ...(e as unknown as EntryRow),
    name: e.players?.name,
    shirt_number: e.players?.shirt_number,
  }));
  console.log(`[backfill] ${rows.length} resolved entries, ${(badges ?? []).length} held badges, ${execute ? "EXECUTE" : "DRY RUN"}`);
  const deltas = computeDeltas(rows, (badges ?? []) as BadgeRow[]);
  report(deltas);
  if (execute) {
    for (const d of deltas) {
      if (d.toAward.length === 0) continue;
      const insertRows = d.toAward.map((a) => ({ player_id: d.playerId, badge: a.badge, entry_id: a.entryId }));
      const { error } = await sb
        .from("player_badges")
        .upsert(insertRows, { onConflict: "player_id,badge", ignoreDuplicates: true });
      if (error) throw new Error(`award for ${d.name}: ${error.message}`);
      console.log(`  awarded ${d.toAward.map((a) => a.badge).join(", ")} to ${d.name}`);
    }
    console.log("[backfill] awards written; revocations (if any) left for manual approval");
  } else {
    console.log("[backfill] dry run; re-run with --execute to award (revocations never auto-applied)");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf("--from");
  if (fromIdx !== -1 && args[fromIdx + 1]) {
    runFromFile(args[fromIdx + 1]);
    return;
  }
  await runFromDb(args.includes("--execute"));
}

main().catch((err) => {
  console.error(`[backfill] FAILED: ${err.message}`);
  process.exit(1);
});

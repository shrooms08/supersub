// Data hygiene: purge harness-created players and everything they own.
// Dry run by default; nothing is deleted without --execute.
//
//   node scripts/purge-test-players.mjs --pattern "Smoke %" --pattern "SMOKE-%" [--id <uuid>] [--execute]
//
// Patterns are SQL LIKE patterns matched against players.name (case
// sensitive, as LIKE is). Deletion order is FK-safe: player_badges,
// then entries, then the player row. Every row is printed before (dry
// run) and after (execute) the fact.
//
// Convention going forward: every script that creates a player uses the
// SMOKE- name prefix (or "Smoke " for deliberately old-rule rows), so
// the whole family purges with two patterns.
//
// Uses SUPABASE_URL / SUPABASE_ANON_KEY from env or .env.local; run with
// production values inline to purge production.

import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const patterns = [];
const ids = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--pattern" && args[i + 1]) patterns.push(args[++i]);
  if (args[i] === "--id" && args[i + 1]) ids.push(args[++i]);
}
if (patterns.length === 0 && ids.length === 0) {
  console.error(
    'usage: node scripts/purge-test-players.mjs --pattern "Smoke %" [--pattern ...] [--id <uuid>] [--execute]'
  );
  process.exit(1);
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const log = (m) => console.log(`[purge] ${m}`);

async function main() {
  // Collect targets.
  const byId = new Map();
  for (const pattern of patterns) {
    const { data, error } = await sb.from("players").select().like("name", pattern);
    if (error) throw new Error(`pattern "${pattern}": ${error.message}`);
    for (const p of data ?? []) byId.set(p.id, { ...p, matchedBy: pattern });
  }
  for (const id of ids) {
    const { data, error } = await sb.from("players").select().eq("id", id).maybeSingle();
    if (error) throw new Error(`id ${id}: ${error.message}`);
    if (data) byId.set(data.id, { ...data, matchedBy: "--id" });
  }

  const targets = [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  if (targets.length === 0) {
    log("nothing matches; nothing to do");
    return;
  }

  log(`${execute ? "EXECUTE" : "DRY RUN"}: ${targets.length} player(s) targeted`);
  let totalEntries = 0;
  let totalBadges = 0;
  for (const p of targets) {
    const { count: entryCount } = await sb
      .from("entries")
      .select("*", { count: "exact", head: true })
      .eq("player_id", p.id);
    const { count: badgeCount } = await sb
      .from("player_badges")
      .select("*", { count: "exact", head: true })
      .eq("player_id", p.id);
    totalEntries += entryCount ?? 0;
    totalBadges += badgeCount ?? 0;
    log(
      `  ${p.name} #${p.shirt_number} (${p.id}) created ${p.created_at.slice(0, 10)} ` +
        `via [${p.matchedBy}]: ${entryCount ?? 0} entries, ${badgeCount ?? 0} badges`
    );
  }
  log(`totals: ${targets.length} players, ${totalEntries} entries, ${totalBadges} badges`);

  if (!execute) {
    log("dry run complete; re-run with --execute to delete the above");
    return;
  }

  // FK-safe order: badges, entries, players.
  const targetIds = targets.map((p) => p.id);
  const { count: db, error: e1 } = await sb
    .from("player_badges")
    .delete({ count: "exact" })
    .in("player_id", targetIds);
  if (e1) throw new Error(`badges: ${e1.message}`);
  const { count: de, error: e2 } = await sb
    .from("entries")
    .delete({ count: "exact" })
    .in("player_id", targetIds);
  if (e2) throw new Error(`entries: ${e2.message}`);
  const { count: dp, error: e3 } = await sb
    .from("players")
    .delete({ count: "exact" })
    .in("id", targetIds);
  if (e3) throw new Error(`players: ${e3.message}`);
  log(`DELETED: ${db ?? 0} badges, ${de ?? 0} entries, ${dp ?? 0} players`);
}

main().catch((err) => {
  console.error(`[purge] FAILED: ${err.message}`);
  process.exit(1);
});

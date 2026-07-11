// Demo capture helper: wipe a player's entries and badges so a scenario
// can be re-recorded on a clean slate, keeping the player (and the
// browser's identity cookie) intact.
//
// Convention: any player created by tooling (smoke scripts, screenshot
// drivers, throwaway demos) is named with the SMOKE- prefix, so
// scripts/purge-test-players.mjs removes the whole family with
// --pattern "SMOKE-%" --pattern "Smoke %". Camera-facing demo players
// you intend to keep can be named freely.
//
//   node scripts/reset-demo.mjs "Player Name"        # newest player with that name
//   node scripts/reset-demo.mjs --id <playerId>
//   node scripts/reset-demo.mjs "Player Name" --purge  # also delete the player
//
// Deletes entries and badges, so it uses the service-role key via
// scripts/lib/admin-client.mjs (the anon key cannot delete since
// migration 0006). Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env.local or inline; never commit the service-role key.

import { adminClient } from "./lib/admin-client.mjs";

const args = process.argv.slice(2);
const purge = args.includes("--purge");
const idFlag = args.indexOf("--id");
const playerId = idFlag >= 0 ? args[idFlag + 1] : null;
const name = args.find((a) => !a.startsWith("--") && a !== playerId);

if (!playerId && !name) {
  console.error('usage: node scripts/reset-demo.mjs "Player Name" [--purge] | --id <playerId>');
  process.exit(1);
}

const sb = adminClient();

async function main() {
  let player;
  if (playerId) {
    const { data } = await sb.from("players").select().eq("id", playerId).maybeSingle();
    player = data;
  } else {
    const { data } = await sb
      .from("players")
      .select()
      .eq("name", name)
      .order("created_at", { ascending: false })
      .limit(1);
    player = data?.[0];
  }
  if (!player) {
    console.error(`no player found for ${playerId ?? name}`);
    process.exit(1);
  }

  const { count: badgeCount } = await sb
    .from("player_badges")
    .delete({ count: "exact" })
    .eq("player_id", player.id);
  const { count: entryCount } = await sb
    .from("entries")
    .delete({ count: "exact" })
    .eq("player_id", player.id);

  console.log(
    `[reset] ${player.name} #${player.shirt_number} (${player.id}): removed ${entryCount ?? 0} entries, ${badgeCount ?? 0} badges`
  );

  if (purge) {
    await sb.from("players").delete().eq("id", player.id);
    console.log(`[reset] player row deleted (the browser cookie is now orphaned; sign again)`);
  } else {
    console.log(`[reset] player kept: the browser cookie still works, career reads fresh`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

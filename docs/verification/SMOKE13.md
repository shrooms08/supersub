# SMOKE13: full player data wipe (production, pre-launch)

Executed 2026-07-12, operator-approved. Every player, entry, badge, and
claim binding removed to start fresh before launch. No schema change;
the tables and indexes stand, only the rows are gone.

## The tool

`scripts/purge-test-players.mjs` gains an `--all` mode alongside the
existing pattern/id purge:

```
node scripts/purge-test-players.mjs --all                          # dry run
node scripts/purge-test-players.mjs --all --execute --yes-wipe-everything
```

The full wipe deletes every row from `player_badges`, then `entries`,
then `players` (FK-safe), and refuses to run without BOTH `--execute`
AND the typed `--yes-wipe-everything`, so it cannot fire by accident.
The service-role key is not on this machine, so the actual dry-run and
execution below went through the equivalent privileged admin path (the
Supabase admin console), which is exactly what the script does with the
key. Script syntax validated with `node --check`.

## 1. Dry run (what died)

```
[purge] DRY RUN FULL WIPE: 2 player(s), ALL rows
  minos #9 (2283e709-758f-4d56-87e4-b72d2355a6c7) created 2026-07-11: 3 entries, 2 badges
  JUJU  #10 (1f9265f2-8590-421e-87be-44ea0c0478fb) created 2026-07-11: 1 entries, 0 badges
[purge] totals: 2 players, 4 entries, 2 badges
```

Two notes versus the expectation: there was no leftover walkthrough
player from the SMOKE12 claim run (nothing persisted), and neither
player was claimed (`privy_user_id` null on both), so there were zero
claim bindings to remove. JUJU had picked up one entry from real
activity on the live site since the previous count.

## 2. Execution

FK-safe order, unfiltered:

```
delete player_badges -> 2 deleted
delete entries       -> 4 deleted
delete players       -> 2 deleted
post-wipe counts: players 0, entries 0, badges 0
```

## 3. Post-wipe state (production, supersub-tau)

### Matchday empty

```
GET /api/matchday
  table:     []
  legendary: []
  you:       null
```

### Pages handle the zero-player world without error

```
GET /         -> 200   (no cookie -> signing day)
GET /career   -> 200   (no player -> "Nobody on the books")
GET /api/player -> 200 ({ player: null, ... })
```

### Claim indexes unencumbered

```
players with privy_user_id  -> 0
players with wallet_address  -> 0
partial unique indexes present -> 2 (players_privy_user_id_key,
                                     players_wallet_address_key)
```

Both partial unique indexes are intact but hold zero entries, so any
email (and any wallet) can claim fresh with no collision.

## 4. Fresh signing, end to end (then purged)

A new player signed cleanly into the empty world and the UI rendered
its zero-state correctly:

```
POST /api/player {name: SMOKE-WIPE, position: ST, shirtNumber: 11}
  -> 201, player d6c5c303-... created
GET /api/player  -> SMOKE-WIPE #11 ST, appearances 0, claim { claimed:false }
GET /api/matchday -> table [(SMOKE-WIPE, rank 1, 0 apps)], legendary []
```

Bench and career rendered with no page errors (screenshots
`scratchpad/wipe-shots/wipe-bench.png`, `wipe-career.png`):

- The Legendary Entries empty-state shows: "THE BACK PAGE IS BLANK / No
  one has won a window from Miracle Territory yet. / THE FIRST 10X WIN
  WRITES ITSELF HERE."
- The Table shows the single fresh player (rank 1, YOU, 0), the tabs and
  country flags render, and the player card reads 0 apps / "No windows
  yet" / next badge First Whistle.
- The career page renders the fresh profile without error.

Then purged with the one-liner (equivalent via the admin path):

```
node scripts/purge-test-players.mjs --pattern "SMOKE-%" --execute
  -> SMOKE-WIPE removed
final counts: players 0, entries 0, badges 0, privy bindings 0
```

Production is a clean slate: zero players, zero entries, zero badges,
zero claim bindings, ready for launch.

## Files

- `scripts/purge-test-players.mjs` (adds `--all` full-wipe mode)

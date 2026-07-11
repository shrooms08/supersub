# SMOKE2: proof of the Phase 2 definition of done

All runs below were executed on 2026-07-10 against this working tree with
`npm run dev`, the Supabase project `supersub` (huzrtjdtmwmvhudakelp), and
NO `ANTHROPIC_API_KEY` set (see section 5 for why that is the point).
Screenshots are in `docs/smoke2/`.

## 0. Setup from clean state

```
npm install                       # exit 0
# supabase/migrations/0002_players_and_career.sql applied
#   (players, entries.player_id backfilled for legacy rows, report columns,
#    player_badges; idempotent: IF NOT EXISTS everywhere and the backfill
#    only touches rows with player_id null. Re-applying is a no-op.)
npm run dev
```

A second replay fixture was fetched from the real TxLINE historical
endpoints through the app's own on-demand replay path and committed:

```
$ npx tsx scripts/fetch-replay.ts 18202783
[fetched] Switzerland v Colombia: 1355 events, 3151 FT 1X2 odds.
```

## 1. Badge logic unit tests

`npm run test:badges` runs 30 checks against constructed resolved entries,
including every boundary the DoD names:

```
PASS  Miracle Worker at exactly p = 0.10 with won window
PASS  no Miracle Worker just above the boundary (p = 0.101)
PASS  no Miracle Worker at p = 0.10 with drawn window
PASS  no Miracle Worker at p = 0.10 when the window was lost
PASS  overturned goals do not win a window
PASS  no Iron Nerve at minute 84
PASS  Iron Nerve at exactly minute 85
PASS  Comeback King: 0-1 at entry, 1-1 at the whistle
PASS  no Comeback King when level at entry (0-0 to 1-0)
PASS  no Comeback King when still behind at the whistle (0-1 to 1-2)
... (30/30)
All badge checks passed.
```

Full list covers First Whistle, Ever Present at 5, Wounded at exactly 3
conceded, window W/D/L derivation, and all multiplier tier boundaries
(1.99x Safe Hands, 2.0x Squad Rotation, 3.99x/4.0x, 6.99x/7.0x).

## 2. Fresh user flow and the second appearance

`npm run smoke:career` (equals `node scripts/smoke-career.mjs http://localhost:3000 60`)
drives the whole DoD scenario over HTTP with the signed identity cookie,
exactly as the browser would. Captured output:

```
[smoke2] player created: Smoke 243908 #14 (ST), id 225e4e67-cdeb-4479-9d99-574f70a60fc7
[smoke2] second create attempt -> HTTP 409 (expected 409)
[smoke2] fresh career: 0 appearances, 0 badges earned
[smoke2] --- match one: replaying fixture 18209181 at 60x, entering as team 2 ---
[smoke2] entered as Morocco at minute 5: P(win) 15.3%, 8.68x
[smoke2] resolved: final 0-2, window -100, final points 0, new badges [first_whistle]
[smoke2] report_source: template
[smoke2] report: Smoke 243908, the number 14, came on for Morocco in the 5th minute at 0-0, the win priced at 15 in 100; 8.7x on the slip, Miracle Territory. After that, France struck 2 times (60', 66'), and VAR took one off the board. It finished 0-2. The ledger reads 0 points, and the ledger does not do sentiment.
[smoke2] career after match one: apps 1, impact 0, total 0, avg mult 8.68, form [L]
[smoke2] --- match two: replaying fixture 18202783 at 60x, entering as team 1 ---
[smoke2] entered as Switzerland at minute 6: P(win) 26.1%, 7.29x
[smoke2] resolved: final 0-0, window 40, final points 291.5, new badges []
[smoke2] report_source: template
[smoke2] report: Smoke 243908, the number 14, came on for Switzerland in the 6th minute at 0-0, the win priced at 26 in 100; 7.3x on the slip, Miracle Territory. What followed asked little of the substitute; no goals either way on the watch. Nothing conceded on the shift. It finished 0-0. The ledger reads 291.5 points, and the ledger does not do sentiment.
[smoke2] career after match two: apps 2, impact 145.75, total 291.5, avg mult 7.98, form [DL]
[smoke2] cabinet: earned [first_whistle], locked [miracle_worker, iron_nerve, comeback_king, ever_present, wounded]
[smoke2] history rows: 2, each with report: true
[smoke2] ALL PHASE 2 SMOKE CHECKS PASSED
```

Checks asserted by the script, not just printed: First Whistle earned on
the debut resolution, Impact Rating equals the single final score after
one appearance and the exact average (145.75) after two, form goes
[L] then [D, L], every history row has a stored report, and no report
contains an em or en dash.

Flow note, amended 2026-07-11: player names are now IMMUTABLE. The
rename path that existed when this document was first captured (career
page edit plus `PATCH /api/player`) has been removed; signing day warns
"Choose carefully. This name is permanent." and the API rejects any
name change unconditionally, verified directly:

```
$ curl -i -X PATCH /api/player -d '{"name":"Sneaky Rename"}'            # no cookie
HTTP/1.1 403 Forbidden
{"error":"The name on the shirt is permanent. No changes, ever."}

$ curl -i -X PATCH /api/player -H "Cookie: supersub_pid=..." -d '{"name":"Sneaky Rename"}'
HTTP/1.1 403 Forbidden
{"error":"The name on the shirt is permanent. No changes, ever."}

$ curl /api/player -H "Cookie: supersub_pid=..."   # name unchanged
{"player":{...,"name":"Immutable Check",...}}
```

## 3. Persistence across a server restart

The dev server was killed and restarted (fresh process, empty in-memory
replay sessions), then the career fetched again with the same cookie:

```
$ curl -s http://localhost:3000/api/career -H 'Cookie: supersub_pid=225e4e67-...'
after fresh server process: player Smoke 243908 | apps 2 | impact 145.75 |
form DL | earned: first_whistle | reports intact: true
```

Cross-checked in Supabase directly:

```sql
select b.badge, p.name from player_badges b join players p on p.id = b.player_id;
-- first_whistle | Smoke 243908   (plus earlier test players)
select count(*) from entries where report ~ '—|–';
-- 0
```

## 4. The same flow in the browser (screenshots)

Captured with headless Chromium driving the real UI:

1. `docs/smoke2/01-signing-day.png` - first-run flow: name, squad number,
   position, live crest preview, SIGN THE FORMS.
2. `docs/smoke2/02-bench-with-chip.png` - the bench with the player chip
   (avatar, name, Impact Rating) top-left and "You played this" states
   with final points on both fixture cards.
3. `docs/smoke2/03-resolution-with-report.png` - full time: final score
   hero number, tier name with the multiplier, breakdown with the VAR
   overturn struck through, "Into the cabinet: First Whistle", and the
   match report as a newspaper clipping below the breakdown.
4. `docs/smoke2/04-career-mobile.png` - the career page: hero with avatar,
   number, position and Impact Rating huge in volt; the record
   (appearances, total points, avg multiplier, legendary, W/D/L form
   chips); the cabinet with First Whistle earned and five locked; match
   history rows with tier names. It reads as a squad profile.
5. `docs/smoke2/05-report-detail.png` - match history detail: the clipping
   plus the numbers and breakdown.
6. `docs/smoke2/06-career-desktop.png` - the career page at 1280px.

## 5. LLM failure path, proven

The entire run above executed with `ANTHROPIC_API_KEY` unset. Every
resolution therefore exercised the failure path of the report generator:
`report_source` came back `template` on every entry, the deterministic
template report was stored at resolution (visible in section 2 output and
in the clippings in the screenshots), stored exactly once, and the app
never errored. The SQL scan in section 3 confirms no stored report
contains an em or en dash.

With a key set, `generateMatchReport` calls `claude-sonnet-4-6` through
the official SDK with a system prompt that passes ONLY the structured
facts of the resolved entry, states that events must never be invented,
requires 60 to 90 words of British broadsheet in the third person with
the player's name and number, passes the multiplier tier as a fact, and
forbids em and en dashes in the copy (with a server-side sanitize as belt
and braces). Any API failure, refusal, or implausibly short output falls
back to the same template used here. Reports are written in the single
resolution update guarded by `resolved_at is null`, so they are stored
once and never regenerated.

## 6. Build health

```
npx tsc --noEmit                 # exit 0
npm run build                    # Compiled successfully; /career static,
                                 # /career/[entryId] dynamic, all /api/* dynamic
npm run test:fold                # Phase 1 fold checks still pass, 16/16
                                 # (correction 2026-07-11: this line originally
                                 #  said 17/17, a miscount; the suite has had 16
                                 #  checks since 93cf3a5 and was never modified)
```

# SMOKE-WORLDCUP - World Cup only

Feature branch `worldcup-only` off main. The TxLINE feed carries two
competitions: World Cup (id **72**) and Friendlies (id **430**). Super Sub
is the World Cup product, so Friendlies must never appear on the bench, in
the results history, or on any match path, and a direct URL to a friendly
must degrade gracefully rather than hang.

Read-only: this is a source/display filter. No scoring or schema change.

## The single gate

The feed's competition id is now carried on the normalized fixture and
checked at every fixture-source choke point through one helper.

```
 M src/lib/feed/types.ts          Fixture gains optional competitionId
 M src/lib/feed/normalize.ts      competitionId: num(raw, "CompetitionId")
?? src/lib/worldcup.ts            WORLD_CUP_COMPETITION_ID = 72 + isWorldCup()
 M src/lib/server/schedule.ts     .filter(isWorldCup) on the bench snapshot
 M src/lib/server/results.ts      .filter(isWorldCup) on the history snapshot
 M src/lib/sources/live.ts        listFixtures + fetchFixture gated
 M src/lib/server/match-timeline.ts  fetchRealRaw requires CompetitionId 72
```

`normalize.ts` is the one module that touches raw payloads, so the
competition id is captured there and nowhere else. Every place that turns
the `/fixtures/snapshot` feed into fixtures then filters through `isWorldCup`,
so the bench tabs (TODAY, RESULTS, UPCOMING), the results history, live
match entry and streaming, and the Match Detail report all only ever see
World Cup fixtures.

Bundled replays (the three World Cup demo fixtures) are admitted by their own
local path in `compute()`, which runs before the feed fetch, so this filter
never touches them.

## The feed, before the filter

One `/fixtures/snapshot` over a 45-day lookback, grouped by competition:

```
106  id 72  | World Cup
 53  id 430 | Friendlies
159  total
```

## Results history: count before and after

Applying the results-history predicate (finished, and not today) to the same
snapshot:

```
results history (finished, not today):
  BEFORE (all competitions): 152
  AFTER  (World Cup only)   : 106
  removed (Friendlies)      :  46
  World Cup days            :  35
```

The live `/api/results?page=0` after the change reports
`totalFinished 106, totalDays 35, error null` - matching the World Cup-only
count exactly.

## Bench, no friendlies, both widths

- `docs/smoke/worldcup-only-mobile.png` (390)
- `docs/smoke/worldcup-only-desktop.png` (1280)

Masthead reads **106 FIXTURES** (was 158). Tabs read **TODAY 0 / RESULTS 106
/ UPCOMING 0** - the World Cup is over, so the friendlies that previously
filled TODAY and UPCOMING are gone, not hidden. Every day header on the
RESULTS wall reads WORLD CUP. The clearest single proof: **SAT 18 JUL**
previously carried two rows - France 4-6 England and the friendly Vietnam
(no score) Myanmar. It now carries only France 4-6 England. The friendly is
filtered out at source.

## Direct friendly URL degrades gracefully

Vietnam v Myanmar (18143850) is a friendly (competition 430). Every entry
point either refuses it cleanly or shows a quiet unavailable state - none
hang:

```
/match/18143850/report        -> "No report on file" panel (HTTP 200)
/api/match-timeline/18143850  -> { timeline: null }
POST /api/enter (live)        -> {"error":"No such fixture."}  HTTP 404
/api/stream/18143850?mode=live   -> event: fault "Fixture 18143850 not found." then closes
/api/stream/18143850?mode=replay -> HTTP 404 "No replay on file for that one."
```

World Cup paths are unaffected: `/match/18237038/report` (France v Spain)
still returns HTTP 200 with a full report (zero "No report on file" panels).

## Suites green

```
npm run test:fold      All fold checks passed.
npm run test:badges    All badge checks passed.
npm run test:signing   All signing checks passed.
npx tsc --noEmit       clean
npm run build          compiled
```

Em-dash scan on all changed source and this doc: clean, none present. Zero
changes under `src/lib/state`, `src/lib/config`, `supabase/`.

## Cleanup

The `WCONLY` player signed to exercise the enter path (its friendly enter
attempt was rejected 404, so it produced no entries) was deleted via the
service-role admin path.

---

Report for review. Not merged to main, not deployed.

# SMOKE-RESOLVE: production resolution bug (live entries not resolving)

Captured 2026-07-15 on branch `hotfix-resolve-sweep`. Real users entered
yesterday's live France v Spain (fixture 18237038, final 0-2) and their
entries did not resolve into their careers. Diagnosed, fixed, and
deployed.

## 1. Diagnosis: the entries

All entries on 18237038 (queried with the anon key; 8 total, all live,
none exhibition). Before the fix, 6 were unresolved:

```
player   min  side            mult   state       score  pts
17d4ed6e 39   France          8.30   resolved    0-2    0     (watcher)
5b34efdb 42   Spain           3.51   UNRESOLVED   -      -    <- Spain, would score
960d0ed8 43   France          8.36   UNRESOLVED   -      -
3e1bc883 44   France          8.32   UNRESOLVED   -      -
402bd69e 46   France          8.34   UNRESOLVED   -      -
8498f241 46   Spain           3.68   UNRESOLVED   -      -    <- Spain, would score
336721c6 50   France          8.30   resolved    0-2    0     (watcher)
8c8f1ed9 51   France          8.44   UNRESOLVED   -      -
```

The two that resolved belonged to watchers whose tabs were open through
full time. Two of the unresolved were Spain backers (Spain won 2-0) who
should have scored.

## 2. Root cause

`/api/resolve` resolves ONLY the current cookie player's entry, and it is
called by that player's match screen when it detects full time. If the
entry owner closed the tab before the whistle, resolution never fired for
their entry. Resolution depended on each entry owner watching to the end.

## 3. Fix

- The resolution core is extracted into `src/lib/server/resolve-entry.ts`
  (`loadFixtureFold`, `resolveEntryAgainst`), shared by the route and the
  sweep. It resolves from the event-sourced log; the fold is
  deterministic, so this is safe and idempotent (the update is guarded on
  `resolved_at` still being null).
- `resolveFixtureEntries(fixtureId)` resolves EVERY unresolved entry on a
  fixture from one fold. `/api/resolve` now calls it, so the first watcher
  to reach full time settles everyone's entries on that fixture, not just
  their own. (France v Spain had two watchers reach full time, so this
  alone resolves all eight in real time.)
- Backstop: `/api/cron/resolve` runs `resolveFinishedEntries()` (sweep of
  every finished fixture with unresolved entries), protected by
  `CRON_SECRET`. Mechanism: a Vercel Cron in `vercel.json`,
  `"0 2 * * *"` (daily at 02:00 UTC). Daily is the Hobby-plan cron limit;
  the whole-fixture resolution above makes sub-daily unnecessary in
  practice, and the daily sweep guarantees resolution for any fixture
  nobody watched.
- `src/lib/sources/live.ts`: the score and odds interval sweeps in
  `getLog` are now capped at kickoff + 3.5h and fetched concurrently, so
  folding a day-old finished fixture is a quick bounded burst rather than
  a day of empty sequential calls (this is what let the sweep run at all).

### Run once now

The backlog was cleared by running the sweep once against production:

```
sweep done in 22s
13 entries resolved, 0 errors, 0 skipped
```

## 4. Verify

Every 18237038 entry resolved, from the fold (queried after the sweep):

```
player   min  side     mult   score  points   report      why
17d4ed6e 39   France   8.30   0-2    0        model       conceded in window, lost
5b34efdb 42   Spain    3.51   2-0    84.3     template     goal + clean sheet + win, x3.51
960d0ed8 43   France   8.36   0-2    0        template     lost
3e1bc883 44   France   8.32   0-2    0        template     lost
402bd69e 46   France   8.34   0-2    0        template     lost
8498f241 46   Spain    3.68   2-0    88.3     template     goal + clean sheet + win, x3.68
336721c6 50   France   8.30   0-2    0        model        lost
8c8f1ed9 51   France   8.44   0-2    0        template     lost
```

The sweep-resolved France entries (0) match the two a watcher had already
resolved (0), proving the fold is consistent whether resolved live or a
day later. Gazette reports: 8/8 stored. Badges: every player carries
First Whistle (their debut). Careers and The Table updated: production
`/api/matchday` now tops with AKINSUYI 88.3 and EMMY 84.3 (the two Spain
backers), who previously had nothing.

Deployed cron endpoint verified on production:

```
GET /api/cron/resolve (no bearer)          -> 401
GET /api/cron/resolve (Bearer CRON_SECRET) -> 200 { resolvedCount: 0 }   (backlog already clear)
```

Deployed loop intact: /, /api/schedule, /api/matchday, /judges,
/match/18237038/report all 200.

## 5. Regression

- MINOS's and FEJIRO's existing resolved entries are untouched: the sweep
  only reads unresolved rows. Their Argentina v Switzerland live flops
  stay at 0 points; MINOS's and JUJU's Argentina v Egypt exhibition rows
  stay 3-2 / 247.6 and 240.1.
- The exhibition rule is untouched: exhibition entries still carry their
  flag and stay out of the competitive numbers.
- Suites: fold 30/30, badges 36/36, signing 35/35. tsc and build clean.
  Em-dash scan over new and changed files: clean.

## Note on the deploy scope

This deploy promoted current `main` (which already carried the exhibition
rule, merged in a prior task) plus this fix. Production had been running a
pre-exhibition build, so besides fixing resolution this deploy also
activates the exhibition rule that was already applied to the database
(MINOS 82.5 -> 0, JUJU 120.0 -> 0 on The Table, the exhibition entries now
excluded). The database and code are now consistent. No other feature
changed; my code changes are limited to the resolution fix.

## Files

- `src/lib/server/resolve-entry.ts` (new: shared resolution + sweep)
- `src/app/api/cron/resolve/route.ts` (new: cron endpoint)
- `vercel.json` (daily cron), `src/app/api/resolve/route.ts` (whole-fixture)
- `src/lib/sources/live.ts` (bounded, concurrent log fetch)

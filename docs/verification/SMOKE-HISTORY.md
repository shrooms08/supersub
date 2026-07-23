# SMOKE-HISTORY - Full tournament history

Feature branch `tournament-history` off main. Production is FROZEN; nothing
here is deployed and nothing is merged. This document is the evidence gate.

The RESULTS tab used to show the 12 most recent finished fixtures. It now
carries every finished fixture the feed can supply, grouped by UTC day with
LiveScore-style day headers, newest day first, paginated by day so neither
the server nor the client handles everything at once.

## What changed (and what deliberately did not)

Three files, all additive except the tab render:

```
 M src/app/page.tsx            RESULTS tab now reads the paginated history feed
?? src/app/api/results/route.ts   GET /api/results?page=N
?? src/lib/server/results.ts   day list + per-fixture score cache + pagination
```

Zero changes under the frozen surfaces:

```
$ git diff --stat main -- src/lib/state src/lib/config supabase
(empty)
```

`src/lib/server/schedule.ts` is untouched: `canonicalFinalScore` and the
`ResultFixture` type are imported from it, not modified. No scoring path,
schema, or entry path moved. This is a read-only history wall.

## Performance: the whole point

The naive version - fold every fixture's event log on page load - is exactly
what this avoids. Three mechanisms keep it cheap:

1. **The day LIST is metadata only.** One `/fixtures/snapshot` call for the
   whole tournament, grouped by UTC day. It carries no scores, so it is
   tiny, and it is cached for ~10 minutes (`DAY_LIST_TTL_MS`).
2. **Each canonical score is cached per fixture, for hours.** The score
   comes from the `game_finalised` Score map on `/scores/snapshot/{id}` (the
   SMOKE9 path, `canonicalFinalScore` - never a fold of the whole log). A
   finished match's score is immutable, so it is cached for 6 hours
   (`SCORE_TTL_MS`).
3. **A request returns one PAGE of days** (`DAYS_PER_PAGE = 4`). Only the
   days on that page have their scores fetched. Opening the tab pays for the
   most recent four days; older days are fetched when the client asks for
   them via a "Load older results" button.

### Measured, cold cache then warm (server freshly started)

```
GET /api/results?page=0
attempt 1: HTTP 200 in 3.118s   <- cold: snapshot fetch + scores for 4 days
attempt 2: HTTP 200 in 0.0026s  <- warm: both caches hit
attempt 3: HTTP 200 in 0.0023s
attempt 4: HTTP 200 in 0.0023s
attempt 5: HTTP 200 in 0.0022s
```

Cold page 0 is ~3.1s (one snapshot call plus the canonical scores for the
first four days' fixtures, fetched in parallel). Warm is ~2ms: the day list
and every score on the page are served from cache. Paging older is the same
shape - the first visit to a page pays for that page's scores (page 1 cold
was ~8s on this run because its four days hold more fixtures), and every
revisit is a cache hit. No page ever folds a log or fetches the whole
tournament.

## The full list, both widths, day-grouped

Page 0 payload (server reports the totals for the whole tournament, not just
the page):

```
page 0  hasMore true  totalFinished 152  totalDays 38
  SUN 19 JUL (2026-07-19)  1 fixture   Spain 1-0 Argentina           report
  SAT 18 JUL (2026-07-18)  2 fixtures  France 4-6 England            report
                                       Vietnam (no score) Myanmar    FT, no report
  WED 15 JUL (2026-07-15)  1 fixture   England 1-2 Argentina         report
  TUE 14 JUL (2026-07-14)  1 fixture   France 0-2 Spain              report
```

- Mobile (390): `docs/smoke/results-history-mobile.png` - RESULTS **152**,
  day headers "SUN 19 JUL / SAT 18 JUL / WED 15 JUL / TUE 14 JUL"
  newest-first, flags, final scores, FULL TIME, and the "LOAD OLDER RESULTS"
  button.
- Desktop (1280): `docs/smoke/results-history-desktop.png` - the same wall in
  the two-column bench layout.

152 finished fixtures across 38 UTC days, four days per page (10 pages). The
tab count and the masthead fixture total both read from `totalFinished`, so
they report the whole history, not the loaded slice.

## The three named fixtures, matching reality

Paged through all 10 pages and located each target:

```
18202701  Argentina v Egypt        TUE 7 JUL   3-2                     report
18202783  Switzerland v Colombia   TUE 7 JUL   0-0, SWI pens 4-3       report
18237038  France v Spain           TUE 14 JUL  0-2                     report
```

- Argentina v Egypt **3-2** (the SMOKE9-corrected score, not 3-1).
- France v Spain **0-2**.
- Switzerland v Colombia **0-0** with the penalties subline. It renders as
  **"SWI advanced on penalties 4-3"** - `SWI` is the app's existing
  `teamCode` abbreviation for Switzerland, the same helper the Scoreboard and
  Match Report already use, so the RESULTS wall matches every other surface.
  `docs/smoke/results-history-pens.png` captures the Switzerland 0-0 Colombia
  card with that subline, and Argentina 3-2 Egypt directly beneath it on the
  same day.

## Requirement 3: no canonical score means FT, no invented number

Vietnam v Myanmar (18143850, a friendly) has no canonical score. It renders
FULL TIME with **NO SCORE** and no report link - never a guessed scoreline.
Confirmed in both the payload (`score: null, scoreless: true, hasReport:
false`) and the mobile/desktop screenshots.

## Requirement 4: rows link to the report only where one exists

`hasReport` comes from `reportAvailable(fixtureId, hasCanonicalScore)` (the
Match Detail cache path). A row links to `/match/{id}/report` only when true;
the scoreless friendly above has no link. No dead clicks.

## Requirement 5: read-only, playability guard untouched

Entering a finished fixture still returns 409. `src/lib/playability.ts` is
unchanged; verified against a real finished feed fixture:

```
$ curl -X POST /api/enter -d '{"fixtureId":18237038,"team":1,"mode":"live"}'
{"error":"That one is in the books."}
HTTP 409
```

## Suites green

```
npm run test:fold      All fold checks passed.
npm run test:badges    All badge checks passed.
npm run test:signing   All signing checks passed.
npx tsc --noEmit       clean
npm run build          compiled, /api/results registered
```

Em-dash scan on the changed source (`page.tsx`, `results.ts`,
`api/results/route.ts`): clean, none present.

## Cleanup

The `HISTORY` player signed to demonstrate the 409 (its enter attempts were
all rejected, so it produced no entries) was deleted via the service-role
admin path; 0 stray entries confirmed.

---

Report for review. Not merged to main, not deployed.

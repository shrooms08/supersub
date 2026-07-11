# SMOKE11: The Fixtures (real World Cup schedule on the bench)

Captured 2026-07-11, ahead of Norway v England (kickoff 21:00 UTC
tonight). The bench previously showed only the three bundled replay
fixtures under a false "today's fixtures" label. It now shows the real
schedule in four bands, read-only, with the bundled replays kept as
their own clearly labelled rail.

## What was built

- `src/lib/server/schedule.ts`: the schedule data source. Fixtures from
  the TxLINE `/fixtures/snapshot?startEpochDay=` endpoint (14-day
  lookback); phase (upcoming / live / finished) derived from kickoff
  time because the snapshot carries no status field (the spike found
  `GameState` unreliable). Result scores come from each finished
  fixture's CANONICAL final state, the `game_finalised` Score map on
  `/scores/snapshot/{id}` (the exact path proven in SMOKE9), never by
  folding whole historical logs. A 10-minute in-memory cache wraps the
  whole build; any upstream failure degrades to an empty schedule with
  a note, never an error page.
- `src/app/api/schedule/route.ts`: additive, read-only endpoint. The
  older `/api/fixtures` is left untouched for the smoke and live-verify
  scripts. The bundled replay rail is assembled independently of the
  live feed, so it survives a dead token.
- `src/app/page.tsx`: the bench rebuilt into TODAY, COMING UP, RESULTS,
  and a REPLAYS rail.
- `src/components/FixtureCard.tsx`: a final-score centre block for
  finished fixtures, a penalties subline, and a days/hours countdown
  beyond 48 hours.

No schema change, no scoring change. This is a read-only feature.

## 1. The feed path, verified live

`GET /api/schedule` against the local production build (`npm run build`
then `npm start`):

```
cold (uncached build): 200 in 3.39s
warm (10-min cache):   200 in 0.004s
```

Payload contents (abridged), all matching reality:

```
error: null   liveNow: false
TODAY:      Norway v England [upcoming] 21:00 UTC
COMING UP:  Sunday 12 July (1), Tuesday 14 July (1), Saturday 18 July (1),
            Friday 25 September (1), Tuesday 29 September (1)
RESULTS (12, most recent first):
  Spain v Belgium          2-1
  France v Morocco         2-0
  Switzerland v Colombia   0-0   pens 4-3
  Argentina v Egypt        3-2
  USA v Belgium            1-4
  Portugal v Spain         0-1
  ... (six more)
REPLAYS:    Argentina v Egypt, Switzerland v Colombia, France v Morocco
            (mode replay, the judges' path)
```

Assertions checked in the payload:

- Norway v England is in TODAY, phase upcoming: PASS
- Argentina v Egypt appears in RESULTS at 3-2, matching the SMOKE9
  audit and reality: PASS
- Switzerland v Colombia shows 0-0 with the item-7 penalties line
  ("SUI advanced on penalties 4-3"): PASS

The canonical-score path was also exercised directly:

```
canonicalFinalScore(18202701) -> {score:{p1:3,p2:2}, pens:null}
canonicalFinalScore(18202783) -> {score:{p1:0,p2:0}, pens:{p1:4,p2:3}}
```

## 2. The bench, rendered

Full-page mobile capture (`bench-mobile.png`) confirms, top to bottom:

- TODAY: Norway v England, UPCOMING chip, live countdown ticking
  ("02:11:59" at capture), and the disabled "LINEUPS DROP AT KICKOFF ·
  SET YOUR ENTRY" state (a real disabled state, not a dead button). A
  fixture between kickoff and roughly FT+30 shows the volt LIVE pulse
  chip instead; tonight's fixture is still upcoming so none is live yet.
- COMING UP: grouped by UTC date (Sunday 12 July, Tuesday 14 July, and
  so on), each fixture with a days/hours countdown.
- RESULTS: Spain 2-1 Belgium, France 2-0 Morocco, Switzerland 0-0
  Colombia with "SWI ADVANCED ON PENALTIES 4-3", Argentina 3-2 Egypt,
  and eight more, most recent first.
- REPLAYS rail: the three bundled fixtures, "DEMO · JUDGES" tag, each
  with a live ENTER THE MATCH action.

Live fixtures wire ENTER THE MATCH to `?mode=live`; the replay rail
wires to `?mode=replay`. Upcoming fixtures have no button, only the
disabled lineups state.

## 3. Read-only guarantee

`npx tsc --noEmit` clean; `npm run build` clean. Suites unchanged by
this feature:

```
test:fold     30/30
test:badges   30/30
test:signing  35/35
```

The match, enter, and resolve loop is untouched. If the schedule feed
or its token were to fail, the bench shows a "schedule feed
unavailable" note and the REPLAYS rail (bundled, no network) still
carries the judges' path, so the deployed loop is never at risk.

## Limitations (honest)

- Phase is time-derived, not fed. A fixture reads LIVE from kickoff to
  kickoff + 150 minutes (covers 90 plus stoppage, half time, and extra
  time). A match that ends early still reads LIVE until that window
  closes, and one that runs very long could flip to finished a little
  early. The schedule feed gives no real full-time signal, so this is a
  deliberate heuristic.
- RESULTS shows the twelve most recent finished fixtures; older ones
  are not listed (not scoreless, just off the wall).
- A finished fixture whose feed has no canonical Score-bearing record
  renders as "FT / no score" rather than a guess. None of the current
  twelve hit this path.
- Scores are read from the last Score-bearing snapshot record, which
  for a finished match is the game_finalised map. A match still in play
  but past the 150-minute window (rare) could show a non-final score;
  the results wall only lists previous-day fixtures, so this does not
  affect it in practice.

## Files

- `src/lib/server/schedule.ts` (new)
- `src/app/api/schedule/route.ts` (new)
- `src/app/page.tsx` (bench rebuilt)
- `src/components/FixtureCard.tsx` (final score, pens line, countdown)

## 4. Deployed and verified in production

Committed `f2e82dd`, deployed to production (Vercel, deployment
`supersub-b4c1qe7rf`) at ~19:18 UTC, ahead of the 21:15 deadline. The
`vercel --prod` deploy reassigned the project's configured aliases; the
canonical `supersub-tau.vercel.app` was not in that set and was
re-pointed at the new build explicitly.

```
GET https://supersub-tau.vercel.app/api/schedule -> 200 in 0.90s
  error: null   liveNow: false
  TODAY:   Norway v England [upcoming]           (kickoff 21:00 UTC tonight)
  RESULTS: 12, incl. Argentina 3-2 Egypt and Switzerland 0-0 (pens 4-3)
  REPLAYS: 3 bundled

Deployed loop unaffected:
  GET /                        -> 200
  GET /api/fixtures            -> 200   (older endpoint, untouched)
  GET /match/18209181?mode=replay -> 200
```

Production assertions (Norway v England in TODAY, Argentina 3-2 Egypt
and Switzerland pens 4-3 in RESULTS, three replays) all pass against
the live canonical URL.

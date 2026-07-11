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

## 5. Playability rules + tabs pass (2026-07-11, later)

Two-part read-only-plus-one-guard pass on the bench. No scoring or
schema change. Deployed to production (deployment supersub-fis1hpqxj,
canonical alias re-pointed).

### Part 1: server-enforced playability

`src/lib/playability.ts` holds the three bundled replay ids
(18202701, 18202783, 18209181), a live-window helper, and the
broadcast-voice copy. Enforced in the entry and stream endpoints, not
just the UI:

- Enter, replay mode, non-bundled id -> 409 before touching the source.
- Enter, live mode -> a cheap time-based gate (kickoff to ~FT+30)
  rejects upcoming and finished fixtures before folding a potentially
  days-long live log (folding one to reject it was hanging the request;
  the time gate fixed it).
- Stream, replay mode, non-bundled id -> 404. Live-mode watching of any
  real fixture stays open (watch-or-read only, as specified).

Proven over HTTP on the local production build (player SMOKE-GUARD,
removed after):

```
A) POST /api/enter {18218149 (Spain v Belgium, finished), mode:live}
   -> 409 {"error":"That one is in the books."}
B) POST /api/enter {18218149, mode:replay}
   -> 409 {"error":"No replay on file for that one."}
C) GET  /api/stream/18218149?mode=replay   -> 404
   GET  /api/stream/18209181?mode=replay   -> 200 (bundled, still works)
```

Re-checked on production (supersub-tau):

```
GET /api/stream/18218149?mode=replay  -> 404
GET /api/stream/18209181?mode=replay  -> 200
```

Finished real fixtures keep showing their final score with no enter
path; upcoming keep the disabled LINEUPS state; the three bundled
replays remain fully playable.

### Part 2: LiveScore-style tabs

The single scrolling band stack is now three tabs, default TODAY, with
the tab in `?tab=` so a link can deep-land:

- TODAY: today's fixtures, a live match pinned to the top under the
  volt pulse with ENTER wired to live mode; countdown / LIVE / FT as the
  day turns. (Norway v England shows here with its countdown.)
- RESULTS: finished fixtures grouped by day, newest day first, with
  LiveScore day headers (FRI 10 JUL, THU 9 JUL, ...), score on the
  right, the pens convention where it applies (SWI advanced on penalties
  4-3).
- UPCOMING: future fixtures grouped by day with day headers and
  countdowns on the near ones.

The REPLAYS rail stays outside the tabs, labeled DEMO / JUDGES. The
10-minute schedule cache is untouched; switching tabs is pure client
render, no extra feed calls.

Screenshots (in `scratchpad/tab-shots/`), all three tabs at 390px and
1280px: `tab-today-mobile.png`, `tab-results-mobile.png`,
`tab-upcoming-mobile.png` and the `-desktop` set. Body assertions at
both widths: TODAY, RESULTS, UPCOMING, REPLAYS all present, day-header
pattern (`SAT 11 JUL`) matches. Desktop keeps the two-column layout
(tabs left, replays rail plus table right); mobile stacks and the tab
bar stays usable at 390px.

### Verification

```
fold 30/30, badges 30/30, signing 35/35   (untouched)
tsc + npm run build                        clean
Deployed URL checked:
  GET https://supersub-tau.vercel.app/?tab=results  -> 200
  GET https://supersub-tau.vercel.app/api/schedule  -> 200
  stream guard live (404 / 200 above)
```

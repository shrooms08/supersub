# SMOKE-DETAIL: Match Detail ("the full story")

Captured 2026-07-12 on branch `match-detail` (off main). Read-only:
no scoring, schema, or entry-path change; the playability guard is
untouched (viewing a finished match is always allowed, entering it
still 409s). Result rows and finished cards open
`/match/[fixtureId]/report`, the broadcast timeline of a finished match.

## What was built

- `src/lib/server/match-timeline.ts`: builds the timeline through the
  EXISTING normalization + fold over the historical log, and caches the
  result per fixture id.
- `src/app/match/[fixtureId]/report/page.tsx` + `src/components/MatchReport.tsx`:
  the page and its broadcast UI (glyph chips, minute, team flag, name;
  VAR-overturned goals struck through; period section breaks).
- Wiring: `schedule.ts` marks each result `hasReport`; `FixtureCard`
  links finished rows to the report when it exists; the resolution
  screen links to the story after a replay resolves (a demo beat);
  `next.config.mjs` traces the bundled data into the report route.

## Data + caching

The timeline is computed via `normalizeMatchEvent` + `foldMatch` over
the full historical log, exactly the pipeline the live and replay
screens use. It is NEVER folded per page view: `getMatchTimeline`
caches the computed timeline in a per-instance in-memory Map, keyed by
fixture id.

- Cache: `Map<fixtureId, {at, timeline}>`, TTL 60 min, capped at 64
  entries (oldest evicted). A finished match is immutable, so the TTL
  exists only to bound memory over a long-lived instance, not for
  freshness. Serverless instances are ephemeral, so a cold instance
  recomputes once; within an instance, the second and later requests are
  a Map lookup with no re-fold.
- Proof (a `timelineComputeCount()` hook counts actual computes):

```
computeCount initial: 0
first load 18202783:  15ms   computeCount -> 1
second load 18202783: 0ms    computeCount -> 1   (cache hit, no re-fold)
load two more fixtures       computeCount -> 3
re-load 18202701             computeCount -> 3   (still no re-fold)
```

- The known cost is real and is why the cache exists. A days-old real
  fixture must be reassembled from sealed 5-minute intervals. Two fixes
  keep it sane: the sweep is capped at kickoff + 3.5h (not "now", which
  for a days-old match is thousands of empty intervals), and the
  intervals are fetched concurrently. Measured on the real Norway v
  England fixture:

```
before (sweep to now, serial):   first load 32.8s
after  (cap 3.5h, serial):       first load 20.0s
after  (cap 3.5h, concurrent):   first load  3.1s,  cached 0.01s
bundled replay (local files):    0.01s
```

## Player names (resolve, never invent)

Names are resolved ONLY against a lineups roster present in the source
log for that fixture. A goal/card `Data.PlayerId` is read from the
CONFIRMED instance of the action only (the spike finding: unconfirmed
duplicates carry no id), matched against the roster by both
`normativeId` and `fixturePlayerId`. Where no roster exists, events show
team and minute and no name. An unresolvable id is dropped silently. No
name is ever invented.

Finding, contrary to the brief's assumption: the bundled logs are NOT
uniformly roster-free. Two of the three carry a `lineups` event and
resolve real names:

```
18202701 Argentina v Egypt   roster: NO   -> nameless (team + minute)
18202783 Switzerland v Colombia roster: YES -> Xhaka, Amdouni, Sow, ...
18209181 France v Morocco     roster: YES -> Mbappe Lottin, Dembele, ...
```

So Argentina v Egypt is the clean no-roster example (its coverage starts
at the second half, before any lineups event), and the other two
demonstrate name resolution.

## Screenshots (scratchpad/detail-shots/, both widths)

- `report-argentina-{mobile,desktop}.png` (18202701): the money screen.
  Header ARGENTINA 3-2 EGYPT, FULL TIME. The 58' Egypt goal is shown
  STRUCK THROUGH with a "VAR: OVERTURNED" chip: the overturn is part of
  the story and our event-sourcing proof. Flags on every row. Bottom
  note: "No team sheet in the feed for this match, so events show the
  side and minute without player names. Nothing is guessed."
- `report-swiss-{mobile,desktop}.png` (18202783): header SWITZERLAND 0-0
  COLOMBIA, "AFTER EXTRA TIME · SWI ADVANCED ON PENALTIES 4-3" (the
  item-7 convention). Section breaks KICK OFF, HALF TIME, FULL TIME,
  EXTRA TIME, EXTRA TIME SECOND HALF, PENALTIES. Names resolved.
- `report-france-{mobile,desktop}.png` (18209181): FRANCE 2-0 MOROCCO,
  the 49' VAR overturn struck through, names resolved (Mbappe, Dembele).

Honest quirks, both inherent to the data and left as-is: on Argentina v
Egypt the "Kick off" break sits after the 46' substitution (that
fixture's coverage opens at the second half, and a halftime sub is
logged with a lower seq than the H2 restart), and stoppage-time rows can
read minute-jittered because ordering is by the authoritative event seq,
not the noisy clock. Egypt's first-half goal predates coverage, so it is
in the header score (3-2) but has no timeline row (no event exists);
that matches SMOKE9.

## Scope fences

- Bundled replays always link (local logs); after resolving a replay the
  resolution screen shows "Read the full match story" (demo beat).
- Real finished fixtures link only when the feed has a canonical score
  (`hasReport`), so there is never a dead click. Verified: the results
  tab rendered 12 report links, and clicking one opened a report.
- No entry paths anywhere on the report page. Verified over HTTP: every
  report page returns 200 and contains zero "ENTER THE PITCH". It is a
  newspaper, not a turnstile.

## Suites and hygiene

```
tsc --noEmit          clean
npm run build         clean (route /match/[fixtureId]/report present)
test:fold      30/30
test:badges    30/30
test:signing   35/35
```

Em-dash scan over every new and changed file: clean.

## Files

- `src/lib/server/match-timeline.ts` (new: builder + cache)
- `src/app/match/[fixtureId]/report/page.tsx` (new: route)
- `src/components/MatchReport.tsx` (new: UI)
- `src/lib/server/schedule.ts` (hasReport), `src/components/FixtureCard.tsx`
  (report link), `src/app/page.tsx` (pass reportHref),
  `src/components/ResolutionOverlay.tsx` (story link), `next.config.mjs`
  (file tracing)

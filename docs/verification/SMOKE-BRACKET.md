# SMOKE-BRACKET - Knockout bracket view

Feature branch `bracket` off main. Operator ruling on the prior
investigation: **Option 1 - knockout bracket only, no invented or inferred
group letters.** Read-only; production stays as-is.

The feed exposes tournament structure only as an opaque numeric
`FixtureGroupId` that partitions fixtures into stages. It carries no round
name, no group letter, and its numeric order does not match round order.
Stage identity is therefore **inferred from fixture counts and dates**, never
read from the feed, and documented as such in code.

## What was built

```
?? src/lib/server/bracket.ts     stage classification + champion, cached
?? src/app/api/bracket/route.ts  GET /api/bracket
?? src/app/bracket/page.tsx      the view (server-rendered)
?? src/lib/teams.ts              teamCode, extracted server-safe (see note)
 M src/lib/feed/types.ts         Fixture gains optional competitionGroupId
 M src/lib/feed/normalize.ts     competitionGroupId: num(raw,"FixtureGroupId")
 M src/lib/server/results.ts     cachedScore exported (shared score cache)
 M src/components/Scoreboard.tsx re-exports teamCode from the new lib
 M src/app/page.tsx              "Knockout bracket" link on the bench
```

Zero changes under `src/lib/state`, `src/lib/config`, `supabase/`. No
scoring, schema, or entry path touched.

## Stage mapping (inferred from counts, documented in code)

`bracket.ts` partitions WC fixtures by `FixtureGroupId`, then names each
partition from its size and date - the mapping is unambiguous for a
single-elimination knockout:

```
16 fixtures -> Round of 32        8 -> Round of 16
 4 fixtures -> Quarter-finals     2 -> Semi-finals
 1 fixture  -> Final (latest) or Third-place playoff (earlier, by date)
```

The group stage is the one remaining partition far larger than any knockout
round (48 teams, 74 fixtures). It is **not** drawn as structure. Verified
live via `/api/bracket`:

```
champion: Spain (fixtureId 18257739)
groupStageCount: 74   thirdPlace: France v England   error: null
Round of 32 (16)  Round of 16 (8)  Quarter-finals (4)  Semi-finals (2)  Final (1)
```

### Extension point for a future group half (requirement 5)

`classifyStages()` already isolates the group stage as its own partition
(`stage: "GROUP"`). A future static group-mapping file (fixtureId ->
"Group A".."Group L") slots in there and turns that one partition into twelve
labelled mini-tables **without** touching the knockout tree, the round logic,
or the champion. The code comments mark the seam.

## The champion, against reality (requirement 3)

Champion is the winner of the single Final fixture via `canonicalFinalScore`
alone. No canonical score would mean no crown (the view shows the final and
crowns no one). Live result:

```
Final: Spain 1-0 Argentina  ->  champion Spain
```

## Spain's full path renders correctly (requirement 8)

Traced through the rendered tree, each with winner derived from the canonical
score and a report link:

```
Round of 32     Spain 3-0 Austria        winner Spain   report yes
Round of 16     Portugal 0-1 Spain       winner Spain   report yes
Quarter-finals  Spain 2-1 Belgium        winner Spain   report yes
Semi-finals     France 0-2 Spain         winner Spain   report yes
Final           Spain 1-0 Argentina      winner Spain   report yes
```

Matches the operator's stated reality exactly (R32 Austria, R16 Portugal, QF
Belgium, SF France, Final Argentina).

## The view, both widths

- `docs/smoke/bracket-desktop.png` (1280): the full horizontal tree, one
  column per round, cards distributed so later rounds centre against earlier
  ones for the classic bracket pyramid. Champion banner on top; third-place
  playoff (France 4-6 England) below the spine; the group-stage line at the
  foot.
- `docs/smoke/bracket-mobile.png` (390): **the hard problem, solved
  deliberately.** A real tree does not fit 390px, so rounds STACK vertically -
  each round is a section with a sticky header (Round of 32 -> Final), full
  width match cards, read top to bottom. Same data, different layout, one
  responsive flex container (`flex-col` mobile, `lg:flex-row` +
  `lg:overflow-x-auto` desktop).

Each match card shows both flags, team names (winner bright and bold, loser
dimmed), the score, the penalties line where it applies (e.g. "PAR advanced
on penalties 4-3", "SWI advanced on penalties 4-3"), and a Report link only
where `hasReport` is true - no dead clicks.

## Group stage: one honest line (requirement 4)

No group letters anywhere. The group stage is a single section:

> 74 group-stage fixtures, listed by matchday in **Results**.

with "Results" linking to `/?tab=results`.

## Performance (requirement 7)

Canonical scores come from the shared `cachedScore` path (the SMOKE9
`game_finalised` map), never a log fold, and the same cache serves the
Results wall so a finished fixture's score is fetched once. The bracket
structure is cached ~10 min. Measured `/api/bracket`, server freshly started:

```
attempt 1: HTTP 200 in 5.078s   <- cold: structure + 31 knockout scores in parallel
attempt 2: HTTP 200 in 0.0048s  <- warm
attempt 3: HTTP 200 in 0.0020s
```

## Note: teamCode extraction

`teamCode` lived in `Scoreboard.tsx`, a `"use client"` component. Importing
it into the server-rendered bracket page crashed React's RSC serialization
("o is not a function"). Fixed by moving `teamCode` to a server-safe
`src/lib/teams.ts` and re-exporting it from `Scoreboard` so every existing
importer keeps working. Behaviour is identical.

## Suites green

```
npm run test:fold      All fold checks passed.
npm run test:badges    All badge checks passed.
npm run test:signing   All signing checks passed.
npx tsc --noEmit       clean
npm run build          compiled, /bracket and /api/bracket registered
```

Em-dash scan on all changed source and this doc: clean, none present.

---

Report for review. Not merged to main, not deployed.

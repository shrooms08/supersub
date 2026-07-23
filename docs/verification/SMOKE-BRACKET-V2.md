# SMOKE-BRACKET-V2 - Mirrored bracket redesign

Feature branch `bracket-v2` off main. The v1 `/bracket` was a one-directional
column cascade; this redesigns it into a **mirrored tournament tree** - two
halves of the draw converging on a centred Final with the champion above it.
Built to match the STRUCTURE of the two reference images (mirrored converging
tree, connector lines, mirrored round labels, third-place near centre); the
brand system is binding, so styling is ours.

Read-only. No scoring or schema change; the cached score path is reused.

## What changed

```
 M src/lib/server/bracket.ts   buildBracketTree(): thread the halves from the Final
 M src/app/bracket/page.tsx    mirrored desktop tree + mobile stacked rounds
```

Two files. Everything else the view needs (the `/api/bracket` route, the
`FixtureGroupId` feed field, the shared `cachedScore` path, `teams.ts`) is
already in main from v1. Zero changes under `src/lib/state`,
`src/lib/config`, `supabase/`.

## The halves are derived, not guessed (requirement 2)

`buildBracketTree` works backward from the Final by team identity: the
Final's two participants are the finalists; each finalist's Semi-final roots
one half; a match in round r+1 has two participants, each of which is the
winner of exactly one match in round r, so the two feeders are found by name.
Recurse to the Round of 32 (the leaves). **If any feeder is missing or
ambiguous, the fixture is pushed to `unplaceable` and the page refuses to
draw a tree** rather than guess.

Verified against the live feed:

```
UNPLACEABLE: 0
node counts per round (both halves): R32=16  R16=8  QF=4  SF=2   (a perfect
  binary tree using every knockout fixture exactly once)

LEFT half (Spain):     France 0-2 Spain | Spain 2-1 Belgium | Portugal 0-1 Spain | Spain 3-0 Austria
RIGHT half (Argentina): England 1-2 Argentina | Argentina 3-1 Switzerland | Argentina 3-2 Egypt | Argentina 3-2 Cape Verde
Final: Spain 1-0 Argentina -> champion Spain
```

Spain's path matches the operator's stated reality (R32 Austria, R16
Portugal, QF Belgium, SF France, Final Argentina).

## Desktop: the mirrored tree (requirements 1, 3, 4, 5)

`docs/smoke/bracket-v2-desktop.png` (captured as the bracket element, 2x).

- **Mirrored layout.** Left half flows left to right (Round of 32 ->
  Semi-final); right half mirrors it right to left; they meet at the Final in
  the centre, with the **champion (Spain) displayed prominently above it**.
- **Computed coordinates.** Every node's (x, y) comes from the tree - leaves
  get evenly spaced slots, each parent sits at the mean of its two children -
  so the SVG connector elbows and the absolutely-positioned cards share one
  coordinate system and align exactly.
- **Connector lines** join each pair into its next-round match. The
  **champion's road to the title is drawn in volt** (Spain's cards and the
  connectors threading them from the Round of 32 through to the Final); every
  other connector is dim.
- **Round labels** head each column, mirrored on both sides: ROUND OF 32,
  ROUND OF 16, QUARTER-FINAL, SEMI-FINAL, and FINAL at centre.
- **Third-place playoff** (France 4-6 England) is a small, clearly labelled
  card just below the Final.

## Mobile: stacked rounds + champion hero (requirement 6)

`docs/smoke/bracket-v2-mobile.png` (390px).

A mirrored tree is impossible at 390px, so - as documented in the page
header comment - mobile **keeps the vertical stacked-rounds layout** (sticky
round headers, cards read top to bottom) and **adds the champion as a hero at
the very top**. Same data, honest divergence.

## Brand system (requirement 7)

Near-black surfaces; volt (#c8ff00) reserved for the champion, the
winning-path connectors, and the champion-path card borders. Winners are
bright and bold, losers dimmed. Every match card keeps flags, teams, score,
the penalties line where it applies (e.g. "PAR pens 4-3", "SWI pens 4-3"),
and a report link only where `hasReport` is true - no dead clicks.

## Performance (requirement 8)

Canonical scores reuse the shared `cachedScore` path (the SMOKE9
`game_finalised` map), never a log fold; the bracket structure is cached ~10
min. The tree topology is pure in-memory work on the already-fetched
payload. Measured, server freshly started:

```
/bracket   page attempt 1: 3.416s (cold: SSR + structure + 31 knockout scores)
           page attempt 2: 0.021s (warm)
/api/bracket            :  0.013s cold cache shared with the page / 0.002s warm
```

## Suites green

```
npm run test:fold      All fold checks passed.
npm run test:badges    All badge checks passed.
npm run test:signing   All signing checks passed.
npx tsc --noEmit       clean
npm run build          compiled, /bracket and /api/bracket registered
```

Em-dash scan on the changed source and this doc: clean, none present.

## Note on the reference images

The two reference images were described in the brief but did not come through
as viewable attachments on my side. I built to the written structural spec
(mirrored converging tree, connectors, mirrored labels, third-place below the
centre, champion at centre) and the binding brand system. If a specific
structural detail of the references differs from what shipped, point me at it
and I will adjust.

---

Report for review. Not merged to main, not deployed.

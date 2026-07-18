# SMOKE-FINAL: flags in the scoreboard, names in the live ticker

Captured 2026-07-12 on branch `final-flags-names` (off main). The last
pass before the hackathon freeze. Both items are display-only: no
scoring, no schema, playability guard untouched. Verified against the
live Argentina v Switzerland fixture (18222446), in play during capture.

## 1. Flags in the match scoreboard

The broadcast bug on the live/replay match screen previously showed the
three-letter team codes (ARG / SWI) in its two pinstriped blocks. Each
block now renders the team flag from the shared flags module, the same
emoji the bench fixture cards use. The block keeps its fixed size
(36px mobile, 46px desktop), so there is no layout shift in the sticky
header; a team with no flag mapping keeps the three-letter code, so the
block is never blank.

Capture (`match-{mobile,desktop}.png`): the bug shows the Argentina and
Switzerland flags flanking the score at both widths.

## 2. Player names in the live ticker

The ticker rows now show the resolved surname where the roster resolves
it, reusing the Match Detail resolver (lineups roster + confirmed
Data.PlayerId) verbatim. A new read-only endpoint
`/api/match-timeline/[fixtureId]` returns the computed timeline (cached
60s live / 60 min finished by the existing builder); the match screen
fetches it on mount and every 45s, keys the resolved names to the
ticker's own action ids, and renders them. Goals and cards show the
scorer/booked player; substitutions show "X on, Y off" when both
resolve.

Live 18222446 resolved, from the endpoint and visible in the ticker:

```
goal        Mac Allister (Argentina)
goal        Ndoye (Switzerland)
yellow      Embolo,  red  Embolo,  yellow  Paredes
sub         Gonzalez on, Tagliafico off
sub         Amdouni on, Rieder off
sub         Comart on, Rodriguez off   (and more)
```

Fallback is exactly as Match Detail: where there is no roster or the id
does not resolve, the row keeps its current team-only rendering and
nothing is invented. Confirmed instances only (the resolver reads
PlayerId from the confirmed action). A roster-less replay is unchanged:
Argentina v Egypt (18202701) reports `hasRoster: false`, 19 named
events, 0 resolved, so its ticker renders exactly as before.

## Evidence and hygiene

- `scratchpad/fn-shots/match-{mobile,desktop}.png`: the live match
  screen with flags in the scoreboard and resolved names in the ticker,
  both widths.
- `tsc --noEmit` clean, `npm run build` clean (route
  `/api/match-timeline/[fixtureId]` present). Suites: fold 30/30, badges
  30/30, signing 35/35. Em-dash scan over new and changed files: clean.

## Files

- `src/components/Scoreboard.tsx` (flag in the team block)
- `src/lib/server/match-timeline.ts` (action id on timeline events),
  `src/app/api/match-timeline/[fixtureId]/route.ts` (new endpoint)
- `src/components/MatchScreen.tsx` (fetch and pass names),
  `src/components/EventTicker.tsx` (render resolved names)

The codebase is frozen.

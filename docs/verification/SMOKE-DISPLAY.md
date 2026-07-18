# SMOKE-DISPLAY: pre-coverage goal marker (Issue 1) + home/away (Issue 3)

Captured 2026-07-15 on branch `display-polish`. Display-only; no fold,
scoring, or schema change. Suites green, em-dash clean.

## Issue 1 (shipped): goals in the score that are missing from the timeline

Detection: for each side, compare the goals we can render (goal events
plus penalty goals, net of VAR discards) to the header total (from the
cumulative score). A positive remainder is a goal with no event to place.

A discovery while implementing: the France v Spain case named in the
brief is NOT a pre-coverage case. The raw log shows full coverage from
the 1' kickoff, and the 22' Spain penalty IS in the feed, recorded as a
`penalty_outcome` ("Scored", PlayerId 463984), not a `goal` action, which
is why the timeline was dropping it. So the fix has two parts:

1. Render scored penalties. A `penalty_outcome` with Outcome "Scored"
   (in-play only, never a shootout, deduped against any goal event at the
   same side and minute) is rendered as a goal with a PENALTY tag and the
   scorer resolved from the roster. This reconciles France v Spain by
   SHOWING the goal, which is more honest than a banner.
2. Pre-coverage marker. After penalties, any remaining gap is a genuine
   pre-coverage goal (coverage opened after it, no event of any kind). A
   banner at the top of the timeline explains it, and never invents a
   scorer or minute.

### France v Spain (18237038): reconciles by showing the penalty

`scratchpad/disp-shots/francespain-{mobile,desktop}.png`. Header 0-2.
Timeline now shows both Spain goals: 22' GOAL [PENALTY] Oyarzabal Ugarte,
and 58' GOAL Porro (plus the 61' goal struck through as VAR: overturned).
preCoverage p1=0, p2=0, so no banner: the score reads fully explained.

### Argentina v Egypt (18202701): the genuine pre-coverage case

`scratchpad/disp-shots/argentinaegypt-{mobile,desktop}.png`. Header 3-2.
Egypt's first-half goal predates coverage (no event of any kind), so
after rendering the events (Egypt's 67' goal, Argentina's 79'/84'/92'),
Egypt is one short. preCoverage p2=1, and the banner reads, at the top:

> EARLIER GOALS NOT IN FEED
> Coverage opened mid-match: Egypt scored 1 goal before it. It is in the
> final score with no event below; counted, but no scorer or minute is on
> record.

The header total (3-2) plus the banner reconcile with the timeline: three
Argentina events, one Egypt event, one Egypt goal explained by the banner.
No scorer or minute is invented (this fixture also has no team sheet, so
its events are already nameless). This is the class SMOKE9 documented.

## Issue 3 (NOT shipped, and it did not need to be): home left / away right

Verified against the feed: `Participant1IsHome` is `true` on ALL 29
current fixtures, across both classes (5 Friendlies, 24 World Cup) with
zero false and zero undefined. So P1 = home is a reliable convention. And
all three surfaces already render Participant1 on the LEFT:

- Scoreboard: TeamBlock(participant1, home=participant1IsHome) left,
  TeamBlock(participant2, home=!participant1IsHome) right.
- Match report header: participant1 left, participant2 right.
- Bench fixture cards: participant1 left, participant2 right.

Therefore home-left / away-right ALREADY holds everywhere. France v Spain
already reads FRANCE (home, P1) left, SPAIN (away, P2) right, confirmed in
the screenshots above; spot-checks match reality for Argentina v Egypt
(Argentina left), Switzerland v Colombia, and France v Morocco.

No code change ships for Issue 3: the desired ordering is already correct
by the existing convention. Adding an explicit reorder-by-`IsHome` would
be a visual no-op that introduces a dependency on a flag I cannot verify
against an external source (this is simulated fixture data), which is the
"wrong mirror" risk the brief warned against. Safe outcome: leave it.

## Suites and hygiene

```
test:fold      30/30
test:badges    36/36
test:signing   35/35
tsc --noEmit   clean
npm run build  clean
```

Em-dash scan over new and changed files: clean.

## Files

- `src/lib/server/match-timeline.ts` (penalty goals, preCoverage detection)
- `src/components/MatchReport.tsx` (PENALTY tag, pre-coverage banner)

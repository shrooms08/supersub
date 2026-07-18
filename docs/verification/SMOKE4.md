# SMOKE4: the design pass (Phase 4)

Captured 2026-07-11. This pass changed presentation only: atmosphere,
type, density, and microcopy. The loop, scoring, and data layer are
untouched, and the evidence for that is at the bottom. One new
read-only endpoint was added (`GET /api/matchday`), exactly as the
brief allows, serving The Table, Legendary Entries, and the viewer's
form, per-fixture results, and next-badge tease.

## Before and after, all four screens

Screenshots in `docs/smoke4/before/` and `docs/smoke4/after/`, mobile
(390px) and desktop (1280px) for each:

| Screen | Before | After |
|---|---|---|
| The Bench | `before/bench-{mobile,desktop}.png` | `after/bench-{mobile,desktop}.png` |
| The Match (on the pitch) | `before/match-{mobile,desktop}.png` | `after/match-{mobile,desktop}.png` |
| Resolution | `before/resolution-{mobile,desktop}.png` | `after/resolution-{mobile,desktop}.png` |
| Career | `before/career-{mobile,desktop}.png` | `after/career-{mobile,desktop}.png` |

Both sets were produced by the same driver script (sign a player, play
France v Morocco at 60x as Morocco, resolve, visit the career page), so
the comparison is like for like.

## What changed

Global: Archivo (variable weight and width) self-hosted via next/font
as the display face; hero numbers set condensed, the masthead set
expanded. The page background is a CSS-only atmosphere stack (vignette,
SVG grain, mown-pitch stripes, floodlight wash); cards are `.panel`
surfaces with an inner hairline and a soft outer glow on hover. No new
dependencies beyond the font.

The Bench is a matchday hub: MATCHDAY masthead with date and an in-play
beacon, the kit card (shirt-and-number silhouette, Impact Rating hero,
form chips, next locked badge teased), fixture cards with competition
tag, countdown (live fixtures) or on-demand state (replays), phase chip
and your result strip, The Table ranked by Impact Rating with the volt
rank numeral on your row, Legendary Entries as back-page clippings, and
the Solana tease footer marked COMING SOON. Two columns at desktop,
one on a phone, skeletons hold the layout while data arrives.

The Match screen: broadcast-bug scoreboard, gradient area fill under
the curve with a shirt-number tag on the entry marker, event-type
glyphs in the ticker, a bigger tactile ENTER THE PITCH with the live
"Enter now: 8.7x, Miracle Territory" readout, and the window banner
pinned to the top while scrolling once you are on.

Resolution: staged reveal, window lines, then the multiplier counts the
final score up (requestAnimationFrame), then badges slam in, then the
Gazette clipping; about four seconds end to end, and reduced-motion
users get everything at once. Career: tracked uppercase section labels,
volt-edged earned badges against dim locked outlines, multiplier tier
tags on history rows.

The anonymous kit rule holds everywhere: no real player names, photos,
or likenesses; the product face is the shirt-and-number silhouette and
the pixel crest, both deterministic from name + number.

## Correctness untouched

```
$ npx tsc --noEmit                 # exit 0
$ npm run build                    # Compiled successfully, /judges static, no route changes
$ npm run test:fold                # 16 checks: All fold checks passed.
$ npm run test:badges              # 30 checks: All badge checks passed.
$ npm run smoke:career             # untouched script, full pass:
[smoke2] cabinet: earned [first_whistle], locked [miracle_worker, iron_nerve, comeback_king, ever_present, wounded]
[smoke2] history rows: 2, each with report: true
[smoke2] ALL PHASE 2 SMOKE CHECKS PASSED
```

One count correction against the brief: the fold suite has 16 checks
(and passes 16/16), not 17; the number in the prompt was off by one and
no check was added or removed by this pass.

Layout stability on the bench: every async region (identity, slate)
renders a fixed-height skeleton first and the masthead is synchronous,
so content replaces placeholders without shifting the page. The only
animations are opacity/transform (compositor-only) plus the resolution
count-up, which touches a single text node.

No em dashes anywhere: the repo-wide scan still matches only the report
sanitizer and its guards.

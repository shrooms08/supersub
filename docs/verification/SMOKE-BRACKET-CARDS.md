# SMOKE-BRACKET-CARDS - Bracket card sizing

Feature branch `bracket-cards` off main (after `bracket-v2`, the mirrored
tree, merged to main). **Layout only** - no data, scoring, or schema change.
One file touched: `src/app/bracket/page.tsx`.

The mirrored knockout tree rendered correctly but its match cards were too
small for their content. Three visible problems on the desktop bracket, all
now fixed.

## Sized to the longest real name, not a guess

The longest team name actually present in the knockout data (measured, not
assumed):

```
"Bosnia & Herzegovina" (20 chars) - in Round of 32, USA v Bosnia & Herzegovina
```

Rendered in the card's 12px label font it is **154px** wide. A team row is
padding(10) + flag(20) + gap(8) + name + gap(8) + score(16) + padding(10), so
the row needs ~226px. Cards are set to **238px** (a small buffer), up from
144px, and taller for footer clearance:

```
CARD_W  144 -> 238   CARD_H  60 -> 84   ROW_H  86 -> 104   (COL_GAP unchanged)
```

Every tree coordinate and SVG connector leg is **derived from these
constants** (`COL_W`, `CENTER_X`, `CANVAS_W`, `CANVAS_H`, `xForIdx`, the elbow
maths), so widening the card widened the canvas to ~2475px and re-placed
every card and every connector automatically. No offsets were hardcoded; the
champion-hero and third-place positions were re-expressed relative to
`CARD_H` so they still clear the taller Final card.

## The three problems, fixed

1. **Team names no longer truncate.** `truncate` on the name became
   `whitespace-nowrap`, and the card is wide enough that the longest name
   fits. Verified across both halves: BOSNIA & HERZEGOVINA, SOUTH AFRICA,
   NETHERLANDS, IVORY COAST, SWITZERLAND, ARGENTINA, CAPE VERDE all render in
   full.
2. **The penalties line sits on one line.** The footer span is
   `whitespace-nowrap`, and the wider card holds it. All four pens fixtures
   render intact: **PAR PENS 4-3**, **MOR PENS 3-2**, **EGY PENS 4-2**, **SWI
   PENS 4-3**.
3. **The footer clears the card border.** The desktop card height is a fixed
   `CARD_H`; at 60px the two team rows plus footer overflowed to the edge.
   At 84px the content centres with clear separation between FULL TIME /
   REPORT and the bottom border.

## Structure preserved

The mirrored layout is intact: two halves converging on the centred Final,
mirrored round labels, the champion above the Final, the third-place playoff
below it, connector elbows still meeting each pair exactly (the volt path
still traces Spain's road). The canvas is wider, so the desktop bracket
horizontal-scrolls on narrower screens - acceptable per the brief.

## Mobile unchanged

Mobile uses the vertical stacked-rounds layout with full-width cards in a
`min-h-[60px]` wrapper, so it never used `CARD_W`/`CARD_H` and never
truncated. The two shared tweaks (name `whitespace-nowrap`, footer
`whitespace-nowrap`) are no-ops for mobile's short, full-width rows.
`docs/smoke/bracket-cards-mobile.png` matches the prior mobile layout.

## Evidence

- `docs/smoke/bracket-cards-desktop.png` - the full mirrored tree, both
  halves, no truncation anywhere, all four pens lines intact, footers clear
  of borders, connectors aligned. (Captured with the page's max-width /
  scroll clip neutralised so the whole 2475px canvas paints in one image;
  the live page keeps its horizontal scroll.)
- `docs/smoke/bracket-cards-mobile.png` - mobile, unchanged.

## Timings, suites

```
/bracket  cold 2.936s   warm 0.019s / 0.017s   (unchanged; layout-only)

npm run test:fold      All fold checks passed.
npm run test:badges    All badge checks passed.
npm run test:signing   All signing checks passed.
npx tsc --noEmit       clean
npm run build          compiled
```

Em-dash scan on the changed file and this doc: clean. Zero changes under
`src/lib/state`, `src/lib/config`, `supabase/`, `src/lib/server/bracket.ts`,
or `src/lib/feed` - layout only.

---

Report for review. Not merged to main, not deployed.

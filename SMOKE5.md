# SMOKE5: Phase 1 of the canonical design alignment

Captured 2026-07-11. Reference: `docs/design/SuperSub.dc.html` (the file
wins over the prompt; the embedded DEVELOPER SPEC values were applied
verbatim). Phase 1 is presentation only; Phase 2 (Signing Day) has not
started.

## Loop, scoring, and data layer: untouched

```
$ git diff --stat af6f598 -- src/lib/state src/lib/config/scoring.ts \
    src/lib/feed src/lib/sources src/lib/career src/lib/server \
    src/app/api scripts/ supabase/
(empty: zero changed lines)

$ npx tsx scripts/test-fold.ts     # 16/16, identical before and after
$ npx tsx scripts/test-badges.ts   # 30/30, identical before and after
$ node scripts/smoke-career.mjs    # ALL PHASE 2 SMOKE CHECKS PASSED,
                                   # identical before and after
```

## What was applied

- **Type system**: Saira Condensed (hero numerals, scores, clocks,
  ratings), Zilla Slab (gazette body), Pirata One (broadsheet mastheads),
  Archivo (labels, microcopy, buttons); all four via `next/font/google`
  with `display: swap`, self-hosted at build, no runtime font requests.
  Exact sizes per the spec panel: bench hero 52/64px, fixture teams and
  scores in Saira, match clock 44px tabular in the bug, live multiplier
  readout 30px volt, Full Time masthead Pirata 42px with the 88px
  count-up, career rating 64/96px volt, tier tags Archivo 700 9px .16em.
- **Tokens**: volt is now `#c8ff00` (bright `#e4ff6b`); grayscale ramp
  `#f4f4f5 / #d4d4d8 / #a1a1aa / #71717a / #52525b` on `#070708`. Cards:
  16px radius, layered 1px `rgba(255,255,255,.07)` border plus inset
  hairline. Atmosphere stack kept unchanged.
- **Keyframes**: all ten ported verbatim from the reference.
- **Match**: sticky broadcast bug (3-col, volt bottom keyline) and the
  on-pitch window strip share ONE sticky stack, so they never overlap
  (rider 1). Curve uses the reference's `buildCurve()` control-point math
  (Catmull-Rom to bezier) over the real odds series, `curveDraw` 1.8s on
  mount via `pathLength=1400`, gradient area, minute ticks every 15'.
  Kept divergence, on purpose: market-suspension stretches still render
  dashed (the mock has no suspension concept; hiding it would misreport
  the market). Ticker chips per spec (GOAL light, CARD amber, CORNER
  neutral, VAR volt-tinted); `ripBack` .9s plays when a goal flips to
  discarded. Real events only: the TxLINE feed emits genuine
  `var`/`var_end`/`action_discarded` actions, so nothing is simulated
  and no mapping was invented.
- **Full Time**: staged reveal retimed to 0.3s / 1.1s (count-up 1.0s
  cubic ease-out via requestAnimationFrame) / 2.6s (badges `slamIn`
  staggered 120ms) / 3.6s (clipping); total under 4s. The clipping is
  the cream broadsheet: `#f2ede1`, Pirata masthead, Zilla Slab
  two-column body with a dotted column rule at desktop widths, print
  grayscale; the count-up and the WIN chip are the only volt on it.
- **Bench**: Legendary Entries are cream back-page clippings with the
  three canonical mastheads; The Table uses the exact volt row treatment
  (`rgba(200,255,0,.09)` bg, `rgba(200,255,0,.55)` border) with small
  PixelCrests per row; countdowns tick at 1s with tabular numerals from
  ONE shared interval owned by the page (rider 3), which only runs when
  a live upcoming fixture needs it; the LIVE beacon is volt with
  `livePulse`.
- **PixelCrest**: deterministic crest from (seed, number, size); FNV-1a
  hash seeding mulberry32, mirrored pixel grid in a shield mask, pure
  render, no canvas, no Math.random. Used on The Table rows, the kit
  card and career header chips, and the Signing Day live preview. The
  kit silhouette stays on the kit card until Phase 2 identity, numerals
  now in Saira.

## Volt register (accent audit)

After the sweep, volt appears at exactly these call sites: the ENTER THE
PITCH CTA (incl. its focus ring), the live multiplier readout beneath
it, the win-probability line, area gradient, hold-line, live dot, and
entry marker/tag, hero numerals (bench Impact, career rating, Full Time
count-up, provisional strip), The Table's user row, earned-badge glow,
the Miracle Territory tier tag, the LIVE beacons, the /judges primary
button (a CTA), the Signing Day shirt-number field accent, and the
COMING AT FULL TIME eyebrow on the Solana tease. Removed in the audit:
generic focus rings (now `#f4f4f5`), `::selection` (now grayscale), and
the old volt-tinted hover glow on panels.

## Evidence

- Before/after at 390px and 1280px for all four screens in
  `docs/smoke5/before/` and `docs/smoke5/after/` (same driver script,
  same flow: sign, play France v Morocco at 60x as Morocco, resolve,
  career).
- Layout shift (rider 2), measured with a buffered `layout-shift`
  PerformanceObserver across load and font swap on the bench:
  **CLS 0.0266 mobile, 0.0204 desktop**, well inside the 0.1 "good"
  threshold; the masthead itself does not shift (next/font supplies
  size-adjusted fallback metrics), the residue is the async slate swap
  against its skeletons.
- Fonts self-hosted: `grep -r fonts.googleapis .next/` after build
  returns nothing; the four families are served from `/_next/static`.

## Not done in Phase 1, by instruction

Signing Day flow and identity data (Phase 2, awaiting go-ahead after
this review). The current signing form got the visual pass only
(PixelCrest preview, Saira inputs, volt number field).

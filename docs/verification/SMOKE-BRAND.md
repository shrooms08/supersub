# SMOKE-BRAND: brand asset pass

Captured 2026-07-12 on branch `brand-assets`. The canonical mark (volt
rounded square with cut-out substitution arrows, up-left and
down-right) was extracted verbatim from `docs/design/Super Sub
Logo.html` into `docs/brand/mark.svg`, the source of truth for
everything below.

## What was implemented

1. `src/app/icon.svg` - the favicon (the mark), volt `#c8ff00` on
   near-black `#0b0b0d`. Wired automatically by Next's app-icon
   convention.
2. `src/app/apple-icon.png` - 180x180 render of the mark. `public/mark-512.png`
   - 512x512, for manifest and social.
3. `<head>` metadata (in `src/app/layout.tsx`): title "Super Sub",
   icons wired, `theme-color #0b0b0d`, OpenGraph + Twitter cards using
   the 512 mark and the one-liner "Choose the minute you enter a real
   live match, and get scored on what actually happens next." A web
   manifest (`src/app/manifest.ts`) carries the same mark and theme.
4. The mark, inline, in the bench masthead next to MATCHDAY at 24px. It
   sits naturally (see masthead capture); it did not crowd, so it stays.
5. `docs/brand/` carries the repo's own brand kit: the source `mark.svg`,
   raster marks at 512/180/96/32, and the SUPER SUB lockup rendered in
   Saira Condensed Bold (`lockup-dark.png`, `lockup-volt.png`), plus a
   README with colours and usage.

## Evidence

### Favicon

```
GET /icon.svg      -> 200 image/svg+xml
GET /apple-icon.png -> 200 image/png (180x180)
head: <link rel="icon" href="/icon.svg" type="image/svg+xml" sizes="any"/>
      <link rel="apple-touch-icon" href="/apple-icon.png" type="image/png" sizes="180x180"/>
```

`scratchpad/brand-shots/favicon-render.png` is the served `/icon.svg`
rendered on its own: the volt mark on near-black. (The browser's tab
chrome is not capturable by the headless shell used here, so the favicon
is evidenced by the served asset render plus the wired `<link>`; in a
full browser the tab shows this mark.)

### Social card

All tags present, and the image resolves:

```
<meta name="theme-color" content="#0b0b0d"/>
<title>Super Sub</title>
<meta property="og:title" content="Super Sub"/>
<meta property="og:description" content="Choose the minute you enter a real live match, and get scored on what actually happens next."/>
<meta property="og:image" content="https://supersub-tau.vercel.app/mark-512.png"/>
<meta property="og:image:width" content="512"/> <meta property="og:image:height" content="512"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:image" content="https://supersub-tau.vercel.app/mark-512.png"/>
GET /mark-512.png -> 200 image/png (512x512)
GET /manifest.webmanifest -> 200 application/manifest+json
```

The `metadataBase` makes the card image an absolute URL, so a third-party
validator (e.g. opengraph.xyz, the Twitter card validator) resolves it
directly once this is deployed. Locally the tags are complete and the
512 image resolves.

### No layout shift on the bench

Measured with a `layout-shift` PerformanceObserver over a full bench
load (player signed, schedule and matchday fetched):

```
bench CLS: 0.0328   (well under Google's 0.1 "good" threshold)
```

The masthead mark is an inline SVG with a fixed 24px box, painted with
the header, so it contributes zero shift; the residual 0.033 is
below-the-fold async content settling into its reserved skeletons, which
predates this pass.

### Suites and hygiene

`tsc --noEmit` clean, `npm run build` clean (routes `/icon.svg`,
`/apple-icon.png`, `/manifest.webmanifest` generated). Em-dash scan over
new and changed files: clean.

## Files

- `src/app/icon.svg`, `src/app/apple-icon.png`, `public/mark-512.png` (new)
- `src/app/manifest.ts` (new), `src/app/layout.tsx` (metadata + theme)
- `src/components/Masthead.tsx` (inline mark)
- `docs/brand/` (mark.svg, raster marks, lockups, README)

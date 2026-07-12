# Super Sub brand assets

The mark is a volt rounded square with two cut-out substitution arrows,
up-left and down-right. Source of truth: `mark.svg`, extracted verbatim
from `docs/design/Super Sub Logo.html`.

## Colours
- Volt (mark): `#c8ff00`
- Near-black (ground): `#0b0b0d`
- Chalk (wordmark on dark): `#f4f4f5`

## Wordmark
"SUPER SUB" is set in Saira Condensed Bold (700), the face already
self-hosted in the app via next/font.

## Files
- `mark.svg` - canonical vector mark (the source)
- `mark-512.png`, `mark-180.png`, `mark-96.png`, `mark-32.png` - raster marks
- `lockup-dark.png` - mark + SUPER SUB wordmark, chalk on near-black
- `lockup-volt.png` - mark + SUPER SUB wordmark, volt on near-black

## In the app
- `src/app/icon.svg` - favicon (the mark), wired automatically by Next
- `src/app/apple-icon.png` - 180x180 apple-touch-icon
- `public/mark-512.png` - social (OpenGraph/Twitter) and web manifest icon

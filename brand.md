# Brand: Super Sub

_Status: locked by the Phase 1 brief (binding design system). Do not re-theme without a new brief._

## Idea

You are the fantasy substitute. Broadcast football, floodlit at night. The
screen should feel like a stadium scoreboard crossed with a trading
terminal: almost everything whispers in grayscale, and exactly one voltage
runs through it.

## Palette

Dark base, ONE volt accent, everything else grayscale.

- Base: near-black `#0b0b0d` (token `pitch-900`), page background `#070708` (`pitch-950`)
- Panels: deep charcoal `#141418` (`pitch-800`), borders `#26262c` (`pitch-600`)
- Text: chalk grays `#f5f5f2` down to `#6e6e68` (`chalk-*`)
- Volt accent: electric green-yellow `#d6ff3f` (`volt`), bright variant `#e4ff66`, dim `#9dbf1f`

The volt accent is reserved for exactly three things:

1. the ENTER THE PITCH call to action
2. the win probability line
3. hero numbers (the multiplier, the win probability, final points)

Nothing else gets it. Cards, badges, tickers, team names: grayscale.
Semantic exceptions allowed: yellow/red card glyphs use their real colors,
small and desaturated.

## Typography

System sans, tight tracking, heavy weights for hero numbers. Numbers that
matter render huge (multiplier, win probability, final points) in
tabular-nums; supporting text whispers in small caps chalk gray.

## Motion

The Match screen must feel live: the curve animates as ticks arrive, new
ticker events pulse once (volt wash fading to transparent), the CTA gains
a subtle pulse when win probability moved more than 10 points in the last
2 minutes. VAR overturns get a hard interruption treatment. All
non-essential motion sits behind prefers-reduced-motion.

## Voice

Broadcast football, second person, present tense. Bench, gaffer, stoppage
time, the whistle, on your watch. Never gym language, never app-generic
("submit", "processing", "item"). Short lines, no exclamation marks unless
a goal just went in.

- Entry CTA: "ENTER THE PITCH"
- Waiting: "You are on the bench. Pick your side."
- Entered: "You are on. Everything from here counts."
- VAR erase: "VAR: overturned"
- Resolution header: "FULL TIME"

## Dark mode

The app is dark-only by design. There is no light theme in this phase.

# DEMO: the three capture scenarios

Every number below was derived from the bundled real data by
`npx tsx scripts/scan-scenarios.ts <fixtureId> 5`, which sweeps entry
minutes through the exact scoring code the app runs. Wall-clock beat
times assume `speed=30` (one match minute every two seconds), measured
from the moment the match screen connects.

## Setup, once per take

1. Use one browser profile for the whole shoot. Create the demo player
   on `/` (suggested: a real-sounding name, ST, a memorable number).
2. Between takes, wipe the slate but keep the player and cookie:
   `node scripts/reset-demo.mjs "<Player Name>"`
   For production, prefix with the prod Supabase env values (see the
   script header).
3. Each browser TAB gets its own replay timeline (the anchor is
   per-tab). A fresh tab means a fresh kickoff; a refresh resumes the
   same match. To restart a scenario: close the tab, reset the player,
   open a new tab.
4. Record with `&clean=1` appended to hide feed-mode chrome.

## Scenario A: Safe Hands (France v Morocco, enter after the opener)

URL: `/match/18209181?mode=replay&speed=30&clean=1`

Data note, stated plainly: the original scenario sketch said "France
around minute 30". The real market never priced France above 63.1%
before their opener (2.54x, Squad Rotation), so a minute-30 entry is
not Safe Hands. The genuine Safe Hands capture is entering just AFTER
the 60' goal, when the market resumes at 86.9%.

- 0:00 connect; pre-roll, then kickoff. Pick FRANCE, do not enter yet
- ~1:38 the 49' Morocco goal and its VAR erasure scroll past in the
  ticker (leave it; this take is about comfort, not drama)
- ~1:40 to 2:18 halftime; the clock holds at 45+, the curve breathes
- ~2:50 France score (60'). The market suspends, then resumes near 87%
- ~2:55 ENTER when the hero number reads 85%+ and the multiplier on
  offer reads 1.0x. Tier shown: Safe Hands
- ~3:01 France score again (66'): +100 lands live
- ~4:14 full time 2-0. Resolution: window 240 (goal, clean sheet, win),
  1.0x, 240 points. A professional shift, no heroics
- Expected career effects: appearance +1, form W

## Scenario B: The Flop (France v Morocco, Morocco late, the VAR window)

URL: `/match/18209181?mode=replay&speed=30&clean=1` (new tab, after reset)

This is the take that proves the scoring is event-sourced and honest:
the VAR overturn lands INSIDE the scoring window, on camera.

- 0:00 connect, pick MOROCCO immediately
- ~1:31 ENTER at the 44th minute. P(win) reads ~11.5%, multiplier locks
  ~9.2x, tier Miracle Territory. Provisional shows clean sheet +40
- ~1:38 Morocco score (48:44). Provisional jumps: goal +100
- ~1:40 VAR: overturned. The banner takes the screen, the goal strikes
  through in the breakdown at 0 points, the scoreboard rolls back to
  0-0, provisional drops. THIS is the money shot
- ~2:50 France score (60'): conceded, -50
- ~3:01 France again (66'): -50
- ~4:14 full time 0-2. Resolution: window -100, floored at zero.
  0 points at 9.2x. The report writes the obituary
- Expected career effects: appearance +1, form L, no badge (Morocco
  concede only two; Wounded needs three)

Alternative Wounded beat, if wanted: enter as EGYPT at 46' in fixture
18202701; they concede three in the window (0 points, Wounded badge).

## Scenario C: Miracle Territory (Argentina v Egypt, the hero take)

URL: `/match/18202701?mode=replay&speed=30&clean=1` (new tab, after reset)

Fixture 18202701, real match of 2026-07-07: Argentina 0-2 down (one
Egypt goal later VAR-erased), win 3-1. TxLINE coverage for this fixture
begins at the second half, so the replay starts at 45' with the full
first-half market story already painted on the curve. Best miracle in
the two-week history window; nothing else scanned came close
(`scripts/scan-comebacks.ts` output is in SMOKE3.md).

- 0:00 connect at 45', scoreboard 0-0, and the whole first-half market
  story is already painted on the curve. Pick ARGENTINA, hold
- ~0:26 Egypt score (58'). 0-1
- ~0:30 VAR erases it (~60'). The scoreboard rolls back to 0-0 on
  camera
- ~0:44 Egypt score for real (67'). 0-1, and the curve dives to the
  floor
- ~1:00 to 1:05 ENTER when the hero number reads under 6% (the market
  bottoms at 4.0% around the 75th minute). Multiplier locks 10.0x,
  tier Miracle Territory
- ~1:09 Argentina equalise (79'): +100. Level at 1-1
- ~1:19 Argentina ahead (84'): +100
- ~1:39 Argentina seal it (92'): +100. The comeback is complete
- ~2:12 full time 3-1. Resolution: window 440 (three goals, nothing
  conceded on your watch, win at the whistle), x10.0 = 4400 points
- Expected career effects: Miracle Worker AND Comeback King into the
  cabinet, Impact Rating detonates, form W, legendary entry count +1

## Judge-speed variant

The /judges route launches France v Morocco at `speed=8` (a full match
in about 16 minutes), which feels live rather than time-lapsed. All
beats above scale by 30/8 = 3.75x.

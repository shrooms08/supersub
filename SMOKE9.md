# SMOKE9: fixture 18202701 score audit (blocks the demo)

Captured 2026-07-11. Trigger: the fold computed Argentina v Egypt
(fixture 18202701) as 3-1; the real-world result was 3-2. The delta
looked like the VAR-discarded Egypt goal. Audit first, then fix.

> SCALE NOTE (2026-07-11, later the same day): after this audit, the
> window scoring constants were divided by 10 (goal +10, conceded -5,
> clean window +4, win +10, draw salvaged +6; multiplier and tiers
> unchanged). Any hundreds-scale points figure below (e.g. window 340,
> 4400 points) predates that rescale; divide by 10 for the current
> value. The rescale, the entry recompute, and the pre-capture purge
> are documented in the item 8 addendum at the end of this file.

## Verdict

**FOLD BUG, not a feed defect.** The raw feed encodes 3-2 at every
level. Our reconciliation double-subtracted the VAR-discarded goal and
the casualty was a different goal entirely: Egypt's first-half goal,
scored before TxLINE coverage opens, which exists only in the feed's
cumulative totals and never as a goal event. Root-caused, fixed in
`src/lib/state/fold.ts`, regression-tested under this fixture's id,
and both stored production entries recomputed. Details below.

## 1. Raw goal-related action history (18202701)

`npx tsx scripts/audit-fixture-goals.ts 18202701`. Raw columns are
straight off the wire with no normalization: `keyAbsent` means the
Goals key is missing from that participant's Total (feed contract:
absent means zero for counters, but note Participant2's Total.Goals is
PRESENT with value 1 or 2 throughout, see section 2). `fold` is the
running score under the FIXED fold; the old fold's wrong turns are
called out inline.

```
fixture 18202701: 563 raw events, 563 normalized (0 dropped by normalization)

Seq   | clock  | action           | id   | team | conf  | rawG1 | rawG2 | stats1/2 | fold
------|--------|------------------|------|------|-------|-------|-------|----------|------
640   | 58'    | goal             | 570  | 2    | false | keyAbsent | 2     | 0/1      | 0-2
644   | 59'    | var              | 574  | -    | false | noScore | noScore | 0/1    | 0-2
645   | 59'    | var              | 574  | -    | true  | noScore | noScore | 0/1    | 0-2
646   | 60'    | var_end          | 574  | -    | true  | keyAbsent | 2     | 0/2      | 0-2
647   | --     | action_discarded | 570  | -    | -     | keyAbsent | 1     | 0/2      | 0-1   <- old fold: 0-0
727   | 67'    | goal             | 645  | 2    | false | keyAbsent | 2     | 0/1      | 0-2   <- old fold: 0-1
728   | 67'    | goal             | 645  | 2    | true  | keyAbsent | 2     | 0/2      | 0-2
730   | 67'    | goal             | 645  | 2    | true  | keyAbsent | 2     | 0/2      | 0-2
827   | 79'    | goal             | 734  | 1    | false | 1     | 2     | 0/2      | 1-2
830   | 79'    | goal             | 734  | 1    | true  | 1     | 2     | 1/2      | 1-2
875   | 84'    | goal             | 775  | 1    | false | 2     | 2     | 1/2      | 2-2
876   | 84'    | goal             | 775  | 1    | true  | 2     | 2     | 2/2      | 2-2
960   | 92'    | goal             | 851  | 1    | false | 3     | 2     | 2/2      | 3-2
966   | 92'    | goal             | 851  | 1    | true  | 3     | 2     | 3/2      | 3-2
1040  | --     | status           | 916  | -    | -     | noScore | noScore | 3/2    | 3-2
1045  | --     | game_finalised   | 924  | -    | -     | 3     | 2     | 3/2      | 3-2
```

The var_end for id 574 carries `Data.Outcome: "Overturned"`, and the
`action_discarded` at Seq 647 points at goal id 570. That discard is
real and correctly erases the 58' goal. It was never the missing goal.

## 2. Does the raw feed's FINAL state encode 3-1 or 3-2?

**3-2, unambiguously, in three independent places:**

- Last Score-bearing event (Seq 1045, game_finalised):
  `Participant1.Total.Goals = 3`, `Participant2.Total.Goals = 2`. The
  full map shows where Egypt's second goal lives:
  `Participant2: {H1: {Goals: 1}, H2: {Goals: 1}, Total: {Goals: 2}}`.
- Last non-empty Stats map (Seq 1046, disconnected): `{"1": 3, "2": 2}`
  (key n = participant n goals).
- Every Score map in the log carries `Participant2.H1.Goals = 1`.

Coverage for this fixture begins at the second half (first event is a
coverage_update; the first kickoff event is the H2 restart). Egypt's
first-half goal happened before coverage opened, so there is NO goal
event for it anywhere in the 563-event log. It exists only inside the
cumulative totals. There is no re-award of goal id 570, no late Egypt
goal event beyond id 645, and normalization drops zero events. The
score_adjustment at Seq 741 simply reasserts the same totals
(`Participant2.Total.Goals = 2`) through the ordinary Score-map path
the fold already consumes.

## 3. The fold bug, the fix, the regression tests, the recompute

### Root cause (one line)

The reconciliation subtracted a discarded countable from the baseline
whenever the countable predated the baseline, without checking whether
the baseline ALSO postdated the discard, and a baseline taken at or
after the discard has already had that action removed by the feed, so
the subtraction erased a different goal.

### Mechanics

The fold's totals reconciliation says: latest Score-bearing event is
the authoritative cumulative baseline; countables newer than the
baseline add to it; a discarded countable already counted inside the
baseline subtracts from it. The `action_discarded` at Seq 647 itself
carries a fresh Score map (`Participant2.Total.Goals = 1`, the 58'
goal already removed by the feed). So from Seq 647 on, the baseline
both contains Egypt's pre-coverage H1 goal and excludes the discarded
one. The old code saw goal id 570 (Seq 640) <= baseline seq and
subtracted anyway: 1 - 1 = 0, which erased the H1 goal. Every
subsequent baseline kept excluding the discarded goal, so the fold
stayed one short forever: 3-1 instead of 3-2.

### Fix (src/lib/state/fold.ts)

`CountableItem` now records `discardedAtSeq` when the
`action_discarded` arrives, and the subtraction is gated on the
baseline PREDATING the discard:

```ts
if (item.discarded) {
  const discardSeq = item.discardedAtSeq ?? Number.POSITIVE_INFINITY;
  if (item.seq <= baselineSeq && baselineSeq < discardSeq) {
    counters[side][key] = Math.max(0, counters[side][key] - 1);
  }
  continue;
}
```

If the baseline arrived at or after the discard, the feed's totals
already exclude the action and no subtraction happens. The rollback
path is untouched: between the discard and the next Score map the
fixed fold still shows the goal erased (verified below: 0-1
immediately after Seq 647).

### Regression tests, named for the fixture

Added to `scripts/test-fold.ts`, which now runs 20 checks (16 before,
4 new; count verified by counting PASS lines):

```
PASS  18202701 final folds 3-2 (pre-coverage H1 goal survives the later VAR discard)  (folded 3-2)
PASS  18202701 is 0-1 right after the discard at Seq 647 (discard event refreshes the baseline)  (folded 0-1)
PASS  18202701 is 0-2 after the standing 67' goal (Seq 730)  (folded 0-2)
PASS  18202701 keeps the overturned 58' goal visible as discarded
```

Full post-fix suite runs: fold 20/20, badges 30/30, signing 35/35,
`tsc --noEmit` clean. The France v Morocco VAR boundary checks (0-1 at
Seq 534, 0-0 at Seq 535, final 2-0) still pass unchanged.

### Stored entries recomputed (production)

Two entries existed on fixture 18202701, both on Argentina. Window and
final points were verified unchanged before writing anything: window
goals are counted from events after the entry instant, the discarded
58' goal and the pre-coverage H1 goal both predate each entry, and the
at-entry scores only gate the draw-salvaged bonus, which cannot fire
on a win. Recompute confirmed by `scripts/recompute-entries.ts` (new,
dry-run by default) and applied through the privileged admin SQL path
(the service-role key is not persisted on this machine, per SMOKE8):

```
minos #9, entered 81' at x9.13:
  before: at-entry 1-1, final 3-1, window 340, points 3103.9
  after:  at-entry 1-2, final 3-2, window 340, points 3103.9
MINOS #7, entered 73' at x10.0:
  before: at-entry 0-1, final 3-1, window 440, points 4400
  after:  at-entry 0-2, final 3-2, window 440, points 4400
```

The at-entry scores were corrected too: they were captured by the
buggy fold at entry time, and the true scoreboard read 1-2 at 81' and
0-2 at 73'. Points columns are byte-identical to what was stored, so
The Table and Legendary Entries totals are unaffected. Note: MINOS #7
is a fresh row resolved 2026-07-11 15:32 UTC (the row purged in SMOKE7
stayed deleted); at 4400 it is now the top legendary entry.

## 4. The other two bundles are faithful

Same audit on both:

- **France v Morocco 18209181** (the prompt said "18200914"; no bundle
  or TxLINE fixture matched that id, and 18209181 is the France v
  Morocco fixture in `data/replay/`): fold 2-0, feed final
  `Participant1.Total.Goals = 2`, P2 absent (zero), Stats 2/0. Real
  result 2-0. Faithful, BUT it carried the same latent defect: its
  discard event also refreshes the Score map, and the old fold
  double-subtracted Morocco to -1, which only read as 0 because of the
  `Math.max(0, ...)` clamp. The bug was live here too, just masked.
- **Switzerland v Colombia 18202783**: fold 0-0, feed final Total
  goals absent/absent (zero-zero), Stats 0/0. The PE (shootout) period
  maps show `PE: {Goals: 4}` v `PE: {Goals: 3}`, correctly excluded
  from Total by the feed and never counted by the fold. Real result
  0-0 after extra time. Faithful.

## 5. Fresh TxLINE snapshot, fetched today

`/scores/snapshot/18202701` on 2026-07-11 (29 records):

```
game_finalised Seq 1045 -> P1.Goals 3 | P2.Goals 2 | Stats1/2: 3/2
disconnected  Seq 1046 -> Stats1/2: 3/2
goal          Seq 966  -> P1.Goals 3 | P2.Goals 2 | Stats1/2: 3/2
```

Identical to the bundled log's ending. The bundle is not stale.

## 6. What the demo can honestly claim

- The scoreboard, ticker, and resolution now match the real result:
  Argentina 3-2 Egypt, with the 58' Egypt goal shown scored and then
  VAR-erased on camera. The comeback is STRONGER than previously
  described: Argentina were 0-2 down, not 0-1.
- The replay connects at 45' with the scoreboard already reading 0-1,
  because Egypt's first-half goal predates TxLINE coverage and arrives
  through the totals. That is the honest framing: coverage for this
  fixture begins at the second half; nothing is invented.
- Points already banked were always correct: both stored entries keep
  window 340 / 440 and points 3103.9 / 4400 to the decimal. Only the
  displayed final score and at-entry score lines changed.
- DEMO.md Scenario C beats were rewritten for the corrected scores
  (connect at 0-1, 58' makes it 0-2, VAR rolls back to 0-1, 67' makes
  it 0-2 for real, then 1-2, 2-2, 3-2). SMOKE3.md's comeback-scan
  block got a correction note; the scan output there was produced by
  the buggy fold.
- Deployment note: production still runs the pre-fix fold until the
  next promote, so a resolve on 18202701 done there before deploying
  would store 3-1 again. The fix ships with this commit; promoting is
  a separate, operator-gated step.

## Files

- `src/lib/state/fold.ts` (fix: `discardedAtSeq` gate)
- `scripts/test-fold.ts` (4 regression checks named 18202701; 20/20)
- `scripts/audit-fixture-goals.ts` (new: raw goal-history audit table)
- `scripts/recompute-entries.ts` (new: dry-run-first entry recompute)
- `DEMO.md` (Scenario C beats corrected), `SMOKE3.md` (correction note)

## 7. Knockout handling (extra time and penalties)

Captured 2026-07-11, extending the audit to the knockout event space.

### 7a. What the Switzerland v Colombia log (18202783) contains

`npx tsx scripts/audit-knockout-periods.ts 18202783`. The bundled log
runs the full knockout distance: 1355 raw events, 380 of them past
90:00. Period boundaries by StatusId:

```
Seq   16 | status 2   first half          Seq  963 | status 6   extra time coming
Seq  479 | status 4   second half         Seq  966 | status 7   ET1 (kickoff at 90:00)
                                          Seq 1135 | status 8   ET break
                                          Seq 1138 | status 9   ET2 (kickoff at 105:00)
                                          Seq 1298 | status 11  ET over
                                          Seq 1301 | status 12  shootout
                                          Seq 1349 | status 13  shootout done
                                          Seq 1352 | game_finalised (StatusId 100)
```

There is NO StatusId 5 in this log: a match that goes to extra time
ends regulation with status 6, not 5. The shootout arrives as
`penalty_shootout_team` and `penalty_outcome` actions (Data.Outcome
"Scored"/"Missed") with a running tally inside the Score map's PE
period, ending `PE: {Goals: 4}` v `PE: {Goals: 3}` (Switzerland win
4-3 on penalties). PE is deliberately excluded from the feed's Total;
extra time is NOT (this log's yellow cards prove it: H2 2 + ET1 1 =
Total 3). The log has zero `goal` actions, so no real ET goal exists
in any bundle.

### 7b. The fold WOULD have counted an ET goal; fixed

Ruling: REGULATION ONLY. The 1X2 odds that set the multiplier price
regulation time, so outcomes must settle in the same event space.

Before the fix, `scoreWindow` filtered window goals only by
`ts > entryFeedTs` and read win/draw from the full fold's score, whose
baselines come from feed Totals that include extra time. An ET goal
(arriving like any goal: a `goal` action plus a refreshed Score map)
would have scored the window and flipped the win bonus.

The fix:

- `foldMatch` now tracks `regulationEndTs`/`regulationEndSeq` (the
  first event stamped StatusId >= 5, read off every event so a
  mid-match join that missed the boundary status still caps),
  `wentToExtraTime` (StatusId 6 to 9 seen), and `shootout` (the PE
  tally, display only).
- New `regulationLog(events)` returns the log up to and including the
  regulation whistle. Scoring folds THIS: `POST /api/resolve` scores
  the window against `foldMatch(regulationLog(events))`, and the
  client provisional does the same via `useMatchStream`'s new
  `scoringState`. Display keeps folding the full log.
- Second fence: `scoreWindow` also drops window items past
  `state.regulationEndTs`, so even a full-log fold cannot leak an ET
  goal into a breakdown.
- The bench closes at the regulation whistle too: `POST /api/enter`
  now rejects entries after `regulationEndTs` ("Full time. The bench
  is closed."), since such a window could never score.

Regression tests (fold suite now 30 checks, verified by counting PASS
lines; badges 30/30, signing 35/35, tsc clean): the real log's
boundary (Seq 963), ET flag, 4-3 shootout read, 0-0 both folds, plus a
synthetic ET goal stamped mid-ET1 with a realistic Score map. The full
fold counts it 0-1 (proving the leak the boundary closes), the
regulation fold holds 0-0, the window scores clean sheet only, and the
scoreWindow guard keeps it out even when handed the full fold. France
v Morocco and Argentina v Egypt regulation folds equal their full
folds (2-0, 3-2): regulation-time matches are untouched.

HTTP end to end on the dev server (SMOKE-REG, removed after):

```
POST /api/enter  anchor at ET2 kickoff  -> 409 "Full time. The bench is closed."
POST /api/enter  anchor at 90' (0-0)    -> 200, P(win) 8.5%, 9.54x locked
POST /api/resolve after the full AET+pens log ->
  window 40 (clean sheet only), final 0-0 stored, 381.8 points,
  breakdown free of any extra-time or shootout item
```

### 7c. Shootout surfaced as display only

The scoreboard shows a result strip under the final when a shootout
decided it: "0-0 · SUI advanced on penalties 4-3" (team code derived
from the real name, tally from the PE map). Period label reads "Extra
time" during StatusId 6 to 9, "Penalties" during 11 to 13, and "Full
time · Pens" at the end. The clipping (match report) carries the same
verdict in its subline on the match screen. Zero scoring impact:
entries store the regulation result, and the career page renders past
entries from the stored row (no shootout column, none added; the
subline appears where live state exists).

### 7d. The rule, on the resolution screen

For any match that went past regulation, the resolution overlay's
result panel adds one line under the entry summary: "Windows settle at
the regulation whistle" (prefixed with the pens verdict when there was
one).

### What the demo can claim for knockouts

Extra time and shootouts are real states the app handles: the
scoreboard follows them honestly, the shootout verdict is displayed,
and scoring stays inside the regulation event space the multiplier was
priced on. No bundled fixture has an ET goal, so the ET-goal boundary
is proven by regression test and synthetic injection, not by a demo
scenario.

## 8. Scale rescale and pre-capture purge (final pass, 2026-07-11)

The scoring was rescaled and the production roster cut to exactly the
demo player, as the last pass before capture.

### 8a. The rescale

`src/lib/config/scoring.ts`, window constants divided by 10; multiplier
shape and tier bounds untouched:

```
GOAL_FOR             100 -> 10
GOAL_CONCEDED        -50 -> -5
CLEAN_SHEET_WINDOW    40 -> 4
WIN_AT_WHISTLE       100 -> 10
DRAW_SALVAGED         60 -> 6
LEGENDARY_POINTS     500 -> 50   (see note)
```

Note on LEGENDARY_POINTS: it was not in the five window constants, but
it is a threshold denominated in FINAL points, and final points all
drop 10x under the rescale (window /10, multiplier unchanged). Left at
500 it would have made "legendary" 10x harder and emptied the career
board (minos's two legendary entries, 310.4 and 100.3, both fall below
500). Rescaling it to 50 preserves the product behaviour: it is the
same rescale applied to the same unit. The Legendary Entries board on
the bench is unaffected either way (it ranks the top winning entries by
multiplier, not by a point threshold).

Nothing else needed a code change: every screen renders points straight
from `final_points`/`window_points`/`finalPoints()` with no scale logic
of its own, confirmed by grep and by the UI capture below.

### 8b. Stored entries recomputed

`scripts/recompute-entries.ts` (extended with a `--from <json>` compute
shape for when the service-role key is not on the machine; it prints
before/after and emits the UPDATE SQL, which was run through the
privileged console). Every resolved entry recomputed from its own event
log against the regulation fold, using its stored multiplier:

```
minos #9 · 18202701 · x9.129   window 340->34,  final 3103.9->310.4,  score 3-2
minos #9 · 18209181 · x2.949   window 340->34,  final 1002.5->100.3,  score 2-0
minos #9 · 18202783 · x7.102   window  40->4,   final  284.1->28.4,   score 0-0
MINOS #7 · 18202701 · x10.000  window 440->44,  final 4400->440,      score 3-2
MINOS #7 · 18209181 · x2.642   window 340->34,  final  898.3->89.8,   score 2-0
MINOS #7 · 18202783 · x5.535   window  40->4,   final  221.4->22.1,   score 0-0
```

The 4400 miracle becomes 440, exactly as expected. All six were written
before the purge below removed the MINOS #7 rows, so the database was
never in a mixed-scale state.

### 8c. Purge to a clean roster

`MINOS #7` (id 300f6676-f0fd-4923-b605-da0d28124b36, the entry
recreated during the item 7 knockout E2E and earlier work) deleted with
its 3 entries and 3 badges. A second stray player, `JAFAR #9` (0
entries, 0 badges), was also present and would have shown as an unrated
row on The Table; removed as well (operator-confirmed, since it was not
in the original kill list). The FK-safe order was badges, entries,
players, through the privileged path.

Production roster after (single query, join fan-out avoided):

```
minos #9 | entries 3 | resolved 3 | total 439.1 | impact 146.37
         | legendary 2 (310.4, 100.3 both clear the rescaled 50)
         | total_players in table: 1
```

The Table reads exactly [minos]. Legendary Entries shows minos's two
winning miracles (x9.13 Argentina 310.4, x2.95 France 100.3).

Open item, NOT actioned (out of scope for these three tasks, flagged
for a decision): minos holds only the `first_whistle` badge. His
18202701 entry now reads behind-at-entry 1-2 and a 3-2 win, which
qualifies for `comeback_king`, but badges are awarded once at
resolution and neither the fold-fix recompute nor this rescale
re-evaluates them. Awarding it would be a separate, deliberate badge
backfill.

### 8d. Verification (all green on the rescaled constants)

```
npx tsc --noEmit          clean
test:fold                 30/30  (window -10, max(0,-10), 2 goals+cs+win = 34)
test:badges               30/30
test:signing              35/35
smoke:career (HTTP, local production build):
  match 1 resolved: window -10, final 0 points
  match 2 resolved: window 4,   final 29.2 points
  career: apps 2, impact 14.6 = (0 + 29.2)/2   (assertion passed)
  ALL PHASE 2 SMOKE CHECKS PASSED
```

Full replay loop in the browser against the local production build
(`npm run build` then `npm start`), France v Morocco at 60x, entered as
France at the 8th minute; the on-pitch panel renders the new scale
directly (screenshot `rescale-onpitch.png`):

```
VAR: goal overturned 49'          0
Goal for your side 60'          +10
Nothing conceded on your watch   +4
Winning as it stands            +10
PROVISIONAL POINTS             65.5   (window 24 x 2.7x locked)
```

Old scale would have read +100 / +40 / +100 and a provisional near 655.
The displayed points match the new scale end to end. The two smoke
players (SMOKE-DDEAE, VOSSY) created by these runs were removed
afterward; the roster is back to exactly minos.

### Files (item 8)

- `src/lib/config/scoring.ts` (constants /10, LEGENDARY_POINTS 50)
- `scripts/recompute-entries.ts` (added `--from` compute shape)
- `scripts/test-fold.ts`, `scripts/test-badges.ts` (new-scale assertions)
- `README.md`, `DEMO.md`, `SHOTLIST.md`, `SMOKE.md`, `SMOKE2.md`,
  `SMOKE3.md`, `SMOKE7.md`, `SMOKE8.md` (old-scale numbers updated)

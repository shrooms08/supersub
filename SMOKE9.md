# SMOKE9: fixture 18202701 score audit (blocks the demo)

Captured 2026-07-11. Trigger: the fold computed Argentina v Egypt
(fixture 18202701) as 3-1; the real-world result was 3-2. The delta
looked like the VAR-discarded Egypt goal. Audit first, then fix.

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

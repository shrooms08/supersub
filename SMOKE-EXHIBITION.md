# SMOKE-EXHIBITION: replay entries become exhibitions

Captured 2026-07-12 on branch `exhibition-replays` (off main). Operator
decision, post-freeze. Entries on the three bundled replay fixtures
(18202701, 18202783, 18209181) are EXHIBITIONS: the full loop runs, but
they never touch a competitive number. Live-fixture entries are
untouched. Read-only to the loop; one boolean column added.

## The rule, as implemented

- Migration `0008_exhibition_entries.sql`: `entries.exhibition boolean
  not null default false`. Set at resolution from the bundled-fixture id
  list (`isBundledReplay`).
- `careerRecord` (Impact Rating, career points, average multiplier, form,
  legendary count) counts non-exhibition entries only.
- Matchday: The Table ranks by that live-only record; Legendary Entries
  and the viewer's `results`/mini-stats exclude exhibition entries.
- Badges (`evaluateBadges`): First Whistle on any debut (a debut is a
  debut); every other badge requires a live entry, and Ever Present
  counts live appearances only. The resolve route passes the entry's
  exhibition flag and the player's live-appearance count.
- Unchanged on replays: enter, provisional points, VAR rollback, the
  resolution screen with full breakdown and multiplier, and the Gazette
  report (still generated and stored). The entry appears in career match
  history with a volt "EXHIBITION · FROM THE ARCHIVE" tag.
- `/judges` gains one line: "Exhibition matches. Your career remembers
  them; the table does not."

## Evidence

### A replay entry resolves with the tag, career numbers unmoved

`smoke-career` (updated to assert the new rule), full replay loop:

```
resolved: final 0-2, window -10, points 0, new badges [first_whistle]   (exhibition entry)
entry.exhibition === true
career after match one: apps 0, impact null, form []   (competitive numbers stay empty)
career after match two: apps 0, impact null, form []
cabinet: earned [first_whistle]   (First Whistle only, from the exhibition debut)
history rows: 2, all exhibition: true, each with report: true
ALL PHASE 2 SMOKE CHECKS PASSED
```

Career page capture (`scratchpad/ex-shots/career-{mobile,desktop}.png`):
APPS 0, POINTS 0, AVG MULT --, BEST --, First Whistle earned, all other
badges locked, and the match-history row carries the EXHIBITION · FROM
THE ARCHIVE tag with its report link intact.

### A live entry still counts

Production matchday after the rule:

```
TABLE: MINOS apps 1 rating 0, FEJIRO apps 1 rating 0, JUJU apps 0, ...
```

MINOS's live flop (0 points, Argentina v Switzerland) and FEJIRO's live
entry still count as competitive appearances; only the replays dropped
out.

### Retroactive delta (dry run, then executed)

Dry run over existing careers, then applied:

```
tagged exhibition (2 entries):
  MINOS  Argentina v Egypt  247.6 pts   -> exhibition
  JUJU   Argentina v Egypt  240.1 pts   -> exhibition
kept live (untouched):
  MINOS  Argentina v Switzerland  0 pts (the live flop stays)
  FEJIRO Argentina v Switzerland  0 pts

career impact before -> after:
  MINOS   apps 2, impact 123.80  ->  apps 1, impact 0.00
  JUJU    apps 1, impact 240.10  ->  apps 0, impact null
  FEJIRO  apps 1, impact 0.00    ->  unchanged

badges recomputed under the rule (revoked, earned on exhibitions):
  MINOS  comeback_king  (revoked; earned on the exhibition entry)
  JUJU   comeback_king  (revoked)
  both First Whistles kept (JUJU's exhibition debut is still a debut;
  MINOS's is on his live entry)
```

Legendary Entries is now empty: its only winners were the two exhibition
entries, so the board shows its empty state (no live winning entry yet).

### Suites and hygiene

```
test:fold      30/30
test:badges    36/36   (30 prior + 6 exhibition cases; old callers unchanged)
test:signing   35/35
tsc --noEmit   clean
npm run build  clean
```

Em-dash scan over new and changed files: clean.

## Files

- `supabase/migrations/0008_exhibition_entries.sql` (new column)
- `src/lib/entry.ts` (exhibition on EntryRow)
- `src/lib/career/stats.ts` (careerRecord live-only)
- `src/lib/career/badges.ts` (First Whistle any debut, rest live-only)
- `src/app/api/resolve/route.ts` (store flag, live appearances)
- `src/app/api/matchday/route.ts` (legendary + results exclude exhibition)
- `src/app/career/page.tsx` (EXHIBITION tag, live-only BEST)
- `src/app/judges/page.tsx` (the line)
- `scripts/test-badges.ts`, `scripts/smoke-career.mjs` (exhibition cases)

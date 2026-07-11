# SMOKE7: visual alignment to the binding design reference

Captured 2026-07-11. Reference: `docs/design/SuperSub.dc.html` (the
prompt's `design/SuperSub_dc.html` names the same file; nothing else
exists). Five screens aligned, one commit each:

| Screen | Commit |
|---|---|
| The Bench | f8a3b95 |
| Signing Day | e8f8561 |
| The Match | d0477a9 |
| Full Time | eb5a7ad |
| The Career | c3fc4f8 |

## Logic untouched

```
$ git diff --stat 94fd169 HEAD -- src/lib src/app/api scripts/ supabase/ src/hooks
(empty: zero changed lines across every logic path over all five commits;
 94fd169 is the commit immediately before the reskin)

$ npx tsx scripts/test-fold.ts     # 16/16  All fold checks passed.
$ npx tsx scripts/test-badges.ts   # 30/30  All badge checks passed.
$ npx tsx scripts/test-signing.ts  # 35/35  All signing checks passed.
$ node scripts/smoke-career.mjs    # ALL PHASE 2 SMOKE CHECKS PASSED
```

## Evidence

`docs/smoke7/side-by-side/` holds one composite per screen per width
(390 and 1280): the reference on the left, the implementation on the
right. Sources in `docs/smoke7/reference/` and `docs/smoke7/impl/`.

The reference sides are the designer's own screens: the .dc file's
component logic (its `renderVals()`, `buildCurve()`, and state) was
executed verbatim through a minimal interpreter for its template DSL
(`sc-if` / `sc-for` / bindings / PixelCrest imports), so every color,
label, and treatment on the left is computed by the designer's code,
not redrawn by hand. The interpreter is capture tooling only and lives
outside the repo.

One state note: the match composites pair the mock's default pre-entry
state against the implementation's richest state (on the pitch);
`impl-match-pre-mobile.png` holds the matching pre-entry
implementation state.

## Deviations from the reference, and why

1. **Mock content not copied (rule 3).** Real teams, players, ratings,
   and clippings throughout; no R. Voss, no 128-sub table, no invented
   headlines. Consequences visible in the composites: our table shows
   the instance's real players; legendary clippings show the real
   9.1x/2.9x winning entries.
2. **Bench fixture cards show no live score.** The bench data
   (`/api/fixtures` + `/api/matchday`) carries no per-fixture score,
   and the data layer is frozen; the centre block shows countdown or
   kickoff stamp instead. Same reason the YOUR RESULT strip shows the
   tier where the mock shows the entry minute (not in the served
   result map).
3. **Simulate VAR, RESET ENTRY, and BLOW FOR FULL TIME were not built
   (rule 4).** The red VAR alert row and the ripBack ticker treatment
   are driven only by real `action_discarded` feed events.
4. **Market-suspension dashes stay on the curve (rule 5).** The mock
   has no suspension concept; hiding it would misreport the market.
5. **CTA pulse is swing-gated.** The file's embedded developer spec
   says "ctaPulse 1.6s when prob swings"; the mock element pulses
   unconditionally because that is its demo state. The spec panel wins.
6. **Career stats grid**: BEST (volt) replaces the old Legendary tile
   per the reference's four cells; the legendary count still lives in
   the bench's Legendary Entries. Rank renders without "OF N" because
   the instance-wide player count is not served. Badge glyphs map the
   reference's glyph set onto our six real badges; the tier-tag ladder
   maps its three mock tiers onto our four real tiers (volt reserved
   for Miracle Territory).
7. **The clipping keeps its own masthead** (The Substitute's Gazette)
   and uses the real scoreline as the headline; the mock's paper name
   and headline are mock content, and our stored reports have no
   headline field.
8. **Signing Day**: the mock's contract number is mock data and is
   omitted (the seal roundel stays); clause headings use a middle dot
   (the no-em-dash rule outranks the file); the position row shows our
   eleven real pills, not the mock's four; the number field keeps its
   sanctioned volt focus ring.
9. **Next-badge progress bar renders only where progress is genuinely
   countable** (appearance-based badges); other badges tease with copy
   alone rather than a fake bar.
10. **Design-file chrome** (phone bezel, browser bar, tab nav, spec
    aside) is presentation of the reference document itself, not
    product, and appears only on the reference side of composites.

Uncovered states kept per rule 5, restyled with reference tokens: feed
error and empty-slate cards, the market-suspended notice, the
"never came off the bench" full-time card, and the ?clean=1 capture
mode.

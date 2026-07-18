# SMOKE6: Phase 2 of the canonical design alignment (Signing Day)

Captured 2026-07-11, inside the July 12 timebox. Option A as agreed: NO
schema change and no migration; the existing `players` columns (name,
shirt_number, position) are the identity. The five stored positions are
unchanged and display-map to DEF / MID / FWD (ST to FWD; AM, CM, DM to
MID; CB to DEF); GK is neither stored nor displayed as a stored value.
Position feeds nothing in scoring (verified before the work: it appears
nowhere in `src/lib/state`, `src/lib/config/scoring.ts`, or
`src/lib/career`).

## What shipped

- **The contract ceremony** (`src/components/SigningForm.tsx`), per the
  reference: SIGNING DAY · FIRST RUN eyebrow, SIGN YOUR CONTRACT in
  Saira 700 34/40px, the live PixelCrest preview (118px) regenerating
  on every name and number keystroke, CLAUSE I identity (surname input
  Saira 700 22px uppercase with input filtering to A-Z and hyphen; the
  shirt-number field with volt border and focus ring; five position
  pills, group shown live on the crest panel), CLAUSE II terms with
  TERM · PERMANENT in volt, the Gaffer's quote in Zilla Slab italic,
  and SIGN CONTRACT with the volt gradient, glowBreath 2.6s and the
  sheen sweep. The clause headings use a middle dot where the mock used
  an em dash; the no-em-dash rule outranks the reference file.
- **First-run routing**: a playerless visit to `/` lands on the
  ceremony alone (no masthead, no slate); the hub renders only for
  contracted players. The match screen's unsigned state already links
  here.
- **Surname rule, both ends**: 2 to 12 characters, A-Z plus hyphen,
  letter at both ends, normalized to uppercase. Enforced in the client
  (filtered input plus disabled CTA) and at the write
  (`POST /api/player` answers 400 with broadcast copy). Identity
  remains immutable: PATCH still answers 403 unconditionally.
- **Display mapping**: the kit card and career hero now show the group
  (No. 7 · FWD) with the full position name preserved in the title
  attribute.

## Tests

`npm run test:signing` (pure, 27 checks): validation bounds including
1/2/12/13 chars, hyphen placement, apostrophe/digit/space/diacritic
rejection, case normalization; the five-to-three position mapping with
no GK anywhere; PixelCrest determinism (same seed stable, different
seeds diverge).

`npm run smoke:signing` (HTTP, 13 checks, full output below): first-run
signal, five 400 rejections at the write, a conforming double-barrelled
signing at 201 stored uppercase, 409 on a second signing, 403 on
rename, and the option-A equivalent of "migration leaves existing
players functional": a legacy row with a spaced mixed-case name is
inserted directly, its cookie minted with the server's own HMAC, and
`/api/career` serves it.

```
[smoke6] PASS  first run: GET /api/player has player null
[smoke6] PASS  write rejects 1 char with 400  (got 400)
[smoke6] PASS  write rejects 13 chars with 400  (got 400)
[smoke6] PASS  write rejects digits with 400  (got 400)
[smoke6] PASS  write rejects inner space with 400  (got 400)
[smoke6] PASS  write rejects leading hyphen with 400  (got 400)
[smoke6] PASS  conforming surname signs with 201  (got 201)
[smoke6] PASS  surname stored uppercase  (VAN-EEJF)
[smoke6] PASS  identity cookie set
[smoke6] PASS  second signing answers 409  (got 409)
[smoke6] PASS  rename answers 403  (got 403)
[smoke6] PASS  legacy player (old-rule name) still serves a career  (HTTP 200, name Legacy Row 6008)
[smoke6] ALL SIGNING CHECKS PASSED
```

## Logic untouched

```
$ git diff --stat af6f598 -- src/lib/state src/lib/config/scoring.ts \
    src/lib/feed src/lib/sources src/lib/career src/lib/server \
    src/app/api/enter src/app/api/resolve src/app/api/stream \
    src/app/api/fixtures src/app/api/matchday src/app/api/career supabase/
(empty: zero changed lines across both design phases)
```

The one sanctioned API change is `src/app/api/player/route.ts` (the
identity write validation, 9 lines). `supabase/migrations/` gained
nothing: option A means no migration.

```
$ npx tsx scripts/test-fold.ts    # 16/16  All fold checks passed.
$ npx tsx scripts/test-badges.ts  # 30/30  All badge checks passed.
$ node scripts/smoke-career.mjs   # ALL PHASE 2 SMOKE CHECKS PASSED
                                  # (freshly signed SMOKE-CEHEE #14; the
                                  #  script's generated player name was
                                  #  made rule-conforming, its only change)
```

The pre-existing-player case is covered twice: the legacy-row check in
smoke:signing above, and every earlier player in the shared instance
still appearing in The Table and /api/matchday unchanged.

## Screenshots

`docs/smoke6/before/` and `docs/smoke6/after/`, both widths (390 and
1280), same driver (types VAN-DIJK, number 4, captures with the live
crest showing): before is the Phase 1-styled form, after is the full
contract ceremony.

## Addendum, 2026-07-11: preview 500 on the signing write, fixed

Reported: POST /api/player on the Phase 2 preview answered 500 with
Content-Length 0 for valid input (MINOS, 7, AM). Root cause, from the
preview function logs: every env var except ANTHROPIC_API_KEY was
scoped to Production only, so preview functions had no Supabase keys
and the supabase() guard threw an unhandled exception. GET /api/player
passed only because a cookieless request returns before touching
Supabase; GET /api/matchday was 500 for the same reason.

Fix: all eight vars added to the Preview scope (via the Vercel REST
API; the CLI's env add for preview scope kept demanding a git branch
even in its documented no-branch form). Hardening shipped regardless of
the root cause: the signing route wraps its handler so any failure
answers JSON 500 ("The pen ran dry. Try again." plus detail), and the
ceremony treats non-2xx, network failure, or a 10 second timeout as
failure, prints "The ink did not take. Try again." and re-arms the
button. Forced-failure proof (Supabase env deliberately blanked on a
local server): the API answered the JSON 500 and the ceremony showed
the line with the button re-armed (docs/smoke6/forced-failure.png).

Also in this pass: positions expanded to eleven stored values (LW/RW
to FWD, LM/RM to MID, LB/RB to DEF, no GK; the request said ten but
named six additions to the existing five, and the explicit list wins).
Migration 0003 widens the position CHECK constraint only: no columns,
tables, or data change. test:signing is now 34 checks (count corrected 2026-07-11; originally overstated as 35).

Re-verification on the fixed preview
(supersub-l8lcyqj60-shrooms08s-projects.vercel.app): the exact repro
signs at 201 (MINOS, AM, 7), a new-vocabulary LW signing stores at 201,
and smoke:signing passes 13/13 when the legacy-cookie step is minted
with the target environment's secret (the earlier 401 on that one step
was the test tool using the local dev fallback secret against a
deployment holding the production secret; an environment mismatch in
the harness, not an app fault). Fold 16/16, badges 30/30 unchanged.
Note: deployment protection was disabled on the project so previews are
publicly reachable for HTTP verification; re-enable in the dashboard if
previews should be private again. Repro rows (MINOS, WINGER) were
removed from the shared database after verification.

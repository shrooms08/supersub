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

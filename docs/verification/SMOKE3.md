# SMOKE3: Phase 3 evidence (production, demo kit, submission documents)

Captured 2026-07-10. Production URL: **https://supersub-tau.vercel.app**
(Vercel project `supersub`, single region `fra1` per `vercel.json`,
deployment `dpl_7uhaPw2SpH8bde5A8u2JpXSeP2FN`). All secrets live in
Vercel env settings (`vercel env ls production` shows SUPABASE_URL,
SUPABASE_ANON_KEY, TXLINE_NETWORK, TXLINE_JWT, TXLINE_API_TOKEN,
SUPERSUB_SESSION_SECRET, SUPERSUB_MODE, REPLAY_SPEED, all Encrypted);
nothing is committed.

## 1. Production cold-visit and full loop

`node scripts/smoke-prod.mjs https://supersub-tau.vercel.app 60`, run
from a machine with no cookies or state, exercising the same anchor
mechanism the browser uses (stream, enter, and resolve deliberately
land on separate serverless invocations):

```
[smoke3] GET /judges -> HTTP 200
[smoke3] GET / -> HTTP 200
[smoke3] GET /career -> HTTP 200
[smoke3] fixtures: Argentina v Egypt | Switzerland v Colombia | France v Morocco
[smoke3] player created: Prod Check 7400 (cookie captured)
[smoke3] stream connected with anchor 1783715817400 (speed 60x)
[smoke3] ENTERED for Morocco at 5' (P 15.1%, 8.70x) via a separate function invocation
[smoke3] VAR sequence observed on the production stream (goal id 495 discarded)
[smoke3] RESOLVED on production: 0-2, window -10, final 0
[smoke3] report_source: template
[smoke3] report: Prod Check 7400, the number 99, came on for Morocco in the 5th minute at 0-0, ...
[smoke3] career: appearances 1, impact 0, badges first_whistle
[smoke3] ALL PRODUCTION CHECKS PASSED (player 93e5e974-e25e-4459-90a1-a0c348ce3eac)
```

Persistence cross-checked in Supabase: the row for player
`93e5e974-e25e-4459-90a1-a0c348ce3eac` shows fixture 18209181, entry
minute 5, multiplier 8.70, window -10, final 0, `report_source =
'template'`, resolved, 1 badge.

A real bug was found and fixed by this run: `/api/resolve` did not
carry the replay speed, so on a fresh serverless instance the anchored
session reconstructed at the default pace and answered 409 "the
whistle has not gone". Resolve now carries anchor plus speed, like
enter (`src/app/api/resolve/route.ts`); production re-verified after
redeploy. This failure mode is exactly what the refresh-recovery
requirement was about, and it cannot happen for the browser flow now.

Screenshots (in `docs/smoke3/`):

1. `01-judges-phone.png` - /judges cold on a 390pt phone viewport
2. `02-judges-desktop.png` - /judges cold at 1440px
3. `03-scenario-c-entry-moment.png` - the Scenario C entry moment ON
   PRODUCTION with `clean=1`: Argentina 0-1 down at 72', hero number
   5%, Miracle Territory 10.0x on offer, the curve dive on screen

## 2. Replay determinism (the judge-refresh constraint)

Replay sessions are keyed by (fixture, anchor); the anchor is minted
once per browser tab, stored in sessionStorage, and sent on stream,
enter, and resolve. Consequences, all exercised above: every judge tab
gets a private timeline; a refresh resumes the same match position; a
request landing on a different serverless instance derives the
identical virtual clock (the production entry above was accepted at
minute 5 by an invocation that had never seen the stream). Region is
pinned to `fra1`. Restarting a scenario is closing the tab (new tab =
new anchor = fresh kickoff).

## 3. Demo scenarios (DEMO.md) verified

Scenario numbers were derived by sweeping entry minutes through the
app's own scoring code (`scripts/scan-scenarios.ts`, output below
abridged) and the comeback fixture was found by scanning ten finished
fixtures' histories (`scripts/scan-comebacks.ts`):

```
18202701  Argentina v Egypt: final 3-1  VAR-erased goals: 1  COMEBACK: Argentina trailed 0-1 and finished 3-1
18187298  Brazil v Norway: final 1-1    VAR-erased goals: 1  COMEBACK: Brazil trailed 0-1 and finished 1-1
18176123  Australia v Egypt: final 1-1  COMEBACK: Australia trailed 0-1 and finished 1-1
```

Correction (2026-07-11): the 18202701 line above was produced by a fold
bug that erased Egypt's pre-coverage first-half goal. The real final is
3-2 and Argentina trailed 0-2; the fold was fixed and the audit is in
SMOKE9.md. The comeback is stronger than the scan reported.

```
France v Morocco: France 62' -> P 86.9%, 1.00x Safe Hands, window 24, final 24        (Scenario A)
France v Morocco: Morocco 44' -> P 11.5%, 9.16x Miracle Territory, window -10, final 0   (Scenario B, VAR at 49' in window)
Argentina v Egypt: Argentina 75' -> P 4.0%, 10.00x Miracle Territory, window 44, final 440,
                   badges miracle_worker + comeback_king              (Scenario C)
```

The VAR overturn on the camera-ready path is confirmed twice: the
production smoke observed goal id 495's `action_discarded` on the wire
(Scenario B's window), and Phase 2's browser capture
(`docs/smoke/05-var-overturned-mobile.png`) shows the on-screen
treatment. Scenario C's data was verified on production in screenshot
03; its scoreboard sequence (0-0, 0-1 at 58', VAR rollback to 0-0,
0-1 at 67') matches DEMO.md's beats.

Honest data note, also stated in DEMO.md: the scenario sketch's
"France around minute 30" prices at 62.4% (2.62x, Squad Rotation);
true Safe Hands requires entering after the 60' goal at 86.9%. DEMO.md
uses the real numbers.

## 4. Model-generated report in production: BLOCKED, one operator step

No Anthropic API key exists on this machine, and minting one is not
something the build can do. Everything else is wired and proven (the
template path above ran in production through the same code). To
complete this item:

```
printf '%s' '<ANTHROPIC_API_KEY>' | vercel env add ANTHROPIC_API_KEY production
vercel redeploy supersub-tau.vercel.app   # env changes need a redeploy
node scripts/smoke-prod.mjs https://supersub-tau.vercel.app 60
# expect: report_source: model, and a 60-90 word broadsheet report
```

`report_source` is stored per entry, so the verification is a single
SQL glance: `select report_source, report from entries order by
created_at desc limit 1;`

## 5. Secrets audit (this repo, full git history)

```
$ git log --all --diff-filter=A --name-only --pretty=format: | sort -u | grep -iE '\.env|token|\.keys|secret|wallet|credential'
.env.example

$ git grep -c 'eyJ' $(git rev-list --all) -- # JWT-shaped strings anywhere in history
0

$ git blob scan for sk-ant-/txorac/private-key/service_role patterns
0 hits across all blobs in history

$ git check-ignore .env.local .cache && echo ignored
.env.local
.cache
ignored
```

The only committed match is `.env.example` (empty placeholders). The
cookie signer's committed dev fallback string is documented in code and
overridden in production by the random SUPERSUB_SESSION_SECRET set
above. The spike repo (wallet keypair, tokens) is separate and private;
this repo stands alone and clean.

## 6. Regression and documents

- `npx tsc --noEmit`, `npm run build`, `npm run test:fold` (16 checks),
  `npm run test:badges` (30 checks): all pass after the Phase 3
  changes.
- `npm run smoke:career` passes locally end to end (two matches,
  badges, reports). The Phase 1-era `npm run smoke` script now stops at
  the player gate by design (Phase 2 made entering require a signed
  player); `scripts/smoke-prod.mjs` is its Phase 3 successor.
- Documents shipped: README.md (rewritten to the submission order,
  including the Solana subscribe flow with devnet tx signature and the
  replay honesty note), TECHNICAL.md (endpoint list cross-checked
  against `src/lib/server/txline.ts` call sites and the spike scripts),
  FEEDBACK.md, MONETIZATION.md, LICENSE (MIT), DEMO.md, SHOTLIST.md.
- No em dashes anywhere: repo-wide scan matches only the report
  sanitizer, its test, and its SQL proof, which exist to enforce the
  rule on generated copy.

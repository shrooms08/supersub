# SMOKE12: Claim Your Legend (Privy sign-in + wallet)

Captured 2026-07-11 on branch `claim-your-legend`. The feature is
feature-flagged behind `NEXT_PUBLIC_CLAIM_ENABLED` and ships dark: with
the flag unset the bench shows the same static Solana tease it always
has, no Privy runtime is mounted, and anonymous play is byte-for-byte
the current build. The Fixtures feature from the previous night is
integrated, not regressed.

## Architecture as built

- **Anonymous play untouched.** The signed HMAC cookie remains the only
  identity needed to create and play a career. There is no login wall
  anywhere on the core loop. Claiming is purely additive.
- **Migration 0007** adds two nullable columns to `players`
  (`privy_user_id`, `wallet_address`), each with a PARTIAL unique index
  (`where ... is not null`), so one account is one career and one wallet
  is one career, while the many unclaimed players (all NULL) never
  collide. The binding is done through a `claim_player` SECURITY DEFINER
  function, not a table UPDATE: migration 0006 deliberately left
  `players` with no anon UPDATE policy, and rather than reopen that (and
  the name-immutability guarantee) the function exposes exactly one safe
  operation. It writes only the two claim columns, only when the player
  is still unclaimed, and needs no service-role key in the app.
- **Server-side verification.** `/api/claim` and `/api/claim/resume`
  take the Privy access token from the `Authorization: Bearer` header,
  verify it with `@privy-io/server-auth` (`verifyAuthToken`), and read
  the authoritative Solana wallet and email straight from Privy's API
  (`getUser`). The request body is never trusted for the user id or
  wallet.
- **Resume.** A signed-in visitor with no cookie posts to
  `/api/claim/resume`; the server looks the player up by
  `privy_user_id` and mints the same HMAC cookie, so one account plays
  one career from any browser.
- **States.** Bench card and career page: unclaimed shows CLAIM YOUR
  LEGEND (volt CTA into Privy); claimed shows LEGEND CLAIMED with the
  masked wallet (GCLD...VH1K) and the bound email when present. A second
  claim on a claimed player returns 409 in the broadcast voice.
- **Wallet page** (`/wallet`, signed-in only): masked address with copy,
  live SOL balance from a public RPC, Export Wallet into Privy's export
  flow, and a Transaction History shell marked SOON. Display and export
  only; no send, receive, or deposit. The mint stays the FT roadmap
  beat.

## 1. Migration applies and is correct

`supabase/migrations/0007_claim_legend.sql` applied. Verification:

```
new columns on players:  privy_user_id, wallet_address   -> 2
partial unique indexes:  players_privy_user_id_key,
                         players_wallet_address_key       -> 2
function claim_player:   exists, prosecdef = true (SECURITY DEFINER)
```

The migration is additive and idempotent (`add column if not exists`,
`create unique index if not exists`, `create or replace function`), so
it applies cleanly on a fresh database and re-applies without error.

## 2. The claim invariants, proven at the DB layer

Two throwaway players (SMOKE-CLAIMA, SMOKE-CLAIMB), removed afterward.
Each step is exactly what the endpoint does:

```
1. A claims did:privy:TESTUSER1 + wallet
   claim_player(A, TESTUSER1, walletX) -> returns A with the two columns set   PASS

2. A claims again (permanence)
   claim_player(A, OTHER, otherwallet) -> NULL row (null-guard matched nothing)
   -> the endpoint turns NULL into 409 "claimed once, for good"                PASS

3. B claims A's identity (one account, one career)
   claim_player(B, TESTUSER1, ...) -> unique_violation on privy_user_id index
   -> the endpoint maps 23505 to 409                                           PASS
   (afterward only A holds TESTUSER1; B was not bound)

4. B claims A's wallet (one wallet, one career)
   claim_player(B, TESTUSER2, walletX) -> unique_violation on wallet index     PASS

5. Resume lookup
   select ... where privy_user_id = 'did:privy:TESTUSER1' -> finds A           PASS
```

All five hold. This is where the substantive correctness lives: the
endpoints are thin wrappers that verify the Privy token and then call
this function or this lookup.

## 3. UI states (flagged build)

Built with the flag on and a valid-format placeholder app id, so the
provider mounts and the states render (screenshots in
`scratchpad/claim-shots/`):

- `claim-bench-unclaimed.png`: the bench card reads CLAIM YOUR LEGEND
  with the volt CTA. Body assertion: page contains "claim your legend".
- `claim-bench-claimed.png`: after binding the test player in the DB,
  the same card reads LEGEND CLAIMED / YOURS, FOR GOOD / WALLET
  GCLD...VH1K / OPEN WALLET. Assertions: contains "legend claimed" and a
  masked wallet. The whole Fixtures board (TODAY Norway v England,
  COMING UP, RESULTS with Argentina 3-2 Egypt and Switzerland pens, the
  REPLAYS rail) renders above it unchanged: the two features coexist.
- `claim-wallet-gate.png`: `/wallet` renders its frame and the loading
  skeleton (see the honest note below on why it stops there under a
  placeholder id).

Dark behaviour: with the flag off, the bench card is the original
Solana tease (the same markup, moved verbatim into the component's
`StaticTease`), the career page renders no claim card, and no Privy code
is mounted.

## 4. Builds, suites, hygiene

```
tsc --noEmit                              clean
npm run build (DARK, flag off)            success; anonymous loop unchanged
npm run build (FLAGGED, flag on)          success; /api/claim, /api/claim/resume,
                                          /wallet all present
test:fold      30/30   (untouched)
test:badges    30/30
test:signing   35/35
```

A Next build change was needed: Privy's SDK statically references
optional integrations this app does not use (`@stripe/crypto`,
`@farcaster/mini-app-solana`); they are aliased to `false` in
`next.config.mjs` so webpack resolves them to empty modules. The
`@privy-io/react-auth/solana` subpath was deliberately NOT used: it
pulls Solana program peer deps that conflict on install, so the wallet
page reads the address from the Privy user's linked accounts and uses
the main `useExportWallet`.

Em-dash scan over every new and changed file: clean.

## 5. Honest stopping point

Everything server-side, DB-side, and the rendered UI states are done
and verified. What could NOT be exercised in this headless environment,
and why:

- **Interactive Privy email login.** Signing in by email requires a real
  Privy app and a one-time email OTP, which cannot be automated
  headlessly. So the live click-through (anonymous play -> claim via
  email -> resume on a fresh browser) was not run end to end here.
- **Real server-side token verification.** `verifyPrivyToken` needs
  `PRIVY_APP_ID` and `PRIVY_APP_SECRET`. A production env pull showed
  neither is currently set (the brief expected the public app id in
  Vercel; it was not present at capture), and the secret is required for
  the server path. The verification code is written to the SDK's
  documented API but was not run against a live token.
- **Wallet authenticated states.** Under a placeholder app id Privy never
  reaches `ready`, so `/wallet` shows its loading skeleton rather than
  the address, live balance, and export button. Those render once a real
  app id connects.

To complete verification once credentials exist (operator, ~5 minutes):

```
# In Vercel (Preview) or .env.local, set:
NEXT_PUBLIC_CLAIM_ENABLED=1
NEXT_PUBLIC_PRIVY_APP_ID=<the 25-char app id>
PRIVY_APP_SECRET=<the app secret, server-only>
# In the Privy dashboard, enable email + external wallet login and
# embedded Solana wallet creation for users without one.

npm run build && npm start
# 1. Play a match anonymously (no login).
# 2. Bench card -> CLAIM YOUR LEGEND -> sign in by email -> LEGEND CLAIMED
#    with the masked wallet and your email.
# 3. Clear cookies, reload -> Resume Your Career -> same career restored.
# 4. From a second anonymous career, sign in with the same email and try
#    to claim -> 409 in the broadcast voice.
# 5. /wallet -> address + copy, SOL balance, Export Wallet, tx SOON.
```

The DB invariants in section 2 already prove that steps 2, 3, and 4
resolve correctly the moment a verified identity reaches them; what
remains unproven here is only the Privy transport in front of them.

## Files

- `supabase/migrations/0007_claim_legend.sql` (new)
- `src/lib/server/privy.ts` (new: token verification)
- `src/app/api/claim/route.ts`, `src/app/api/claim/resume/route.ts` (new)
- `src/lib/player.ts` (claim state, wallet mask), `src/app/api/player/route.ts`,
  `src/app/api/career/route.ts` (expose claim state)
- `src/lib/claim.ts` (flag), `src/components/Providers.tsx`,
  `src/components/ClaimLegend.tsx` (new)
- `src/app/wallet/page.tsx` (new), `src/app/layout.tsx`, `src/app/page.tsx`,
  `src/app/career/page.tsx` (wiring)
- `next.config.mjs` (optional-dep aliases), `.env.example`

# Roadmap

What was deliberately left out of this build, and why. Nothing here is a
promise of dates; it is the honest edge of the product, so a reader knows
each gap is a decision, not an oversight. Every item traces to a call
made during the build (see the linked evidence under
`docs/verification/`).

## Minting the legend on-chain

Claim Your Legend binds an authenticated identity and an embedded Solana
wallet to a career, and the app tells the player their record mints
"permanently on Solana when the tournament ends." The mint itself is not
in this build: claiming establishes the identity and the wallet first, so
that when the career, appearances, badges, and match reports are written
on-chain there is a verified owner to write them to. Shipping identity
before issuance is the safe order. See
`docs/verification/SMOKE12.md`.

## Real authentication and per-user isolation

Identity today is a signed anonymous cookie with no accounts, a
deliberate hackathon posture that keeps the core loop frictionless. The
row-level security lockdown removed every destructive and cross-player
write path, but true "own rows only" isolation needs a real `auth.uid()`
to scope on, which anonymous cookies do not provide. Privy email sign-in
(shipped dark behind a flag) is the bridge to that real-auth follow-up.
See `docs/verification/SMOKE8.md` and `docs/verification/SMOKE12.md`.

## Extra-time entry ("Into the Night")

Knockout matches that reach extra time could reopen the bench for one
fresh entry. The blocker is pricing: a data check across a real
after-extra-time match and the live capture found that the 1X2 result
market closes at the regulation whistle and no extra-time market exists,
so there is no live win-probability signal to set an extra-time
multiplier the way regulation entries are priced. Regulation windows,
which settle at the 90th-minute whistle, are untouched and correct; the
extra-time entry parks until a multiplier basis is decided.

## Model-written match reports in production

The Gazette report pipeline is fully wired and proven end to end: at
resolution, a model writes a 60 to 90 word broadsheet report from the
entry's structured facts only, with a deterministic template as the
fallback. Production currently runs the template path because no
`ANTHROPIC_API_KEY` is set on the deployment; one environment variable
and a redeploy switch it to the model. The operator step is in
`docs/verification/SMOKE3.md`.

## Wallet: transaction history

The wallet page is display and export only by design: the masked address
with copy, the live SOL balance from a public RPC, and an Export Wallet
deep-link into Privy's flow. There are no send, receive, or deposit
flows. Transaction history ships as a clearly marked SOON shell and is
the natural next addition once the mint gives the wallet something to
show. See `docs/verification/SMOKE12.md`.

## Year-round, multi-league reach

The engine is fixture-agnostic: score, phase, and win probability are a
pure fold of whatever event log the feed provides, so nothing about the
product is specific to a World Cup summer. The same loop runs on any
league the feed covers. That is a distribution and content decision, not
an engineering one.

## The regulated path: stake on yourself

The obvious commercial extension is a pool where a player stakes on their
own entry clearing a points threshold, with the TxLINE-derived
probability at entry setting the line and an on-chain settlement trail
making every payout auditable against the same feed the scoring used.
This is a licensed product in most jurisdictions and is explicitly not in
this build; it would ship only behind the appropriate approvals,
geofencing, and age gates. The architecture is already event-sourced and
byte-exact replayable specifically so that settlement disputes have one
provable answer.

## Smaller hardening notes

- Replay session clocks are in-memory per server instance, held stable by
  a pinned region and a per-tab timeline anchor; a durable session store
  would remove the region pin.
- Where a feed's coverage opens mid-match, a goal scored before it has no
  event row; the match report annotates the gap rather than inventing a
  scorer or minute. Richer back-fill would need the feed to carry those
  earlier events.

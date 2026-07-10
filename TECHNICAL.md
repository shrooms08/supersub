# TECHNICAL

## Core idea

Super Sub is a one-decision fantasy game on live football. The player
watches a real match with a live win-probability curve and presses
ENTER THE PITCH once, at a minute of their choosing. Everything the
feed reports after that instant becomes their scoring window; the
final score is the window's points multiplied by how improbable their
side's win looked at entry (1.0x at p >= 0.75 up to 10.0x at
p <= 0.05). Resolved entries build a persistent career: Impact Rating,
badges, form, and an LLM-written match report per appearance.

## Business highlights

- A one-button mechanic that a first-time viewer understands in one
  sentence, with depth coming entirely from WHEN, not from roster
  management. It works second-screen during any broadcast match.
- The multiplier converts the neutral's favorite feeling, "this is
  lost, surely", into the product's core bet, and the odds feed prices
  it credibly (the house number and the player number are the same
  demargined TxLINE price).
- Career, badges, and named third-person match reports give every
  entry a shareable artifact, the retention hook between match days.
- Replay mode makes the product demoable and playable between
  fixtures and after the tournament, using real recorded data through
  the identical pipeline; it doubled as the development environment.

## Technical highlights

- Event-sourced match state: score, stats, phase, and points are a
  pure fold of the ordered event log, correlated by action id. VAR
  overturns (`action_discarded`) roll back score and provisional
  points in the same tick; the France v Morocco 49' erasure is the
  bundled, replayable proof.
- A single normalization layer tolerates the feed's PascalCase and
  camelCase variants and encodes absent-key-means-zero, the quirk that
  silently corrupts any carry-forward accumulator after a VAR erasure.
- Stream-first, snapshot-for-cold-start data plumbing: joins and
  reconnects rebuild state from the per-action scores snapshot plus
  sealed 5-minute interval history, then trust SSE only.
- Win probability from the feed's own demargined Pct with a
  normalized-inverse-odds fallback, suspension-aware (empty price
  arrays hold the last value and are flagged).
- Replay timelines are anchored: each browser tab carries a wall-clock
  anchor, so any server instance derives the identical virtual clock,
  refreshes resume in place, and every judge gets a private match.
- Scoring is computed exactly once from the final fold at the whistle,
  server-side; the client's provisional number is the same pure
  function applied to the current fold. One entry per player per
  fixture is a database constraint, not an application promise.
- Identity without accounts: an HMAC-signed anonymous player id in an
  httpOnly cookie backed by a Supabase row.
- Match reports are generated from structured facts only (no free
  context), with an explicit no-invention instruction, a deterministic
  template fallback, and store-once semantics.

## TxLINE endpoints used

Verified against the code of both this app (`src/lib/server/txline.ts`
call sites) and the Phase 0 spike. Hosts: `txline-dev.txodds.com`
(devnet entitlement, used throughout) and `txline.txodds.com`
(mainnet, config-switched).

Authentication and subscription:

| Endpoint | Used for |
|---|---|
| `POST /auth/guest/start` | guest JWT issue and automatic renewal on 401 (app and spike) |
| `POST /api/token/activate` | activating the API token after the on-chain subscribe; message `txSig:leagues:jwt` signed by the wallet (spike) |
| Solana program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` (devnet) | on-chain pricing matrix read plus `subscribe` instruction, Token-2022 ATA creation (spike; tx `38Fs8UBvaUPXoXQ3fmrUqYayaaq633ceHYniN8FyP6y1HyLrHpWvcuSNPH3LpdGarWPWkEYzLZQLSoP7jZGnoAE`) |

Fixtures:

| Endpoint | Used for |
|---|---|
| `GET /api/fixtures/snapshot` | the Bench in live mode; fixture metadata |
| `GET /api/fixtures/snapshot?startEpochDay={day}` | lookback for replayable finished fixtures (~48 days of metadata) |

Scores:

| Endpoint | Used for |
|---|---|
| `GET /api/scores/stream?fixtureId={id}` (SSE) | primary live event source |
| `GET /api/scores/snapshot/{fixtureId}` | latest event per action type with cumulative Score/Stats; live join baseline and resolution |
| `GET /api/scores/updates/{epochDay}/{hourOfDay}/{interval}?fixtureId={id}` | sealed 5-minute interval backfill for live joins and resolution |
| `GET /api/scores/historical/{fixtureId}` | full event log of a finished match (replay source; returns SSE-framed text, handled) |

Odds:

| Endpoint | Used for |
|---|---|
| `GET /api/odds/stream?fixtureId={id}` (SSE) | primary live odds source (filtered to `1X2_PARTICIPANT_RESULT`, `MarketPeriod=null`, bookmaker TXLineStablePriceDemargined) |
| `GET /api/odds/snapshot/{fixtureId}` | odds cold start on live join (retried once on `[]`) |
| `GET /api/odds/updates/{epochDay}/{hourOfDay}/{interval}?fixtureId={id}` | historical odds for replay bundles and live-join curve backfill |

## Storage schema (Supabase)

`players` (id, name, position, shirt number), `entries` (one per
player per fixture, unique-constrained; entry instant, locked
probability and multiplier, resolution columns, breakdown JSON, stored
report and its source), `player_badges` (primary key player + badge).
Migrations in `supabase/migrations/`, idempotent.

## Deployment

Vercel, single region (`fra1`, `vercel.json`), Next.js route handlers
only; the replay data bundle is traced into the serverless functions.
The SSE route sets `maxDuration = 300` and relies on EventSource
auto-reconnect plus anchored sessions across function recycles.
Secrets (Supabase, TxLINE tokens, Anthropic key, cookie-signing
secret) live in Vercel env settings only.

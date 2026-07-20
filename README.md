# Super Sub

**You are the substitute. Enter a real World Cup match at the minute of
your choosing; the worse it looks when you step on, the bigger the
multiplier you carry to the final whistle.**

**Live:** https://supersub-cup.vercel.app · **Demo video:**
https://youtu.be/9n1K8SvHB_U · **Judges start here:**
https://supersub-cup.vercel.app/judges

## Thirty seconds

Super Sub turns live football into a one-decision game. You watch a
real match with a live win-probability curve drawn from TxLINE's
demargined odds. At any minute you press ENTER THE PITCH. From that
instant, real match events become your stat line: goals for and against
your side, clean sheets, the result at the whistle. Your points are
multiplied by how unlikely your side's win looked at the moment you
entered, from 1.0x (cruising) to 10.0x (lost cause). Every appearance
feeds a persistent career: an Impact Rating, a badge cabinet, form, and
a match report written about YOU, by name and shirt number, in
broadsheet prose. One decision, real stakes in points, a career of
receipts.

## How it works

**The loop.** Pick a side, watch the curve, enter once. Window scoring
(all constants in `src/lib/config/scoring.ts`): goal for your side
+10, goal conceded -5, nothing conceded in your window +4, win at
the whistle +10, draw salvaged from behind +6. Final score =
max(0, window points) x your locked multiplier.

**The multiplier.** Locked at the entry instant from your side's win
probability p: 1.0x at p >= 0.75, 10.0x at p <= 0.05, linear between.
Displayed as tiers: Safe Hands, Squad Rotation, The Gamble, Miracle
Territory. Probability comes from TxLINE's own demargined consensus
prices, so the house number and your number agree.

**The career.** Identity is a signed anonymous cookie, no accounts.
Each resolved entry updates appearances, Impact Rating (rolling average
of final scores), form (window W/D/L), and a six-badge cabinet
(including Miracle Worker for winning a window entered at p <= 0.10,
and Wounded for conceding three, because self-deprecation is part of
football). At resolution, claude-sonnet-4-6 writes a 60-90 word match
report from the entry's structured facts only, with a deterministic
template fallback; it is stored once and never regenerated.

## TxLINE integration architecture

Built on the findings of a dedicated API spike (Phase 0). The parts
that matter:

- **One normalization layer** (`src/lib/feed/normalize.ts`): the only
  module that touches raw feed payloads. It tolerates both PascalCase
  (historical endpoints, observed SSE) and camelCase (spec schemas) and
  encodes the feed's most dangerous quirk: inside Score/Stats maps an
  absent key means ZERO, not "unchanged".
- **Event-sourced state** (`src/lib/state/fold.ts`): score, stats,
  ticker, and match phase are always a pure fold of the ordered event
  log; there are no incremental tallies anywhere. Events correlate by
  action id across their unconfirmed/confirmed lifecycle.
- **VAR rollback**: `action_discarded` erases by action id inside the
  fold, so an overturned goal corrects the score, the provisional
  points, and the UI in the same tick it arrives. France v Morocco's
  real 49' VAR erasure is the bundled proof.
- **Stream plus backfill reconstruction**: SSE streams are primary; a
  join or reconnect first rebuilds state from the per-action snapshot
  endpoint plus sealed 5-minute interval history, then trusts the
  stream. Odds snapshots returning `[]` (a real 5-minute cache
  rollover flake) are retried once and tolerated.
- **Win probability** (`src/lib/state/winprob.ts`): prefers the feed's
  demargined `Pct`, falls back to normalized inverse 1X2 odds, holds
  the last value through market suspensions and flags them.
- **Match phase** ignores the feed's `GameState` field entirely (stuck
  on "scheduled" for a whole finished match); phase derives from
  kickoff time and event flow with a documented finished heuristic.

## Solana integration

TxLINE access is purchased on-chain. The Phase 0 spike ran the full
flow on **devnet** against program
`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`: guest JWT, reading the
on-chain pricing matrix, creating the Token-2022 associated token
account, sending the `subscribe` instruction, then activating the API
token by signing `txSig::jwt` with the wallet key (nacl detached
signature). Confirmed subscribe transaction:

```
38Fs8UBvaUPXoXQ3fmrUqYayaaq633ceHYniN8FyP6y1HyLrHpWvcuSNPH3LpdGarWPWkEYzLZQLSoP7jZGnoAE
```

The devnet pricing matrix exposes a free real-time tier (service level
1, sampling 0s), which this build uses. On mainnet the same code path
targets service level 12 (real-time) with a funded wallet. The app
itself consumes the resulting `TXLINE_JWT` and `TXLINE_API_TOKEN` via
env vars; the guest JWT renews itself on 401.

## Business model

The core loop stays free to play: picking a side, entering, and building
a career cost almost nothing per user, and the artifact they produce (the
newspaper match report, written about you by name) is the growth loop.
The first paid layer is a season pass scoped to a tournament or league,
selling cosmetic depth (kit and crest customization, report tone packs,
cabinet themes) and extended career history and stat splits; none of it
touches scoring, so paying never moves a multiplier and the competitive
core stays credible. The second is sponsored moments: a broadcaster or
bookmaker brands the entry instant itself ("The 78th Minute, presented by
X") and the resolved report card, native inventory at the seconds of peak
attention. Because the engine is fixture-agnostic, the same product runs
year-round on any league the feed covers, not just a World Cup summer.
A regulated stake-on-yourself pool is the obvious later path and is
deliberately NOT in this build; it would ship only behind the appropriate
licensing, geofencing, and age gates.

## Stack

Next.js 14 (App Router, TypeScript, route handlers only on the server),
Tailwind, Supabase (players, entries, badges; one entry per player per
fixture enforced by constraint), Anthropic API (match reports), Vercel
(single region, `fra1`). No other services.

Full verification trail: `docs/verification/` - every phase was gated
with evidence before merge, including a live-fixture verification run and
a scoring audit against real match data.

## Running locally

```
npm install
# copy .env.example to .env.local and fill in Supabase + (optionally)
# TxLINE tokens and ANTHROPIC_API_KEY; apply supabase/migrations/ in
# order (dashboard SQL editor or supabase db push)
npm run dev
```

Replay mode works offline out of the box: France v Morocco (18209181)
and Argentina v Egypt (18202701) ship in `data/replay/`. Verification:
`npm run test:fold`, `npm run test:badges`, `npm run smoke`,
`npm run smoke:career` (captured runs in `docs/verification/`: SMOKE.md,
SMOKE2.md, SMOKE3.md). Demo choreography lives in
`docs/production/DEMO.md`.

## Replay mode, honestly

The World Cup ends; the product does not get to pretend otherwise.
Replay mode (`?mode=replay`, the default after the tournament) replays
REAL recorded TxLINE data, byte for byte the same payloads the live
feed served, through exactly the same normalization, folding, scoring,
and persistence pipeline as live mode; the only different code is the
clock that paces event delivery. Live mode (`?mode=live`) connects the
same build to the real SSE streams with no code changes. Every replay
is labelled REPLAY in the UI. Nothing in the demo is synthetic: the VAR
overturn you will see actually happened on 2026-07-09.

Judges: start at `/judges`.

## Known constraints

- Replay session clocks are in-memory per server instance; the
  deployment is pinned to one region and each browser tab carries a
  timeline anchor, so a refresh (or a request landing on a second
  instance) reconstructs the same match position. See
  `src/lib/sources/replay.ts` for the mechanism.
- The live source's mid-match join is verified against a genuinely
  in-play fixture (95 events through the normalization layer, zero parse
  failures; see `docs/verification/LIVE-VERIFY.md`). Coverage for some
  fixtures opens mid-match, so a goal scored before it exists in the
  score with no event row; the match report annotates that gap rather
  than inventing a scorer.
- Anonymous cookie identity with permissive RLS, a deliberate
  hackathon posture; tighten with real auth.

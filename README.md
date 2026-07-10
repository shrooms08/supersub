# Super Sub (Phase 1: the playable core loop)

You are the fantasy substitute. You watch a real World Cup match and you
have exactly one action: ENTER THE PITCH at a minute of your choosing.
From that instant until the final whistle, real match events become your
stat line. Come on while your side is cruising and you carry a 1.0x
multiplier; come on when it looks lost and you carry up to 10.0x.

Phase 0 was an API spike against TxLINE (see `../supersub-spike`,
`FINDINGS.md`); its findings drive the architecture here. Phase 1 is the
playable core loop and nothing else: no wallets, no career page, no auth
beyond an anonymous local identity.

## Quick start (replay mode, works offline against the bundled fixture)

```
npm install
# point .env.local at your Supabase project (see .env.example), then apply
# the migration in supabase/migrations/ via the dashboard SQL editor,
# supabase CLI ("supabase db push"), or any Postgres client
npm run dev
```

Open http://localhost:3000. The Bench lists France v Morocco (fixture
18209181, the real 2026-07-09 match, bundled under `data/replay/`). Tap
it: the replay session kicks off at `REPLAY_SPEED`x (default 30x). Pick
Morocco, enter the pitch, watch provisional points move, watch VAR erase
a Morocco goal at 49', and collect your resolved score at full time.

Useful query params on the match screen:

- `?speed=60` replay pace, 1 to 60 feed-seconds per wall second
- `?mode=live` force live mode for this request (env sets the default)

To restart a replay from kickoff, hit
`/api/stream/18209181?mode=replay&restart=1` once (curl or browser tab).

## Modes

`SUPERSUB_MODE` picks the default source; `?mode=` overrides per request.
The entire app runs identically against both sources; they implement one
internal interface (`src/lib/sources/types.ts`).

- **replay**: replays a finished fixture from the TxLINE historical
  endpoints as if live. France v Morocco ships in the repo so this works
  with no tokens. Any other fixture from the last ~2 weeks is fetched on
  demand (needs tokens) and cached under `.cache/replay/`.
- **live**: SSE streams from TxLINE (scores + odds), with join/reconnect
  state reconstruction via the per-action snapshot endpoint plus sealed
  5-minute interval backfill. Needs `TXLINE_JWT` and `TXLINE_API_TOKEN`
  (run the Phase 0 spike's `npm run auth` once and copy them from its
  `.tokens.json`).

## Architecture (the parts that follow from the spike findings)

- `src/lib/feed/normalize.ts` is the ONLY module that touches raw feed
  shapes. It tolerates PascalCase and camelCase key casing and encodes
  the feed's most dangerous quirk: inside Score/Stats maps an absent key
  means ZERO, not "unchanged".
- `src/lib/state/fold.ts` is event-sourced match state: score, counters,
  ticker, and phase are always a pure fold of the ordered event log.
  VAR rollback works because `action_discarded` erases by action id
  inside the fold; there are no incremental tallies anywhere.
- Match phase ignores the feed's `GameState` field entirely (observed
  stuck on "scheduled" for a whole finished match). Derivation and the
  finished heuristic are documented in the fold.
- `src/lib/state/winprob.ts` prefers the feed's own demargined `Pct`,
  falls back to normalized inverse 1X2 odds, and treats empty price
  arrays as "market suspended, hold last value".
- Scoring constants live in `src/lib/config/scoring.ts` and nowhere else.
  The same pure scoring function produces the client's provisional points
  and the server's resolution; resolution is computed ONLY from the final
  event-sourced state at the whistle.
- Supabase holds entries and their resolved results (`entries` table).
  One entry per user per fixture is a database unique constraint.

## Verification

- `npm run test:fold` folds the real 1116-event France v Morocco log and
  checks the 2-0 final, the VAR rollback at Seq 534/535, phase
  derivation, the probability jump across the 60' goal, and the scoring
  table (16 checks).
- `npm run smoke` drives the full loop over HTTP against a running dev
  server: fixtures, stream, enter (plus duplicate rejection), the VAR
  sequence, resolve, and idempotence. See `SMOKE.md` for a captured run.

## Deploy notes

Server code is all route handlers, deployable to Vercel as-is
(`next.config.mjs` traces `data/replay/` into the serverless bundle).
One caveat for hosted REPLAY demos: replay sessions live in module-global
memory, so on serverless each instance has its own virtual clock. Perfect
for `npm run dev` and single-instance demos; a shared clock (KV) is a
later-phase concern. LIVE mode has no such state and scales normally.

## Known gaps, on purpose (Phase 1 scope)

- The live source's snapshot+interval reconstruction was verified against
  a finished match and a pre-match fixture; verify against a genuinely
  in-play match before demo day (spike risk 4).
- Anonymous localStorage identity; permissive RLS policies to match.
- No shots/possession in scoring (feed has no cumulative counters for
  them; spike risk 7).

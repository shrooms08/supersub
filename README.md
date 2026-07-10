# Super Sub (Phases 1 and 2: the core loop, then the career)

You are the fantasy substitute. You watch a real World Cup match and you
have exactly one action: ENTER THE PITCH at a minute of your choosing.
From that instant until the final whistle, real match events become your
stat line. Come on while your side is cruising and you carry a 1.0x
multiplier; come on when it looks lost and you carry up to 10.0x.

Phase 0 was an API spike against TxLINE (see `../supersub-spike`,
`FINDINGS.md`); its findings drive the architecture here. Phase 1 built
the playable core loop. Phase 2 wraps identity, persistence, and
narrative around it: a created-once player (signed anonymous cookie, no
accounts), the Career page (`/career`) with Impact Rating, the record,
the badge cabinet, and match history, plus a stored match report per
resolved entry written by `claude-sonnet-4-6` (deterministic template
fallback when no API key is set). The match loop itself is untouched.

## Quick start (replay mode, works offline against bundled fixtures)

```
npm install
# point .env.local at your Supabase project (see .env.example), then apply
# the migrations in supabase/migrations/ in order via the dashboard SQL
# editor, supabase CLI ("supabase db push"), or any Postgres client
npm run dev
```

Open http://localhost:3000. Sign your forms (name, shirt number,
position; the crest is generated from a hash of name + number). The Bench
lists France v Morocco (18209181) and Switzerland v Colombia (18202783),
both real matches bundled under `data/replay/`. Tap one: the replay
session kicks off at `REPLAY_SPEED`x (default 30x). Pick a side, enter
the pitch, watch provisional points move (France v Morocco includes a
real VAR-erased goal at 49'), and collect your resolved score, badges,
and match report at full time. Your career lives at `/career`.

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
- Supabase holds players, entries with their resolved results and stored
  reports, and the badge cabinet (`players`, `entries`, `player_badges`).
  One entry per player per fixture is a database unique constraint.
- Identity (Phase 2): `src/lib/server/playerAuth.ts` signs the anonymous
  player id into an httpOnly cookie (HMAC, `SUPERSUB_SESSION_SECRET`).
- Career logic is pure and unit-tested: badges in
  `src/lib/career/badges.ts`, aggregates in `src/lib/career/stats.ts`,
  multiplier display tiers in `src/lib/config/scoring.ts`.
- Match reports: `src/lib/server/report.ts` builds structured facts from
  the resolved entry only, calls `claude-sonnet-4-6` via the official
  SDK, and falls back to a deterministic template on any failure. Stored
  once at resolution inside the same guarded update; never regenerated.

## Verification

- `npm run test:fold` folds the real 1116-event France v Morocco log and
  checks the 2-0 final, the VAR rollback at Seq 534/535, phase
  derivation, the probability jump across the 60' goal, and the scoring
  table (16 checks).
- `npm run smoke` drives the full loop over HTTP against a running dev
  server: fixtures, stream, enter (plus duplicate rejection), the VAR
  sequence, resolve, and idempotence. See `SMOKE.md` for a captured run.
- `npm run test:badges` unit-tests the badge cabinet against constructed
  resolved entries: 30 checks including the Miracle Worker boundary at
  p = 0.10, Iron Nerve at minute 85, Comeback King from-behind detection,
  and the multiplier tier boundaries.
- `npm run smoke:career` drives the Phase 2 fresh-user flow: create a
  player, play two replayed matches end to end, and verify badges, form,
  Impact Rating, stored reports, and the duplicate-player guard. See
  `SMOKE2.md` for a captured run including the server-restart
  persistence check and the LLM fallback proof.

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

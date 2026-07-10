# TxLINE API feedback

All observations were made on 2026-07-10 against `txline-dev.txodds.com`
(devnet entitlement) during a dedicated integration spike and the
subsequent build. Raw captured payloads backing each item are committed
in the spike repo's `samples/` directory; fixture 18209181 (France v
Morocco, 2026-07-09) is the reference match for most of them.

## What we hit, how we coped, what we would prefer

### 1. `GameState` reads "scheduled" for an entire finished match

Observed: every one of the 1116 score events for fixture 18209181,
from `kickoff` through `game_finalised`, carried
`GameState: "scheduled"`. On odds payloads the field was always null.

Workaround: we ignore the field entirely and derive match phase from
`StatusId` transitions (2 first half, 3 halftime, 4 second half, 5
full-time whistle, 100 finalised were observed) plus the status
actions, with a staleness heuristic as a backstop.

Preference: either populate `GameState` or remove it from the payloads
and document `StatusId` values as the phase source of truth. A stuck
field that looks authoritative is worse than no field; every
integrating team will burn time on it.

### 2. Historical scores return SSE framing where the spec says JSON,
and payload casing does not match the spec schema

Observed: `GET /api/scores/historical/{fixtureId}` is declared in the
OpenAPI spec as an `application/json` array, but actually returns
SSE-framed text (`data: {...}` lines). Additionally, score payloads
are PascalCase (`FixtureId`, `Clock`) while the spec's `Scores` schema
is camelCase; the interval and snapshot endpoints DO return JSON
arrays, also PascalCase. The activation endpoint is documented as
text/plain but returns JSON.

Workaround: a parser that accepts both framings, and a normalization
layer that reads every field in both casings. That layer is the only
code allowed to touch raw payloads.

Preference: make the spec match the wire. Any one of the three
mismatches costs an hour; together they undermine trust in the spec
for everything else.

### 3. Odds snapshot returns `[]` at 5-minute cache rollovers

Observed: `GET /api/odds/snapshot/{fixtureId}` returned 19 market
lines at 14:48, `[]` at 14:50 (fresh cache interval), and 9 lines on
retry, while the SSE stream delivered continuously throughout.

Workaround: snapshot is used only for cold start, with one delayed
retry and graceful tolerance of emptiness; the stream is the source of
truth from the first connected second.

Preference: serve the previous interval's cache until the new one is
warm, or document the rollover explicitly with a Retry-After header.
An empty 200 is indistinguishable from "no market exists".

### 4. Absent key means zero inside Score and Stats, which interacts
dangerously with VAR retractions

Observed: after the VAR erasure of Morocco's 48:44 goal (action id
495, `action_discarded`), later events carry
`Score.Participant2.Total` with NO `Goals` key at all. A consumer that
treats a missing key as "unchanged" carries the phantom goal forward
forever; our first replayer reported a wrong 2-1 final because of it.

Workaround: the normalization layer zero-fills all counters whenever a
participant's Score entry is present, and match state is an
event-sourced fold keyed by action id, so `action_discarded` erases
cleanly even before fresh totals arrive.

Preference: emit explicit zeroes for previously non-zero counters, or
state the absent-means-zero contract in bold in the docs. This is the
single most dangerous encoding decision in the feed; it produces
silently wrong scores precisely at the most dramatic moments.

## What worked well

- **The demargined `Pct` on the StablePrice book.** A consensus,
  margin-free probability straight from the feed, matching our own
  normalized inverse-odds computation to within price quantization.
  It removed an entire class of modelling work and lets our multiplier
  use the same number the market does.
- **In-play odds cadence.** Median 1.3s between full-time 1X2 updates
  in play (2,418 updates across one match). The win-probability curve
  moves within seconds of the pitch, which is the product.
- **The `asOf`/snapshot reconstruction path.** The per-action scores
  snapshot with cumulative Stats, verified at halftime, gives a
  correct mid-match baseline in one request, exactly what a
  late-joining client needs.
- **Sealed 5-minute intervals.** Deterministic, cacheable history for
  both scores and odds made replay bundles and reconnect backfill
  straightforward; 33 intervals reassembled a full match's 34,940 odds
  updates with zero failures.
- **Guest JWT self-renewal and the on-chain flow.** `guest/start` plus
  401-renew is simple and reliable, and the devnet subscribe/activate
  path worked first try with a funded wallet, including the free
  real-time devnet tier, which is a genuinely good developer
  experience for a paid API.

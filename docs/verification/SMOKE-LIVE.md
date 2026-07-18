# SMOKE-LIVE: live fixture polish (final pass)

Captured 2026-07-12 on branch `final-polish` (off match-detail).
Read-only: no scoring or schema, playability guard untouched (a live
fixture stays enterable, everything else still 409s). Verified against
the real Argentina v Switzerland fixture (18222446), in play during
capture.

## 1. Live fixture cards on the bench TODAY tab

A fixture in the live window now shows live state, not the kickoff time:
the derived match minute (or an HT / ET label) and the current score,
with the LIVE pulse kept. Upcoming cards keep the countdown; finished
keep the result.

The data comes from ONE shared, cached poll, not per-card streams:
`GET /api/live-scores?ids=...` returns current state per live fixture,
each computed from the per-action snapshot (one call, folded through the
existing pipeline) and cached server-side for 30s. The bench polls it
once per 40s for all its live fixture ids.

```
GET /api/live-scores?ids=18222446
-> { "18222446": { score:{p1:1,p2:0}, minute:65, label:null, live:true } }
```

Bench card (`bench-live-{mobile,desktop}.png`): ARGENTINA 66' 1-0
SWITZERLAND, LIVE chip, ENTER THE MATCH. Minute and score both render
and refresh from the poll.

## 2. Match report on live fixtures

`/match/[id]/report` now works for in-play fixtures. The existing
reconstruction path already fetches the log up to now, so it renders the
timeline SO FAR. The header shows the current score with a LIVE chip and
the current minute instead of FULL TIME, and a subtle line reads "This
is the story so far. It updates as the match unfolds; refresh for the
latest." No auto-refresh machinery. No entry paths, same as finished.

Cache: a live timeline is cached only 60s (vs 60 min for a finished,
immutable one), so a refresh a minute later shows new events.

```
GET /match/18222446/report -> 200
  header: ARGENTINA 1-0 SWITZERLAND, "LIVE . 65'"
  line:   "the story so far ... refresh for the latest"
  timeline so far: KICK OFF, 10' GOAL Mac Allister, 44' YELLOW Embolo, HALF TIME
  ENTER THE PITCH occurrences: 0     Full time occurrences: 0
```

Names resolve because the live feed carries a lineups roster (Mac
Allister, Embolo), the same resolution rule as finished reports.
Capture: `report-live-{mobile,desktop}.png`.

## 3. Full timeline link on the live match ticker

The live match screen's ticker header carries a small "FULL TIMELINE"
link to `/match/[id]/report` (see `ticker-link.png`: the link sits next
to the UPDATING indicator). Confirmed present once the live stream
backfills.

## Evidence and hygiene

- Screenshots at both widths in `scratchpad/fp-shots/`: `bench-live-*`,
  `report-live-*`, `ticker-link.png`.
- `tsc --noEmit` clean, `npm run build` clean (route `/api/live-scores`
  present). Suites: fold 30/30, badges 30/30, signing 35/35.
- Em-dash scan over new and changed files: clean.

## Files

- `src/lib/server/live-state.ts`, `src/app/api/live-scores/route.ts` (new)
- `src/components/FixtureCard.tsx` (live centre column), `src/app/page.tsx`
  (shared 40s poll)
- `src/lib/server/match-timeline.ts` (live flag, 60s live TTL),
  `src/components/MatchReport.tsx` (LIVE header + line)
- `src/components/EventTicker.tsx` (FULL TIMELINE link)

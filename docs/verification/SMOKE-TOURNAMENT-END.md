# SMOKE-TOURNAMENT-END - End-of-tournament bench state

Feature branch `tournament-end` off main. Docs/UI only. No scoring change,
no DB schema change.

When the World Cup is over - the schedule has loaded and there is nothing
live/today and nothing upcoming - the bench shows a designed end-of-tournament
card in place of the empty TODAY and UPCOMING tabs. The tabs stay; RESULTS
still works.

## What changed

```
 M src/app/page.tsx              EndOfTournament card + render gating
 M src/app/api/matchday/route.ts playerCount added to the payload
```

The only non-UI change is an additive `playerCount` on the matchday API
response, taken from the **existing** players query (`players.length`). It is
not a scoring path and not a database change; the count has to be real, and
the leaderboard `table` is capped at 15, so the true total needed its own
field. Zero changes under `src/lib/state`, `src/lib/config`, `supabase/`.

## The gate

```ts
const tournamentOver = Boolean(sched) && today.length === 0 && upcomingCount === 0;
```

The card renders only when the schedule has loaded and BOTH TODAY and UPCOMING
are genuinely empty (and the matchday payload is loaded, so the count is
real). It stands in for the empty state of each tab. Because the flag is a
pure function of the live schedule - refetched every 30s - **the moment any
fixture returns to today or upcoming, `tournamentOver` is false and the card
is gone**, replaced by the normal fixtures/empty states.

Confirmed against the live feed: `/api/schedule` reports `today 0, upcoming
0`, and `/api/matchday` reports `playerCount 16` while `table` holds 15 rows -
so the card's count comes from the real total, not the capped table.

## The copy (verbatim), with a real count

> **FULL TIME ON THE TOURNAMENT**
> The World Cup is done. Spain lifted it, and **[N]** careers were written
> along the way.
> The archive is still open: replay a real match, walk the bracket, or read
> back through the results.
> Super Sub is fixture-agnostic. Wherever the next tournament is, we'll be on
> the bench.

`[N]` is `matchday.playerCount` (rendered **17** in the captures, after a test
player was signed on top of the 16 already there). No future competition is
named - "wherever the next tournament is" makes no league promise.

## Three ways back into the archive

The card carries three actions, matching the middle line of the copy:

- **Replay a match** -> `/judges`
- **Walk the bracket** -> `/bracket`
- **Read the results** -> switches to the RESULTS tab (`selectTab("results")`)

Verified by interaction: clicking **Read the results** removes the card and
shows the results day-headers (the RESULTS tab renders normally).

## Both widths, brand voice

- `docs/smoke/tournament-end-desktop.png` (1280): the card in the fixtures
  column, volt eyebrow, broadcast copy, three actions in a row. Tabs still
  present (TODAY 0 / RESULTS 106 / UPCOMING 0).
- `docs/smoke/tournament-end-mobile.png` (390): full-width card, the three
  actions stacked. Same on the UPCOMING tab (captured desktop too).

Brand system: near-black panel, volt eyebrow and focus rings, chalk body,
the emphasised count in chalk-50. Broadcast voice throughout.

## Suites, scan

```
npm run test:fold      All fold checks passed.
npm run test:badges    All badge checks passed.
npm run test:signing   All signing checks passed.
npx tsc --noEmit       clean
npm run build          compiled
```

Em-dash scan on the changed source and this doc: clean.

## Cleanup

The `FULLTIME` test player signed to view the board (no entries) was deleted
via the service-role admin path.

---

Report for review. Not merged to main, not deployed.

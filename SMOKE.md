# SMOKE: proof of the Phase 1 definition of done

All runs below were executed on 2026-07-10 against this working tree, with
`.env.local` pointing at the Supabase project `supersub`
(huzrtjdtmwmvhudakelp) and the Phase 0 spike's devnet TxLINE tokens.
Screenshots are in `docs/smoke/`.

## 0. Setup from clean state

```
npm install                      # (exit 0)
# supabase/migrations/0001_super_sub.sql applied to the project
#   (creates public.entries with the unique one-entry-per-user-per-fixture
#    constraint and permissive RLS; idempotent: create table if not exists,
#    drop policy if exists)
npm run dev                      # Next.js 14.2.x on http://localhost:3000
```

## 1. Event-sourced fold verified against the real match log

`npm run test:fold` folds the bundled 1116-event France v Morocco log
(raw PascalCase payloads, exactly as captured by the spike) through the
normalization layer and the fold. Output:

```
PASS  final score 2-0  (folded 2-0)
PASS  final phase finished  (finished by game_finalised)
PASS  Morocco goal stands at Seq 534  (folded 0-1)
PASS  VAR erases it at Seq 535  (folded 0-0)
PASS  discarded goal visible for the UI  (id 495 discarded=true)
PASS  pre-kickoff phase upcoming  (upcoming)
PASS  mid-match phase live  (live)
PASS  prob series non-empty  (2418 ticks)
PASS  P(France) jumps across the 60' goal  (before 52.3%, after 87.3%)
PASS  suspended ticks held  (14 suspended ticks)
PASS  Morocco entry: two conceded, no bonuses  (window -10, items goal_overturned,goal_conceded,goal_conceded)
PASS  Morocco final floored at zero  (max(0, -10) x 9.19)
PASS  France entry: 2 goals + clean sheet + win = 34  (window 34)
info  France entry at 40': P(win) 62.4%, multiplier 2.62x, final 89
PASS  multiplier at p=0.75 is 1.0  ()
PASS  multiplier at p=0.05 is 10.0  ()
PASS  multiplier midpoint linear  (5.5)

All fold checks passed.
```

## 2. Full loop over HTTP: replay, enter as Morocco, VAR, resolve, persist

`npm run smoke` (equals `node scripts/smoke-replay.mjs http://localhost:3000 60`)
drives the exact DoD scenario through the public API, as the browser
would. Captured output:

```
[smoke] fixtures ok: France v Morocco, phase upcoming, mode replay
[smoke] stream connected (speed 60x)
[smoke] meta: mode=replay speed=60 fixture=France v Morocco
[smoke] backfill: 17 events, 43 odds ticks
[smoke] kickoff at feed ts 1783627253119
[smoke] ENTERED THE PITCH for Morocco at minute 5 (P(win) 15.3%, multiplier 8.68x, id 4ea55c62-99f1-4bec-b443-63da181559c9)
[smoke] duplicate entry attempt -> HTTP 409 (expected 409)
[smoke] goal event: id=495 participant=2 confirmed=false clock=2924s
[smoke] VAR: action_discarded for goal id 495 (the Morocco goal is overturned)
[smoke] goal event: id=683 participant=1 confirmed=false clock=3560s
[smoke] goal event: id=683 participant=1 confirmed=true clock=3560s
[smoke] goal event: id=683 participant=1 confirmed=true clock=3560s
[smoke] goal event: id=729 participant=1 confirmed=false clock=3922s
[smoke] goal event: id=729 participant=1 confirmed=true clock=3922s
[smoke] goal event: id=729 participant=1 confirmed=true clock=3922s
[smoke] game_finalised received
[smoke] stream summary: 7 goal events, 2375 live odds ticks, last odds ts 1783633419771
[smoke] RESOLVED:
[smoke]   final score (your side first): 0-2
[smoke]   window points: -10
[smoke]   multiplier: 8.68x
[smoke]   final points: 0
[smoke]   breakdown: [
  { "type": "goal_overturned", "label": "VAR: goal overturned 49'", "minute": 49, "points": 0 },
  { "type": "goal_conceded",   "label": "Goal conceded 60'",        "minute": 60, "points": -5 },
  { "type": "goal_conceded",   "label": "Goal conceded 66'",        "minute": 66, "points": -5 }
]
[smoke]   persisted row id: 4ea55c62-99f1-4bec-b443-63da181559c9, resolved_at: 2026-07-10T16:03:15.881+00:00
[smoke] resolve is idempotent (second call returned the same settled row)
[smoke] ALL SMOKE CHECKS PASSED (user smoke-1783699266652)
```

Persistence cross-checked directly in Supabase:

```sql
select user_id, team_name, entry_minute, multiplier, window_points,
       final_points, final_score_team, final_score_opp,
       resolved_at is not null as resolved
from public.entries order by created_at desc limit 1;
-- smoke-1783699266652 | Morocco | 5 | 8.68 | -10 | 0 | 0 | 2 | true
```

## 3. The same flow in the browser (screenshots)

Captured with a headless Chromium driving a fresh 60x replay session,
mobile viewport 390px plus one desktop 1280px shot:

1. `docs/smoke/01-bench-mobile.png` - the Bench with the France v Morocco
   replay card and phase badge.
2. `docs/smoke/02-match-pre-entry-mobile.png` - scoreboard, live win
   probability curve, team picker, armed ENTER THE PITCH with the
   multiplier on offer.
3. `docs/smoke/03-on-the-pitch-mobile.png` - after entering as Morocco:
   entry marker pinned on the curve ("ON 13'"), locked 9.0x multiplier,
   provisional points ticking, clean sheet line live.
4. `docs/smoke/04-match-desktop.png` - the same screen holding up at
   desktop width.
5. `docs/smoke/05-var-overturned-mobile.png` - the 49' Morocco goal
   erased: "VAR: OVERTURNED" takeover, the goal struck through in the
   breakdown at 0 points and in the ticker, score correctly back to 0-0.
6. `docs/smoke/06-full-time-resolution-mobile.png` - FULL TIME takeover:
   final points hero number, max(0, -10) x 9.0x arithmetic, full
   breakdown, persisted result.

## 4. LIVE mode, same build, no code changes

With the dev server still running in replay-default mode, `?mode=live`
switches the source per request (env `SUPERSUB_MODE=live` does it
globally):

```
$ curl -s "http://localhost:3000/api/fixtures?mode=live" | head -c 300
{"mode":"live","fixtures":[{"fixture":{"fixtureId":18218149,...,
 "participant1":"Spain","participant2":"Belgium",...},"phase":"upcoming",...

$ curl -s -N --max-time 40 "http://localhost:3000/api/stream/18218149?mode=live" | <count events>
META: {"mode":"live","speed":1,"fixture":{"fixtureId":18218149,..."participant1":"Spain","participant2":"Belgium"...
BACKFILL: 2 events, 1 odds ticks
live counts: odds=3 match=0 clock=38
```

That is the real TxLINE SSE odds stream flowing through the same
normalization layer and the same wire protocol (Spain v Belgium was 3
hours from kickoff at capture time, hence a quiet pre-match market, no
score events, and heartbeat clocks every second). No score-event latency
could be measured because no World Cup fixture was in play during the
run; the spike's finding (sub-second transport latency on the same SSE
host) stands. Re-verify the in-play join path against a genuinely live
match before demo day, per spike risk 4.

## 5. Build health

```
npx tsc --noEmit          # exit 0
npm run build             # Compiled successfully; / static, /match/[fixtureId]
                          # and all /api/* dynamic
```

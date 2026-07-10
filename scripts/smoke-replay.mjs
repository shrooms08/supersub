// End-to-end smoke: drives the full playable loop over HTTP against a
// running dev server, exactly as the browser would.
//
//   node scripts/smoke-replay.mjs [baseUrl] [speed]
//
// 1. Lists fixtures, expects the bundled France v Morocco replay.
// 2. Opens the app's SSE stream at the given speed with a fresh session.
// 3. After kickoff, enters the pitch for Morocco (team 2) via POST
//    /api/enter, like the DoD scenario.
// 4. Watches the stream for the VAR sequence (goal id 495 then its
//    action_discarded) and for game_finalised.
// 5. Resolves via POST /api/resolve and prints the persisted row.

const BASE = process.argv[2] ?? "http://localhost:3000";
const SPEED = process.argv[3] ?? "60";
const USER = `smoke-${Date.now()}`;
const FIXTURE = 18209181;

const log = (msg) => console.log(`[smoke] ${msg}`);

async function main() {
  // 1. Fixtures
  const fx = await (await fetch(`${BASE}/api/fixtures?mode=replay`)).json();
  const listing = fx.fixtures.find((f) => f.fixture.fixtureId === FIXTURE);
  if (!listing) throw new Error("France v Morocco not in /api/fixtures");
  log(`fixtures ok: ${listing.fixture.participant1} v ${listing.fixture.participant2}, phase ${listing.phase}, mode ${fx.mode}`);

  // 2. Stream
  const res = await fetch(`${BASE}/api/stream/${FIXTURE}?mode=replay&speed=${SPEED}&restart=1`, {
    headers: { Accept: "text/event-stream" },
  });
  if (!res.ok) throw new Error(`stream HTTP ${res.status}`);
  log(`stream connected (speed ${SPEED}x)`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines = [];

  let feedNow = 0;
  let kickoffSeen = false;
  let entered = false;
  let entry = null;
  let goalCount = 0;
  let varGoalSeen = false;
  let varDiscardSeen = false;
  let finished = false;
  let lastOddsTs = 0;
  let oddsCount = 0;
  let backfillCounts = null;

  const enter = async () => {
    const r = await fetch(`${BASE}/api/enter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER, fixtureId: FIXTURE, team: 2, mode: "replay", speed: Number(SPEED), feedTs: feedNow }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(`enter failed: HTTP ${r.status} ${JSON.stringify(body)}`);
    entry = body.entry;
    log(
      `ENTERED THE PITCH for ${entry.team_name} at minute ${entry.entry_minute} ` +
      `(P(win) ${(100 * entry.win_prob_at_entry).toFixed(1)}%, multiplier ${entry.multiplier.toFixed(2)}x, id ${entry.id})`
    );
    // Second entry must be rejected by the database constraint.
    const dup = await fetch(`${BASE}/api/enter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER, fixtureId: FIXTURE, team: 1, mode: "replay", speed: Number(SPEED), feedTs: feedNow }),
    });
    log(`duplicate entry attempt -> HTTP ${dup.status} (expected 409)`);
    if (dup.status !== 409) throw new Error("duplicate entry was not rejected");
  };

  const handle = async (name, data) => {
    if (name === "meta") {
      const m = JSON.parse(data);
      log(`meta: mode=${m.mode} speed=${m.speed} fixture=${m.fixture.participant1} v ${m.fixture.participant2}`);
    } else if (name === "backfill") {
      const b = JSON.parse(data);
      backfillCounts = { events: b.events.length, odds: b.odds.length };
      log(`backfill: ${b.events.length} events, ${b.odds.length} odds ticks`);
    } else if (name === "clock") {
      feedNow = JSON.parse(data).feedNow;
    } else if (name === "odds") {
      const o = JSON.parse(data);
      oddsCount++;
      lastOddsTs = o.ts;
    } else if (name === "match") {
      const e = JSON.parse(data);
      if (e.action === "kickoff" && !kickoffSeen) {
        kickoffSeen = true;
        log(`kickoff at feed ts ${e.ts}`);
      }
      if (e.action === "goal") {
        goalCount++;
        log(`goal event: id=${e.id} participant=${e.participant} confirmed=${e.confirmed} clock=${e.clock?.seconds}s`);
        if (e.id === 495) varGoalSeen = true;
      }
      if (e.action === "action_discarded" && e.id === 495) {
        varDiscardSeen = true;
        log("VAR: action_discarded for goal id 495 (the Morocco goal is overturned)");
      }
      if (e.action === "game_finalised") {
        finished = true;
        log("game_finalised received");
      }
      // Enter shortly after kickoff, once the market is there.
      if (kickoffSeen && !entered && e.clock?.seconds >= 300 && oddsCount + (backfillCounts?.odds ?? 0) > 0) {
        entered = true;
        await enter();
      }
    }
  };

  const deadline = Date.now() + 15 * 60_000;
  outer: for (;;) {
    if (Date.now() > deadline) throw new Error("smoke timed out");
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line === "") {
        if (dataLines.length > 0) await handle(eventName, dataLines.join("\n"));
        eventName = "";
        dataLines = [];
        if (finished) break outer;
      } else if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
  }
  reader.cancel().catch(() => {});

  log(`stream summary: ${goalCount} goal events, ${oddsCount} live odds ticks, last odds ts ${lastOddsTs}`);
  if (!varGoalSeen || !varDiscardSeen) throw new Error("VAR sequence not observed on the stream");

  // 5. Resolve
  const rr = await fetch(`${BASE}/api/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: USER, fixtureId: FIXTURE, mode: "replay" }),
  });
  const rbody = await rr.json();
  if (!rr.ok) throw new Error(`resolve failed: HTTP ${rr.status} ${JSON.stringify(rbody)}`);
  const resolved = rbody.entry;
  log("RESOLVED:");
  log(`  final score (your side first): ${resolved.final_score_team}-${resolved.final_score_opp}`);
  log(`  window points: ${resolved.window_points}`);
  log(`  multiplier: ${resolved.multiplier.toFixed(2)}x`);
  log(`  final points: ${resolved.final_points}`);
  log(`  breakdown: ${JSON.stringify(resolved.breakdown, null, 2)}`);
  log(`  persisted row id: ${resolved.id}, resolved_at: ${resolved.resolved_at}`);

  // Idempotence
  const again = await fetch(`${BASE}/api/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: USER, fixtureId: FIXTURE, mode: "replay" }),
  });
  const againBody = await again.json();
  if (againBody.entry.final_points !== resolved.final_points) throw new Error("resolve not idempotent");
  log("resolve is idempotent (second call returned the same settled row)");

  log(`ALL SMOKE CHECKS PASSED (user ${USER})`);
}

main().catch((err) => {
  console.error(`[smoke] FAILED: ${err.message}`);
  process.exit(1);
});

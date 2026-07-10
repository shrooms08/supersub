// Phase 3 production smoke: the full loop against a DEPLOYED instance,
// exercising the anchor mechanism the browser uses (on serverless, the
// stream, enter, and resolve calls land on different function instances;
// the per-tab anchor is what keeps their clocks identical).
//
//   node scripts/smoke-prod.mjs https://supersub-tau.vercel.app [speed]
//
// Creates a throwaway player, plays France v Morocco as Morocco at the
// given speed with a fresh anchor, verifies the VAR sequence on the wire,
// resolves, and prints the persisted entry, career, and report_source.

const BASE = process.argv[2] ?? "http://localhost:3000";
const SPEED = process.argv[3] ?? "60";
const FIXTURE = 18209181;
const ANCHOR = Date.now();

const log = (m) => console.log(`[smoke3] ${m}`);
let cookie = "";

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let body = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response
  }
  return { status: res.status, body };
}

async function main() {
  // Cold anonymous checks
  for (const path of ["/judges", "/", "/career"]) {
    const res = await fetch(`${BASE}${path}`);
    log(`GET ${path} -> HTTP ${res.status}`);
    if (!res.ok) throw new Error(`${path} not serving`);
  }
  const fx = await api("/api/fixtures?mode=replay");
  log(`fixtures: ${fx.body.fixtures.map((f) => `${f.fixture.participant1} v ${f.fixture.participant2}`).join(" | ")}`);

  // Player
  const created = await api("/api/player", {
    method: "POST",
    body: JSON.stringify({ name: `Prod Check ${String(ANCHOR).slice(-4)}`, position: "ST", shirtNumber: 99 }),
  });
  if (created.status !== 200 && created.status !== 201) {
    throw new Error(`player create failed: HTTP ${created.status} ${JSON.stringify(created.body)}`);
  }
  log(`player created: ${created.body.player.name} (cookie captured)`);

  // Stream with anchor
  const res = await fetch(
    `${BASE}/api/stream/${FIXTURE}?mode=replay&speed=${SPEED}&anchor=${ANCHOR}`,
    { headers: { Accept: "text/event-stream" } }
  );
  if (!res.ok) throw new Error(`stream HTTP ${res.status}`);
  log(`stream connected with anchor ${ANCHOR} (speed ${SPEED}x)`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines = [];
  let feedNow = 0;
  let entered = false;
  let varGoal = false;
  let varDiscard = false;
  let finished = false;
  let reconnects = 0;

  const enter = async () => {
    const r = await api("/api/enter", {
      method: "POST",
      body: JSON.stringify({
        fixtureId: FIXTURE,
        team: 2,
        mode: "replay",
        speed: Number(SPEED),
        feedTs: feedNow,
        anchor: ANCHOR,
      }),
    });
    if (r.status !== 200) throw new Error(`enter failed: HTTP ${r.status} ${JSON.stringify(r.body)}`);
    const e = r.body.entry;
    log(
      `ENTERED for ${e.team_name} at ${e.entry_minute}' (P ${(100 * e.win_prob_at_entry).toFixed(1)}%, ${e.multiplier.toFixed(2)}x) via a separate function invocation`
    );
  };

  const handle = async (name, data) => {
    if (name === "clock") feedNow = JSON.parse(data).feedNow;
    else if (name === "match") {
      const e = JSON.parse(data);
      if (!entered && e.action === "kickoff") log(`kickoff on the wire`);
      if (e.action === "goal" && e.id === 495) varGoal = true;
      if (e.action === "action_discarded" && e.id === 495) {
        varDiscard = true;
        log("VAR sequence observed on the production stream (goal id 495 discarded)");
      }
      if (e.action === "game_finalised") finished = true;
      if (!entered && e.clock?.seconds >= 300) {
        entered = true;
        await enter();
      }
    }
  };

  // Read across function recycles: EventSource semantics by hand.
  const deadline = Date.now() + 20 * 60_000;
  while (!finished && Date.now() < deadline) {
    try {
      const { done, value } = await reader.read();
      if (done) throw new Error("stream closed");
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (line === "") {
          if (dataLines.length > 0) await handle(eventName, dataLines.join("\n"));
          eventName = "";
          dataLines = [];
        } else if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
    } catch {
      if (finished) break;
      reconnects++;
      log(`stream recycled; reconnecting with the same anchor (${reconnects})`);
      const r2 = await fetch(
        `${BASE}/api/stream/${FIXTURE}?mode=replay&speed=${SPEED}&anchor=${ANCHOR}`,
        { headers: { Accept: "text/event-stream" } }
      );
      if (!r2.ok) throw new Error(`reconnect HTTP ${r2.status}`);
      Object.assign(reader, r2.body.getReader());
      break;
    }
  }
  reader.cancel?.().catch(() => {});
  if (!varGoal || !varDiscard) throw new Error("VAR sequence not observed");
  if (!finished) throw new Error("did not reach game_finalised");

  // Resolve (separate invocation again)
  let resolved = null;
  for (let i = 0; i < 5 && !resolved; i++) {
    const r = await api("/api/resolve", {
      method: "POST",
      body: JSON.stringify({ fixtureId: FIXTURE, mode: "replay", anchor: ANCHOR, speed: Number(SPEED) }),
    });
    if (r.status === 200 && r.body.entry?.resolved_at) resolved = r.body.entry;
    else await new Promise((s) => setTimeout(s, 4000));
  }
  if (!resolved) throw new Error("resolution did not settle");
  log(`RESOLVED on production: ${resolved.final_score_team}-${resolved.final_score_opp}, window ${resolved.window_points}, final ${resolved.final_points}`);
  log(`report_source: ${resolved.report_source}`);
  log(`report: ${resolved.report}`);

  const career = await api("/api/career");
  log(
    `career: appearances ${career.body.record.appearances}, impact ${career.body.record.impactRating}, badges ${career.body.badges.filter((b) => b.earnedAt).map((b) => b.key).join(",")}`
  );
  log(`ALL PRODUCTION CHECKS PASSED (player ${created.body.player.id})`);
}

main().catch((err) => {
  console.error(`[smoke3] FAILED: ${err.message}`);
  process.exit(1);
});

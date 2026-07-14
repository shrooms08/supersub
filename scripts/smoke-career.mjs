// Phase 2 end-to-end smoke: the fresh-user career flow over HTTP, driven
// exactly as the browser would (signed cookie included).
//
//   node scripts/smoke-career.mjs [baseUrl] [speed]
//
// 1. Creates a player (first-run flow), checks the duplicate guard.
// 2. Plays France v Morocco (18209181) end to end as Morocco: enter,
//    watch the stream to the whistle, resolve. Expects First Whistle,
//    a stored match report, and a populated Impact Rating.
// 3. Plays Switzerland v Colombia (18202783) as Switzerland. Expects
//    appearances, form, and rating to update.
// 4. Prints the career payload for verification and the report copy
//    (with an em dash scan), and reports which report_source was stored.
//
// The server restart persistence check is done by the caller (SMOKE2.md):
// run this, restart the dev server, then GET /api/career with the cookie
// this script prints.

const BASE = process.argv[2] ?? "http://localhost:3000";
const SPEED = process.argv[3] ?? "60";

const log = (m) => console.log(`[smoke2] ${m}`);
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

async function playMatch(fixtureId, team, label) {
  log(`--- ${label}: replaying fixture ${fixtureId} at ${SPEED}x, entering as team ${team} ---`);
  const res = await fetch(`${BASE}/api/stream/${fixtureId}?mode=replay&speed=${SPEED}&restart=1`, {
    headers: { Accept: "text/event-stream" },
  });
  if (!res.ok) throw new Error(`stream HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines = [];
  let feedNow = 0;
  let kickoffSeen = false;
  let entered = false;
  let entry = null;
  let finished = false;

  const enter = async () => {
    const r = await api("/api/enter", {
      method: "POST",
      body: JSON.stringify({ fixtureId, team, mode: "replay", speed: Number(SPEED), feedTs: feedNow }),
    });
    if (r.status !== 200) throw new Error(`enter failed: HTTP ${r.status} ${JSON.stringify(r.body)}`);
    entry = r.body.entry;
    log(
      `entered as ${entry.team_name} at minute ${entry.entry_minute}: P(win) ${(100 * entry.win_prob_at_entry).toFixed(1)}%, ${entry.multiplier.toFixed(2)}x`
    );
  };

  const deadline = Date.now() + 12 * 60_000;
  outer: for (;;) {
    if (Date.now() > deadline) throw new Error("match smoke timed out");
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line === "") {
        if (dataLines.length > 0) {
          const data = dataLines.join("\n");
          if (eventName === "clock") feedNow = JSON.parse(data).feedNow;
          else if (eventName === "match") {
            const e = JSON.parse(data);
            if (e.action === "kickoff") kickoffSeen = true;
            if (e.action === "game_finalised") {
              finished = true;
            }
            if (kickoffSeen && !entered && e.clock?.seconds >= 300) {
              entered = true;
              await enter();
            }
          }
        }
        eventName = "";
        dataLines = [];
        if (finished) break outer;
      } else if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
  }
  reader.cancel().catch(() => {});
  if (!entry) throw new Error("never entered the pitch");

  const rr = await api("/api/resolve", {
    method: "POST",
    body: JSON.stringify({ fixtureId, mode: "replay" }),
  });
  if (rr.status !== 200) throw new Error(`resolve failed: HTTP ${rr.status} ${JSON.stringify(rr.body)}`);
  const resolved = rr.body.entry;
  log(
    `resolved: final ${resolved.final_score_team}-${resolved.final_score_opp}, window ${resolved.window_points}, final points ${resolved.final_points}, new badges [${(rr.body.newBadges ?? []).join(", ")}]`
  );
  log(`report_source: ${resolved.report_source}`);
  log(`report: ${resolved.report}`);
  if (!resolved.report || resolved.report.length < 40) throw new Error("no report stored");
  if (/—|–/.test(resolved.report)) throw new Error("report contains an em or en dash");
  return { resolved, newBadges: rr.body.newBadges ?? [] };
}

async function main() {
  // 1. First-run flow
  // Surname rule (design phase 2): 2-12 chars, A-Z plus hyphen. Encode the
  // timestamp as letters so each run stays unique and rule-conforming.
  const name = `SMOKE-${String(Date.now()).slice(-5).replace(/\d/g, (d) => "ABCDEFGHIJ"[Number(d)])}`;
  const created = await api("/api/player", {
    method: "POST",
    body: JSON.stringify({ name, position: "ST", shirtNumber: 14 }),
  });
  if (created.status !== 201) throw new Error(`player create failed: ${JSON.stringify(created.body)}`);
  log(`player created: ${created.body.player.name} #${created.body.player.shirt_number} (${created.body.player.position}), id ${created.body.player.id}`);
  log(`cookie: ${cookie}`);

  const dup = await api("/api/player", {
    method: "POST",
    body: JSON.stringify({ name: "SOMEONE", position: "CB", shirtNumber: 5 }),
  });
  log(`second create attempt -> HTTP ${dup.status} (expected 409)`);
  if (dup.status !== 409) throw new Error("duplicate player was not rejected");

  // Entry without... actually with cookie but before any entry: career should be empty
  const career0 = await api("/api/career");
  if (career0.body.record.appearances !== 0) throw new Error("fresh career not empty");
  log(`fresh career: 0 appearances, ${career0.body.badges.filter((b) => b.earnedAt).length} badges earned`);

  // NOTE: fixtures 18209181 and 18202783 are bundled replays, so their
  // entries are EXHIBITIONS: the full loop runs (enter, resolve, report),
  // First Whistle can be earned on the debut, but they never touch a
  // competitive number. This smoke asserts exactly that.

  // 2. Match one: France v Morocco as Morocco (exhibition)
  const m1 = await playMatch(18209181, 2, "match one");
  if (!m1.newBadges.includes("first_whistle")) throw new Error("First Whistle not earned on debut");
  if (m1.resolved.exhibition !== true) throw new Error("replay entry should be flagged exhibition");

  const career1 = await api("/api/career");
  const r1 = career1.body.record;
  log(
    `career after match one: apps ${r1.appearances}, impact ${r1.impactRating}, total ${r1.totalPoints}, form [${r1.form.join("")}] (exhibition, so all competitive numbers stay empty)`
  );
  if (r1.appearances !== 0) throw new Error("exhibition entry must NOT count as a competitive appearance");
  if (r1.impactRating !== null) throw new Error("exhibition entry must not move Impact Rating");
  if (career1.body.history.length !== 1 || career1.body.history[0].exhibition !== true) {
    throw new Error("the exhibition entry must appear in history, tagged");
  }

  // 3. Match two: Switzerland v Colombia as Switzerland (exhibition)
  const m2 = await playMatch(18202783, 1, "match two");

  const career2 = await api("/api/career");
  const r2 = career2.body.record;
  log(
    `career after match two: apps ${r2.appearances}, impact ${r2.impactRating}, total ${r2.totalPoints}, form [${r2.form.join("")}]`
  );
  if (r2.appearances !== 0) throw new Error("two exhibitions still count as zero competitive appearances");
  if (r2.form.length !== 0) throw new Error("exhibition results must not fill form");

  const earned = career2.body.badges.filter((b) => b.earnedAt).map((b) => b.key);
  if (earned.length !== 1 || earned[0] !== "first_whistle") {
    throw new Error(`exhibitions should earn only First Whistle, got [${earned.join(", ")}]`);
  }
  log(`cabinet: earned [${earned.join(", ")}] (First Whistle only, from the exhibition debut)`);
  log(`history rows: ${career2.body.history.length}, all exhibition: ${career2.body.history.every((h) => h.exhibition === true)}, each with report: ${career2.body.history.every((h) => !!h.report)}`);

  log("ALL PHASE 2 SMOKE CHECKS PASSED");
  log(`persistence check: restart the server, then run`);
  log(`  curl -s ${BASE}/api/career -H 'Cookie: ${cookie}'`);
}

main().catch((err) => {
  console.error(`[smoke2] FAILED: ${err.message}`);
  process.exit(1);
});

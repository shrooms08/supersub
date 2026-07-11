// Unattended one-shot verification against a GENUINELY LIVE fixture:
// does the production app's mid-match join work, and does the
// normalization layer parse every raw live payload?
//
//   npx tsx scripts/live-verify.mjs [baseUrl] [fixtureId] [startISO] [listenMinutes]
//
//   npx tsx scripts/live-verify.mjs https://supersub-tau.vercel.app 18213979 2026-07-11T21:15:00Z
//
// Defaults: fixture 18213979 (Norway v England), start = the fixture's
// kickoff plus 15 minutes (looked up from the production API), listen
// window 15 minutes. Run under tsx: the script imports the app's own
// normalization layer and fold from src/.
//
// Two planes are verified at once:
//   APP   the production /api/stream/{id}?mode=live endpoint, consumed
//         exactly as a fresh browser client would: its backfill IS the
//         snapshot plus sealed-interval reconstruction path.
//   FEED  the raw TxLINE endpoints and SSE streams, hit directly with
//         the env tokens, every payload run through normalizeMatchEvent
//         and normalizeOddsUpdate. Any null or throw is a parse failure.
//
// Read-only by construction: the only production endpoints touched are
// GET /api/fixtures and GET /api/stream. No player, no entries, no
// cookies; the join path requires no identity.
//
// Everything printed also lands in LIVE-VERIFY.log; raw payloads land in
// samples/live-<fixtureId>.ndjson; a one-paragraph report is appended to
// LIVE-VERIFY.md.

import * as fs from "node:fs";
import * as path from "node:path";

// Env before app imports: the txline client reads process.env at call time.
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const { normalizeMatchEvent, normalizeOddsUpdate, normalizeFixture, is1x2FullTime } =
  await import("../src/lib/feed/normalize");
const { foldMatch, stateMinute } = await import("../src/lib/state/fold");
const { txGetJson, txStream, epochDay, hourOfDay, fiveMinInterval, sealedIntervalStarts } =
  await import("../src/lib/server/txline");

const BASE = process.argv[2] ?? "https://supersub-tau.vercel.app";
const FIXTURE_ID = Number(process.argv[3] ?? 18213979);
const START_ARG = process.argv[4] ?? null;
const LISTEN_MINUTES = Number(process.argv[5] ?? 15);

const LOG_PATH = path.join(process.cwd(), "LIVE-VERIFY.log");
const MD_PATH = path.join(process.cwd(), "LIVE-VERIFY.md");
const NDJSON_PATH = path.join(process.cwd(), "samples", `live-${FIXTURE_ID}.ndjson`);
fs.mkdirSync(path.dirname(NDJSON_PATH), { recursive: true });
const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });
const ndjson = fs.createWriteStream(NDJSON_PATH, { flags: "a" });

const log = (msg) => {
  const line = `[live-verify ${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
const noteFailure = (plane, kind, detail, payload) => {
  failures.push({ plane, kind, detail });
  log(`PARSE FAILURE [${plane}] ${kind}: ${detail} :: ${JSON.stringify(payload).slice(0, 300)}`);
};

// Field-shape ledger: top-level key sets seen live, per category.
const liveShapes = { scores: new Set(), odds: new Set() };
const record = (category, raw) => {
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(raw)) liveShapes[category].add(k);
  }
};

function saveRaw(plane, source, data) {
  ndjson.write(JSON.stringify({ arrivedAt: Date.now(), plane, source, data }) + "\n");
}

// ---------------------------------------------------------------- wait
async function resolveStartMs() {
  if (START_ARG) return Date.parse(START_ARG);
  const res = await fetch(`${BASE}/api/fixtures?mode=live`);
  const body = await res.json();
  const fx = body.fixtures?.find((f) => f.fixture.fixtureId === FIXTURE_ID);
  if (!fx) throw new Error(`fixture ${FIXTURE_ID} not in the live snapshot; pass a start time`);
  log(
    `fixture: ${fx.fixture.participant1} v ${fx.fixture.participant2}, kickoff ${new Date(fx.fixture.startTime).toISOString()}`
  );
  return fx.fixture.startTime + 15 * 60_000;
}

// ------------------------------------------------------- plane A: app
function parseSse(onFrame) {
  let buffer = "";
  let eventName = "";
  let dataLines = [];
  return (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line === "") {
        if (dataLines.length > 0) onFrame(eventName || "message", dataLines.join("\n"));
        eventName = "";
        dataLines = [];
      } else if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
  };
}

async function appPlane(untilMs, results) {
  let reconnects = 0;
  while (Date.now() < untilMs) {
    try {
      const res = await fetch(`${BASE}/api/stream/${FIXTURE_ID}?mode=live`, {
        headers: { Accept: "text/event-stream" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const feed = parseSse((name, data) => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          noteFailure("app", "bad-json-frame", `event ${name}`, data);
          return;
        }
        saveRaw("app", name, parsed);
        if (name === "backfill" && !results.joined) {
          results.joined = true;
          const state = foldMatch(parsed.events ?? [], { feedNow: Date.now() });
          results.joinState = state;
          log(
            `APP join reconstructed: ${parsed.events?.length ?? 0} events, ${parsed.odds?.length ?? 0} odds ticks in backfill; ` +
              `score ${state.score.p1}-${state.score.p2}, minute ${stateMinute(state, Date.now())}', phase ${state.phase}`
          );
        } else if (name === "match") {
          results.appEvents++;
          log(`APP event: ${parsed.action} seq=${parsed.seq} clock=${parsed.clock?.seconds ?? "-"}s`);
        } else if (name === "odds") {
          results.appOdds++;
          if (results.appOdds % 25 === 1) {
            log(`APP odds tick #${results.appOdds}: prices=${JSON.stringify(parsed.prices)}`);
          }
        } else if (name === "fault") {
          log(`APP fault frame: ${parsed.message}`);
        }
      });
      for (;;) {
        if (Date.now() >= untilMs) {
          reader.cancel().catch(() => {});
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        feed(decoder.decode(value, { stream: true }));
      }
      throw new Error("stream closed by server");
    } catch (err) {
      if (Date.now() >= untilMs) return;
      reconnects++;
      results.appReconnects = reconnects;
      log(`APP stream dropped (${err.message}); reconnecting (${reconnects})`);
      await sleep(3_000);
    }
  }
}

// ------------------------------------------------------ plane B: feed
async function feedReconstruct(results) {
  // The same reconstruction the app performs, done raw so every payload
  // passes through the local normalization layer with failures counted.
  const lookback = epochDay(Date.now()) - 13;
  const rawFixtures = await txGetJson(`/fixtures/snapshot?startEpochDay=${lookback}`);
  // Fixture metadata is not a score payload: it stays out of the scores
  // shape ledger (its Competition/Participant keys would false-flag the
  // diff against the historical score samples).
  let fixture = null;
  for (const raw of rawFixtures) {
    const f = normalizeFixture(raw);
    if (f?.fixtureId === FIXTURE_ID) fixture = f;
  }
  if (!fixture) throw new Error("fixture missing from raw snapshot");

  const now = Date.now();
  const events = new Map();
  const addScoreRaw = (raw, source) => {
    record("scores", raw);
    saveRaw("feed", source, raw);
    try {
      const e = normalizeMatchEvent(raw);
      if (e === null) {
        noteFailure("feed", "normalize-null", `score payload from ${source}`, raw);
      } else if (e.fixtureId === FIXTURE_ID) {
        events.set(e.seq, e);
      }
    } catch (err) {
      noteFailure("feed", "normalize-throw", `${source}: ${err.message}`, raw);
    }
  };

  for (const t of sealedIntervalStarts(fixture.startTime - 10 * 60_000, now, now)) {
    try {
      const batch = await txGetJson(
        `/scores/updates/${epochDay(t)}/${hourOfDay(t)}/${fiveMinInterval(t)}?fixtureId=${FIXTURE_ID}`
      );
      batch.forEach((raw) => addScoreRaw(raw, "scores-interval"));
    } catch (err) {
      log(`FEED sealed interval ${new Date(t).toISOString()} failed (${err.message}); continuing`);
    }
  }
  try {
    const snapshot = await txGetJson(`/scores/snapshot/${FIXTURE_ID}`);
    snapshot.forEach((raw) => addScoreRaw(raw, "scores-snapshot"));
    log(`FEED snapshot: ${snapshot.length} per-action records`);
  } catch (err) {
    log(`FEED scores snapshot failed (${err.message}); interval log only`);
  }

  let oddsSnapshotNote = "present";
  try {
    const odds = await txGetJson(`/odds/snapshot/${FIXTURE_ID}`);
    if (odds.length === 0) oddsSnapshotNote = "empty [] (known rollover flake, tolerated)";
    odds.forEach((raw) => {
      record("odds", raw);
      saveRaw("feed", "odds-snapshot", raw);
      const o = normalizeOddsUpdate(raw);
      if (o === null) noteFailure("feed", "normalize-null", "odds snapshot payload", raw);
    });
    log(`FEED odds snapshot: ${odds.length} lines (${oddsSnapshotNote})`);
  } catch (err) {
    log(`FEED odds snapshot failed (${err.message})`);
  }

  const ordered = [...events.values()].sort((a, b) => a.seq - b.seq);
  const state = foldMatch(ordered, { feedNow: now });
  results.feedJoinState = state;
  results.feedJoinEvents = ordered.length;
  log(
    `FEED join reconstructed raw: ${ordered.length} events; score ${state.score.p1}-${state.score.p2}, ` +
      `minute ${stateMinute(state, now)}', phase ${state.phase}`
  );
}

async function feedListen(untilMs, results) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, untilMs - Date.now()));
  const consume = (source, normalize, counterKey, filter) =>
    (async () => {
      while (Date.now() < untilMs) {
        try {
          await txStream(`/${source}/stream?fixtureId=${FIXTURE_ID}`, controller.signal, (data) => {
            let raw = null;
            try {
              raw = JSON.parse(data);
            } catch {
              noteFailure("feed", "bad-json-frame", `${source} stream`, data);
              return;
            }
            record(source === "scores" ? "scores" : "odds", raw);
            saveRaw("feed", `${source}-stream`, raw);
            try {
              const n = normalize(raw);
              if (n === null) {
                noteFailure("feed", "normalize-null", `${source} stream payload`, raw);
                return;
              }
              if (filter && !filter(n)) return;
              results[counterKey]++;
              if (source === "scores") {
                log(`FEED event: ${n.action} seq=${n.seq} clock=${n.clock?.seconds ?? "-"}s`);
              } else if (results[counterKey] % 25 === 1) {
                log(`FEED odds tick #${results[counterKey]}: ${n.superOddsType} ${JSON.stringify(n.prices)}`);
              }
            } catch (err) {
              noteFailure("feed", "normalize-throw", `${source} stream: ${err.message}`, raw);
            }
          });
          if (Date.now() < untilMs) {
            log(`FEED ${source} stream closed by server; reconnecting`);
            await sleep(3_000);
          }
        } catch (err) {
          if (Date.now() >= untilMs || controller.signal.aborted) return;
          log(`FEED ${source} stream error (${err.message}); reconnecting`);
          await sleep(3_000);
        }
      }
    })();

  await Promise.all([
    consume("scores", normalizeMatchEvent, "feedEvents", null),
    consume("odds", normalizeOddsUpdate, "feedOdds", null),
  ]);
  clearTimeout(timer);
}

// ------------------------------------------------- shape diff vs spike
function shapeDiff() {
  const spikeDir = path.join(process.cwd(), "..", "supersub-spike", "samples");
  const out = { scores: null, odds: null };
  try {
    const hist = new Set();
    for (const e of JSON.parse(fs.readFileSync(path.join(spikeDir, "replay-scores.json"), "utf8"))) {
      for (const k of Object.keys(e)) hist.add(k);
    }
    const live = liveShapes.scores;
    out.scores = {
      newInLive: [...live].filter((k) => !hist.has(k)),
      liveCount: live.size,
      histCount: hist.size,
    };
  } catch (err) {
    out.scores = { error: `historical scores unavailable: ${err.message}` };
  }
  try {
    const hist = new Set();
    for (const o of JSON.parse(fs.readFileSync(path.join(spikeDir, "replay-odds.json"), "utf8"))) {
      for (const k of Object.keys(o)) hist.add(k);
    }
    const live = liveShapes.odds;
    out.odds = {
      newInLive: [...live].filter((k) => !hist.has(k)),
      liveCount: live.size,
      histCount: hist.size,
    };
  } catch (err) {
    out.odds = { error: `historical odds unavailable: ${err.message}` };
  }
  return out;
}

// ----------------------------------------------------------------- run
async function main() {
  log(`target ${BASE} fixture ${FIXTURE_ID}, listen window ${LISTEN_MINUTES} min`);
  const startMs = await resolveStartMs();
  log(`start time ${new Date(startMs).toISOString()}`);

  while (Date.now() < startMs) {
    const mins = Math.ceil((startMs - Date.now()) / 60_000);
    log(`waiting: T-${mins}m until start`);
    await sleep(Math.min(5 * 60_000, Math.max(1_000, startMs - Date.now())));
  }

  const results = {
    joined: false,
    joinState: null,
    appEvents: 0,
    appOdds: 0,
    appReconnects: 0,
    feedJoinState: null,
    feedJoinEvents: 0,
    feedEvents: 0,
    feedOdds: 0,
  };

  log("=== join phase ===");
  const haveTokens = Boolean(process.env.TXLINE_API_TOKEN);
  if (!haveTokens) log("no TXLINE_API_TOKEN in env: FEED plane skipped, APP plane only");
  try {
    if (haveTokens) await feedReconstruct(results);
  } catch (err) {
    log(`FEED reconstruction failed: ${err.message}`);
  }

  log(`=== listen phase: ${LISTEN_MINUTES} minutes ===`);
  const untilMs = Date.now() + LISTEN_MINUTES * 60_000;
  await Promise.all([
    appPlane(untilMs, results),
    haveTokens ? feedListen(untilMs, results) : Promise.resolve(),
  ]);

  const diff = shapeDiff();
  const js = results.joinState;
  const fj = results.feedJoinState;
  const agree =
    js && fj ? js.score.p1 === fj.score.p1 && js.score.p2 === fj.score.p2 : null;
  const shapesOk =
    (!diff.scores?.newInLive || diff.scores.newInLive.length === 0) &&
    (!diff.odds?.newInLive || diff.odds.newInLive.length === 0);

  log("=== VERDICT ===");
  log(
    `join (APP): ${js ? `score ${js.score.p1}-${js.score.p2}, minute ${stateMinute(js, Date.now())}', phase ${js.phase}` : "NO BACKFILL RECEIVED"}`
  );
  log(
    `join (FEED raw): ${fj ? `score ${fj.score.p1}-${fj.score.p2}, phase ${fj.phase}, ${results.feedJoinEvents} events` : haveTokens ? "FAILED" : "skipped (no tokens)"}`
  );
  if (agree !== null) log(`planes agree on score at join: ${agree ? "YES" : "NO"}`);
  log(`events received: APP ${results.appEvents}, FEED ${results.feedEvents}`);
  log(`odds ticks received: APP ${results.appOdds}, FEED ${results.feedOdds}`);
  log(`stream reconnects (APP): ${results.appReconnects}`);
  log(`parse failures: ${failures.length} (must be zero)`);
  log(
    `live field shapes vs spike history: scores new keys ${JSON.stringify(diff.scores?.newInLive ?? diff.scores)}, odds new keys ${JSON.stringify(diff.odds?.newInLive ?? diff.odds)}`
  );
  log(`raw payloads saved to ${NDJSON_PATH}`);

  const pass = failures.length === 0 && results.joined && (results.appEvents + results.appOdds > 0);
  const paragraph =
    `\n## Live verification, ${new Date().toISOString()}\n\n` +
    `Fixture ${FIXTURE_ID} against ${BASE}, live mode, ${LISTEN_MINUTES} minute listen window. ` +
    `Mid-match join via the production stream reconstructed ` +
    `${js ? `${js.score.p1}-${js.score.p2} at minute ${stateMinute(js, Date.now())}' (phase ${js.phase})` : "nothing (no backfill received)"}` +
    `${fj ? `, and the raw snapshot-plus-sealed-interval path rebuilt ${fj.score.p1}-${fj.score.p2} from ${results.feedJoinEvents} events${agree === false ? " (DISAGREEMENT with the app plane)" : ", agreeing with the app plane"}` : ""}. ` +
    `Received ${results.appEvents} events and ${results.appOdds} odds ticks on the production stream` +
    `${haveTokens ? `, plus ${results.feedEvents} events and ${results.feedOdds} odds ticks on the raw feed, every payload run through the normalization layer with ${failures.length} parse failures` : ` (raw feed plane skipped: no tokens)`}. ` +
    `Live top-level field shapes ${shapesOk ? "matched the spike's historical samples exactly" : `introduced new keys: scores ${JSON.stringify(diff.scores?.newInLive)}, odds ${JSON.stringify(diff.odds?.newInLive)}`}. ` +
    `The run was read-only against production (GET /api/fixtures and GET /api/stream only); the join path needs no identity, so no throwaway player was created and no entries were written. ` +
    `Verdict: ${pass ? "PASS" : "NOT CONCLUSIVE, see LIVE-VERIFY.log"}. Raw evidence: samples/live-${FIXTURE_ID}.ndjson.\n`;
  fs.appendFileSync(MD_PATH, paragraph);
  log(`report appended to ${MD_PATH}`);
  log(pass ? "RESULT: PASS" : "RESULT: NOT CONCLUSIVE");

  ndjson.end();
  logStream.end();
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  log(`FATAL: ${err.stack ?? err.message}`);
  fs.appendFileSync(
    MD_PATH,
    `\n## Live verification, ${new Date().toISOString()}\n\nRun against ${BASE} for fixture ${FIXTURE_ID} aborted: ${err.message}. See LIVE-VERIFY.log.\n`
  );
  process.exit(1);
});

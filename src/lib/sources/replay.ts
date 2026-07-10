// The replay harness (built first, per the brief): a dev-mode match source
// that replays a finished fixture from the historical endpoints as if
// live, at configurable speed (1x to 60x), through the exact same
// MatchSource interface as the live SSE source.
//
// Fixture data comes from, in order:
//   1. data/replay/{fixtureId}/    committed bundle (France v Morocco
//      18209181 ships with the repo so a fresh clone replays offline)
//   2. .cache/replay/{fixtureId}/  runtime cache
//   3. the TxLINE historical endpoints (GET /scores/historical/{id} plus
//      the 5-minute odds interval endpoint), then cached to 2.
//
// A replay session maps feed time onto wall time: virtualNow =
// startFeedTs + (wallNow - anchor) * speed. Sessions are keyed by
// (fixtureId, anchor), where the anchor is the wall-clock ms at which the
// replay started. The client mints an anchor once per browser tab and
// sends it on every stream, enter, and resolve call, which buys three
// properties at once:
//   - every viewer (each judge) gets their own private timeline
//   - a refresh resumes exactly where the match was (same anchor)
//   - separate serverless instances derive the identical clock from the
//     same anchor, so entry and resolution agree with the stream even
//     when requests land on different lambdas
// Calls without an anchor share one per-instance session (dev scripts,
// Phase 1/2 smoke compatibility).

import * as fs from "node:fs";
import * as path from "node:path";
import {
  normalizeFixture,
  normalizeMatchEvent,
  normalizeOddsUpdate,
  is1x2FullTime,
  parseArrayOrSseFraming,
} from "@/lib/feed/normalize";
import type { Fixture, MatchEvent, OddsUpdate } from "@/lib/feed/types";
import {
  epochDay,
  fiveMinInterval,
  hourOfDay,
  txGetJson,
  txGetText,
} from "@/lib/server/txline";
import type {
  FixtureListing,
  MatchLog,
  MatchSource,
  SourceCallbacks,
} from "./types";

const BUNDLE_DIR = path.join(process.cwd(), "data", "replay");
const CACHE_DIR = path.join(process.cwd(), ".cache", "replay");

const DEFAULT_SPEED = clampSpeed(Number(process.env.REPLAY_SPEED ?? 30));
// Feed seconds of pre-match included before kickoff, so there is a moment
// on the bench to pick a side before the whistle.
const PRE_ROLL_SECONDS = Number(process.env.REPLAY_PREROLL_SECONDS ?? 90);

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 30;
  return Math.min(60, Math.max(1, speed));
}

interface ReplayData {
  fixture: Fixture;
  events: MatchEvent[]; // sorted by ts
  odds: OddsUpdate[]; // FT 1X2 only, sorted by ts
  firstEventTs: number;
  // First kickoff event in the log. Histories do not always reach back to
  // the official start time (Argentina v Egypt 18202701 begins at the
  // second half), so the replay clock starts here, not at StartTime; the
  // odds backfill still paints the full earlier curve instantly.
  firstKickoffTs: number | null;
  endFeedTs: number;
}

interface ReplaySession {
  data: ReplayData;
  speed: number;
  anchorWallMs: number;
  startFeedTs: number;
}

// Survives Next.js dev-server HMR reloads. Keyed "fixtureId:anchor".
const globalStore = globalThis as unknown as {
  __supersubReplay?: Map<string, ReplaySession>;
  __supersubReplayData?: Map<number, ReplayData>;
};
const sessions = (globalStore.__supersubReplay ??= new Map<string, ReplaySession>());
const dataCache = (globalStore.__supersubReplayData ??= new Map<number, ReplayData>());

function sessionKey(fixtureId: number, anchor?: number): string {
  return `${fixtureId}:${anchor ?? "shared"}`;
}

// Anchors are client-supplied wall clocks: clamp to something sane so a
// bad value cannot start a replay in the future or eons ago.
function clampAnchor(anchor: number | undefined): number | undefined {
  if (anchor === undefined || !Number.isFinite(anchor)) return undefined;
  const now = Date.now();
  return Math.min(now, Math.max(now - 7 * 86_400_000, Math.floor(anchor)));
}

function readDirData(dir: string, fixtureId: number): ReplayData | null {
  const base = path.join(dir, String(fixtureId));
  const fixturePath = path.join(base, "fixture.json");
  const scoresPath = path.join(base, "scores.json");
  const oddsPath = path.join(base, "odds-1x2.json");
  if (!fs.existsSync(fixturePath) || !fs.existsSync(scoresPath) || !fs.existsSync(oddsPath)) {
    return null;
  }
  const fixture = normalizeFixture(JSON.parse(fs.readFileSync(fixturePath, "utf8")));
  if (!fixture) return null;
  const events = (JSON.parse(fs.readFileSync(scoresPath, "utf8")) as unknown[])
    .map(normalizeMatchEvent)
    .filter((e): e is MatchEvent => e !== null)
    .sort((a, b) => a.ts - b.ts || a.seq - b.seq);
  const odds = (JSON.parse(fs.readFileSync(oddsPath, "utf8")) as unknown[])
    .map(normalizeOddsUpdate)
    .filter((o): o is OddsUpdate => o !== null)
    .filter(is1x2FullTime)
    .sort((a, b) => a.ts - b.ts);
  if (events.length === 0) return null;
  return {
    fixture,
    events,
    odds,
    firstEventTs: events[0].ts,
    firstKickoffTs: events.find((e) => e.action === "kickoff")?.ts ?? null,
    endFeedTs: Math.max(events[events.length - 1].ts, odds.length ? odds[odds.length - 1].ts : 0),
  };
}

async function fetchFromHistory(fixtureId: number): Promise<ReplayData> {
  // Fixture metadata: the snapshot reaches ~48 days back with a lookback
  // parameter; scores history covers roughly the last two weeks.
  const lookbackDay = epochDay(Date.now()) - 13;
  const rawFixtures = await txGetJson<unknown[]>(`/fixtures/snapshot?startEpochDay=${lookbackDay}`);
  const fixture = rawFixtures
    .map(normalizeFixture)
    .find((f): f is Fixture => f !== null && f.fixtureId === fixtureId);
  if (!fixture) throw new Error(`Fixture ${fixtureId} not found in the snapshot lookback window.`);

  // Historical scores return SSE-framed text despite the spec saying JSON
  // array; parseArrayOrSseFraming handles both.
  const rawText = await txGetText(`/scores/historical/${fixtureId}`);
  const events = parseArrayOrSseFraming(rawText)
    .map(normalizeMatchEvent)
    .filter((e): e is MatchEvent => e !== null)
    .sort((a, b) => a.ts - b.ts || a.seq - b.seq);
  if (events.length === 0) {
    throw new Error(
      `Historical scores for ${fixtureId} are empty (matches older than ~2 weeks or younger than ~6 hours are not served).`
    );
  }

  // Odds across the match window from the sealed 5-minute intervals.
  const fromMs = fixture.startTime - 30 * 60_000;
  const toMs = events[events.length - 1].ts;
  const odds: OddsUpdate[] = [];
  for (let t = fromMs; t <= toMs; t += 300_000) {
    try {
      const batch = await txGetJson<unknown[]>(
        `/odds/updates/${epochDay(t)}/${hourOfDay(t)}/${fiveMinInterval(t)}?fixtureId=${fixtureId}`
      );
      for (const raw of batch) {
        const o = normalizeOddsUpdate(raw);
        if (o && o.fixtureId === fixtureId && is1x2FullTime(o)) odds.push(o);
      }
    } catch {
      // A failed interval leaves a short flat stretch in the curve; better
      // than aborting the whole replay.
    }
  }
  odds.sort((a, b) => a.ts - b.ts);

  // Cache for next time.
  const base = path.join(CACHE_DIR, String(fixtureId));
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, "fixture.json"), JSON.stringify({
    FixtureId: fixture.fixtureId,
    StartTime: fixture.startTime,
    Competition: fixture.competition,
    Participant1: fixture.participant1,
    Participant2: fixture.participant2,
    Participant1Id: fixture.participant1Id,
    Participant2Id: fixture.participant2Id,
    Participant1IsHome: fixture.participant1IsHome,
  }));
  fs.writeFileSync(path.join(base, "scores.json"), JSON.stringify(parseArrayOrSseFraming(rawText)));
  // Cached odds are already normalized; normalizeOddsUpdate reads
  // camelCase too, so the cache round-trips through the same path.
  fs.writeFileSync(path.join(base, "odds-1x2.json"), JSON.stringify(odds));

  return {
    fixture,
    events,
    odds,
    firstEventTs: events[0].ts,
    firstKickoffTs: events.find((e) => e.action === "kickoff")?.ts ?? null,
    endFeedTs: Math.max(toMs, odds.length ? odds[odds.length - 1].ts : 0),
  };
}

async function loadData(fixtureId: number): Promise<ReplayData> {
  const cached = dataCache.get(fixtureId);
  if (cached) return cached;
  const data =
    readDirData(BUNDLE_DIR, fixtureId) ??
    readDirData(CACHE_DIR, fixtureId) ??
    (await fetchFromHistory(fixtureId));
  dataCache.set(fixtureId, data);
  return data;
}

function virtualNow(s: ReplaySession): number {
  const vt = s.startFeedTs + (Date.now() - s.anchorWallMs) * s.speed;
  // Let the clock run a little past the last event so the finished state
  // settles, then hold.
  return Math.min(vt, s.data.endFeedTs + 5 * 60_000);
}

async function getSession(
  fixtureId: number,
  speed?: number,
  anchor?: number
): Promise<ReplaySession> {
  const clamped = clampAnchor(anchor);
  const key = sessionKey(fixtureId, clamped);
  let s = sessions.get(key);
  if (!s) {
    const data = await loadData(fixtureId);
    // Start where coverage actually starts: the first kickoff event in
    // the log (falls back to the official start time). Everything before
    // it (pre-match odds, or a missing first half's market story) arrives
    // in the connect backfill instead of being replayed in real time.
    const coverageStart = data.firstKickoffTs ?? data.fixture.startTime;
    s = {
      data,
      speed: speed ?? DEFAULT_SPEED,
      anchorWallMs: clamped ?? Date.now(),
      startFeedTs: coverageStart - PRE_ROLL_SECONDS * 1000,
    };
    sessions.set(key, s);
  } else if (speed !== undefined && speed !== s.speed) {
    // Change pace without jumping the timeline. Note this bends the pure
    // anchor-to-clock mapping for this instance only; anchored sessions
    // should keep one speed for the whole match (the UI never changes it
    // mid-session).
    const vt = virtualNow(s);
    s.startFeedTs = vt;
    s.anchorWallMs = Date.now();
    s.speed = speed;
  }
  return s;
}

export function resetReplaySession(fixtureId: number): void {
  for (const key of [...sessions.keys()]) {
    if (key.startsWith(`${fixtureId}:`)) sessions.delete(key);
  }
}

function listBundledFixtureIds(): number[] {
  const ids = new Set<number>();
  for (const dir of [BUNDLE_DIR, CACHE_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const id = Number(name);
      if (Number.isInteger(id) && fs.existsSync(path.join(dir, name, "fixture.json"))) {
        ids.add(id);
      }
    }
  }
  return [...ids];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createReplaySource(opts: { speed?: number; anchor?: number } = {}): MatchSource {
  const requestedSpeed = opts.speed !== undefined ? clampSpeed(opts.speed) : undefined;
  const requestedAnchor = opts.anchor;

  return {
    mode: "replay",

    async listFixtures(): Promise<FixtureListing[]> {
      const out: FixtureListing[] = [];
      for (const id of listBundledFixtureIds()) {
        try {
          const data = await loadData(id);
          // Phase relative to the replay timeline: no session yet means
          // the replay has not kicked off; the freshest running session
          // for the fixture is live until its clock passes the last event.
          let s: ReplaySession | undefined;
          for (const [key, candidate] of sessions) {
            if (!key.startsWith(`${id}:`)) continue;
            if (!s || candidate.anchorWallMs > s.anchorWallMs) s = candidate;
          }
          const lastTs = data.events[data.events.length - 1].ts;
          const phase = !s ? "upcoming" : virtualNow(s) > lastTs ? "finished" : "live";
          out.push({ fixture: data.fixture, phase, mode: "replay" });
        } catch {
          // Skip unreadable bundles.
        }
      }
      return out.sort((a, b) => a.fixture.startTime - b.fixture.startTime);
    },

    async getFixture(fixtureId: number): Promise<Fixture | null> {
      try {
        return (await loadData(fixtureId)).fixture;
      } catch {
        return null;
      }
    },

    async getLog(fixtureId: number, upToFeedTs?: number): Promise<MatchLog> {
      const s = await getSession(fixtureId, requestedSpeed, requestedAnchor);
      const cutoff = upToFeedTs ?? virtualNow(s);
      return {
        fixture: s.data.fixture,
        events: s.data.events.filter((e) => e.ts <= cutoff),
        odds: s.data.odds.filter((o) => o.ts <= cutoff),
      };
    },

    async feedNow(fixtureId: number): Promise<number> {
      const s = await getSession(fixtureId, requestedSpeed, requestedAnchor);
      return virtualNow(s);
    },

    async connect(fixtureId, cb: SourceCallbacks, signal: AbortSignal): Promise<void> {
      const s = await getSession(fixtureId, requestedSpeed, requestedAnchor);
      const vt = virtualNow(s);

      cb.onMeta({ mode: "replay", speed: s.speed, fixture: s.data.fixture, virtualNow: vt });

      // Join or reconnect: reconstruct state first, then stream. Same
      // contract the live source honors with snapshot plus backfill.
      let eventCursor = 0;
      let oddsCursor = 0;
      while (eventCursor < s.data.events.length && s.data.events[eventCursor].ts <= vt) eventCursor++;
      while (oddsCursor < s.data.odds.length && s.data.odds[oddsCursor].ts <= vt) oddsCursor++;
      cb.onBackfill({
        events: s.data.events.slice(0, eventCursor),
        odds: s.data.odds.slice(0, oddsCursor),
      });

      while (!signal.aborted) {
        const now = virtualNow(s);
        while (eventCursor < s.data.events.length && s.data.events[eventCursor].ts <= now) {
          cb.onEvent(s.data.events[eventCursor]);
          eventCursor++;
        }
        while (oddsCursor < s.data.odds.length && s.data.odds[oddsCursor].ts <= now) {
          cb.onOdds(s.data.odds[oddsCursor]);
          oddsCursor++;
        }
        cb.onClock(now);
        await sleep(250);
      }
    },
  };
}

// Match Detail: the full story of a finished match, computed once and
// cached per fixture id. Read-only; it never scores, never enters, and
// never mutates anything.
//
// The story is built from the historical event log through the SAME
// normalization and fold the live and replay screens use. Folding a
// days-old fixture sweeps thousands of sealed intervals, which is
// exactly why the result is cached: the first request for a fixture
// pays the fold cost, every request after is a map lookup (per server
// instance; see the cache note at the bottom).
//
// Player names are resolved ONLY against a lineups roster present in the
// source log for that fixture (the live historical feed carries a
// lineups event; the bundled replay logs do not). Where no roster
// exists, events render with team and minute and no name. A PlayerId is
// read only from the CONFIRMED instance of an action (spike finding);
// an unresolvable id is dropped silently. Names are never invented.

import * as fs from "node:fs";
import * as path from "node:path";
import { normalizeMatchEvent } from "@/lib/feed/normalize";
import { foldMatch } from "@/lib/state/fold";
import {
  epochDay,
  fiveMinInterval,
  hourOfDay,
  sealedIntervalStarts,
  txGetJson,
} from "@/lib/server/txline";
import { isBundledReplay } from "@/lib/playability";
import type { MatchEvent } from "@/lib/feed/types";

const BUNDLE_DIR = path.join(process.cwd(), "data", "replay");
const CACHE_DIR = path.join(process.cwd(), ".cache", "replay");

type Raw = Record<string, unknown>;

export type TimelineKind =
  | "goal"
  | "var_overturn"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "period";

export interface TimelineEvent {
  kind: TimelineKind;
  seq: number;
  minute: number | null;
  team: 1 | 2 | null;
  discarded?: boolean;
  playerName?: string | null;
  secondaryName?: string | null; // substitution: the player coming off
  label?: string; // period label
}

export interface MatchTimeline {
  fixtureId: number;
  participant1: string;
  participant2: string;
  participant1IsHome: boolean;
  competition: string;
  startTime: number | null;
  score: { p1: number; p2: number };
  pens: { p1: number; p2: number } | null;
  wentToExtraTime: boolean;
  hasRoster: boolean;
  events: TimelineEvent[];
}

// Casing-tolerant field read (bundled + historical are PascalCase; a live
// frame may be camelCase).
function pick(obj: unknown, pascal: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Raw;
  if (pascal in o) return o[pascal];
  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  return camel in o ? o[camel] : undefined;
}
const num = (o: unknown, k: string): number | undefined => {
  const v = pick(o, k);
  return typeof v === "number" ? v : undefined;
};
const str = (o: unknown, k: string): string | undefined => {
  const v = pick(o, k);
  return typeof v === "string" ? v : undefined;
};
const bool = (o: unknown, k: string): boolean | undefined => {
  const v = pick(o, k);
  return typeof v === "boolean" ? v : undefined;
};

function minuteOf(e: Raw): number | null {
  const clock = pick(e, "Clock");
  const s = num(clock, "Seconds");
  if (s === undefined) return null;
  return Math.floor(s / 60) + 1;
}

// ---- raw log loading ------------------------------------------------------

function readBundleRaw(fixtureId: number): Raw[] | null {
  for (const dir of [BUNDLE_DIR, CACHE_DIR]) {
    const p = path.join(dir, String(fixtureId), "scores.json");
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8")) as Raw[];
      } catch {
        return null;
      }
    }
  }
  return null;
}

function readBundleFixture(fixtureId: number): Raw | null {
  for (const dir of [BUNDLE_DIR, CACHE_DIR]) {
    const p = path.join(dir, String(fixtureId), "fixture.json");
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8")) as Raw;
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Real finished fixture: reassemble the raw historical log from the
// sealed 5-minute intervals plus the per-action snapshot, keyed by seq
// so overlap is harmless. Raw objects are kept (the normalized shape
// drops the player ids and the lineups roster this page needs).
async function fetchRealRaw(
  fixtureId: number
): Promise<{ raw: Raw[]; fixture: Raw } | null> {
  let fixtures: Raw[];
  try {
    fixtures = await txGetJson<Raw[]>(
      `/fixtures/snapshot?startEpochDay=${epochDay(Date.now()) - 14}`
    );
  } catch {
    return null;
  }
  const fixture = fixtures.find((f) => num(f, "FixtureId") === fixtureId);
  if (!fixture) return null;
  const startTime = num(fixture, "StartTime") ?? Date.now();
  const now = Date.now();
  // A finished match's whole event log lives within a few hours of
  // kickoff. Cap the interval sweep at kickoff + 3.5h (covers 90 + extra
  // time + penalties + generous buffer) instead of sweeping empty
  // intervals all the way to "now", which for a days-old fixture is
  // thousands of wasted calls.
  const windowEnd = Math.min(now, startTime + 3.5 * 3_600_000);

  const bySeq = new Map<number, Raw>();
  // Fetch every sealed interval concurrently; a days-old finished match
  // is a fixed, bounded set, so this is one burst, not a long serial
  // sweep. Individual failures are tolerated (the snapshot still anchors
  // the final state).
  const intervals = sealedIntervalStarts(startTime - 15 * 60_000, windowEnd, now);
  const batches = await Promise.all(
    intervals.map((t) =>
      txGetJson<Raw[]>(
        `/scores/updates/${epochDay(t)}/${hourOfDay(t)}/${fiveMinInterval(t)}?fixtureId=${fixtureId}`
      ).catch(() => [] as Raw[])
    )
  );
  for (const batch of batches) {
    for (const e of batch) {
      const seq = num(e, "Seq");
      if (seq !== undefined) bySeq.set(seq, e);
    }
  }
  try {
    const snap = await txGetJson<Raw[]>(`/scores/snapshot/${fixtureId}`);
    for (const e of snap) {
      const seq = num(e, "Seq");
      if (seq !== undefined) bySeq.set(seq, e);
    }
  } catch {
    // tolerated
  }
  const raw = [...bySeq.values()];
  return raw.length > 0 ? { raw, fixture } : null;
}

// ---- roster + names -------------------------------------------------------

interface RosterEntry {
  name: string;
  number?: string;
}

// Build a player-id -> name map from any lineups event in the log. Keyed
// by both normativeId and fixturePlayerId so a goal's Data.PlayerId
// resolves whichever id space it uses. Empty when the log has no roster.
function buildRoster(raw: Raw[]): Map<number, RosterEntry> {
  const map = new Map<number, RosterEntry>();
  for (const e of raw) {
    if (str(e, "Action") !== "lineups") continue;
    const teams = pick(e, "Lineups");
    if (!Array.isArray(teams)) continue;
    for (const team of teams) {
      const list = (team as Raw)?.lineups;
      if (!Array.isArray(list)) continue;
      for (const l of list) {
        const row = l as Raw;
        const player = (row.player ?? {}) as Raw;
        const name = typeof player.preferredName === "string" ? player.preferredName : null;
        if (!name) continue;
        const entry: RosterEntry = {
          name,
          number: typeof row.rosterNumber === "string" ? row.rosterNumber : undefined,
        };
        if (typeof player.normativeId === "number") map.set(player.normativeId, entry);
        if (typeof row.fixturePlayerId === "number") map.set(row.fixturePlayerId, entry);
      }
    }
  }
  return map;
}

// Broadcast surname: the feed gives "Surname, Given"; show the surname.
function displayName(entry: RosterEntry | undefined): string | null {
  if (!entry) return null;
  const comma = entry.name.indexOf(",");
  return comma > 0 ? entry.name.slice(0, comma).trim() : entry.name.trim();
}

// The confirmed representative event per action id: prefer the confirmed
// instance, else the last seen. Player ids live only on the confirmed one.
function confirmedById(raw: Raw[], action: string): Map<number, Raw> {
  const out = new Map<number, Raw>();
  for (const e of raw) {
    if (str(e, "Action") !== action) continue;
    const id = num(e, "Id");
    if (id === undefined) continue;
    const existing = out.get(id);
    if (!existing || bool(e, "Confirmed") === true) out.set(id, e);
  }
  return out;
}

// ---- period section breaks ------------------------------------------------

const PERIOD_LABELS: Record<number, string> = {
  3: "Half time",
  5: "Full time",
  6: "Full time",
  7: "Extra time",
  9: "Extra time, second half",
  11: "Penalties",
  12: "Penalties",
};

// ---- compute --------------------------------------------------------------

function build(fixtureId: number, raw: Raw[], fixtureMeta: Raw): MatchTimeline {
  const events = raw
    .map(normalizeMatchEvent)
    .filter((e): e is MatchEvent => e !== null)
    .sort((a, b) => a.seq - b.seq);
  const state = foldMatch(events);
  const discarded = new Set(
    state.countables.filter((c) => c.discarded && c.kind === "goal").map((c) => c.id)
  );

  const roster = buildRoster(raw);
  const nameFor = (playerId: number | undefined): string | null =>
    playerId === undefined ? null : displayName(roster.get(playerId));

  const items: TimelineEvent[] = [];

  // Goals (including VAR-overturned, shown struck through).
  for (const [id, e] of confirmedById(raw, "goal")) {
    const team = num(e, "Participant");
    const isOut = discarded.has(id);
    items.push({
      kind: isOut ? "var_overturn" : "goal",
      seq: num(e, "Seq") ?? 0,
      minute: minuteOf(e),
      team: team === 1 || team === 2 ? team : null,
      discarded: isOut || undefined,
      playerName: nameFor(num(pick(e, "Data"), "PlayerId")),
    });
  }
  // Cards.
  for (const action of ["yellow_card", "red_card"] as const) {
    for (const e of confirmedById(raw, action).values()) {
      const team = num(e, "Participant");
      items.push({
        kind: action,
        seq: num(e, "Seq") ?? 0,
        minute: minuteOf(e),
        team: team === 1 || team === 2 ? team : null,
        playerName: nameFor(num(pick(e, "Data"), "PlayerId")),
      });
    }
  }
  // Substitutions (team + both player ids live in Data).
  for (const e of confirmedById(raw, "substitution").values()) {
    const data = pick(e, "Data");
    const team = num(data, "Participant") ?? num(e, "Participant");
    items.push({
      kind: "substitution",
      seq: num(e, "Seq") ?? 0,
      minute: minuteOf(e),
      team: team === 1 || team === 2 ? team : null,
      playerName: nameFor(num(data, "PlayerInId")),
      secondaryName: nameFor(num(data, "PlayerOutId")),
    });
  }
  // Period section breaks: kickoff, and status transitions.
  let sawKickoff = false;
  for (const e of raw) {
    const action = str(e, "Action");
    if (action === "kickoff" && !sawKickoff) {
      sawKickoff = true;
      items.push({
        kind: "period",
        seq: num(e, "Seq") ?? 0,
        minute: 0,
        team: null,
        label: "Kick off",
      });
    }
    if (action === "status" || action === "halftime_finalised") {
      const sid =
        num(e, "StatusId") ?? num(pick(e, "Data"), "StatusId") ?? (action === "halftime_finalised" ? 3 : undefined);
      if (sid !== undefined && PERIOD_LABELS[sid]) {
        items.push({
          kind: "period",
          seq: num(e, "Seq") ?? 0,
          minute: minuteOf(e),
          team: null,
          label: PERIOD_LABELS[sid],
        });
      }
    }
  }

  // Chronological, kickoff first; de-dupe identical consecutive period
  // breaks (the feed can emit a status more than once).
  items.sort((a, b) => a.seq - b.seq);
  const events2: TimelineEvent[] = [];
  for (const it of items) {
    const prev = events2[events2.length - 1];
    if (it.kind === "period" && prev?.kind === "period" && prev.label === it.label) continue;
    events2.push(it);
  }

  return {
    fixtureId,
    participant1: str(fixtureMeta, "Participant1") ?? "",
    participant2: str(fixtureMeta, "Participant2") ?? "",
    participant1IsHome: bool(fixtureMeta, "Participant1IsHome") ?? true,
    competition: str(fixtureMeta, "Competition") ?? "",
    startTime: num(fixtureMeta, "StartTime") ?? state.startTime,
    score: state.score,
    pens: state.shootout,
    wentToExtraTime: state.wentToExtraTime,
    hasRoster: roster.size > 0,
    events: events2,
  };
}

// ---- cache ----------------------------------------------------------------
//
// Per-instance in-memory cache. A finished match's story is immutable, so
// the TTL exists only to bound memory over a long-lived instance, not for
// freshness. Each entry is a few KB (tens of timeline items); the size cap
// keeps the map small if many fixtures are viewed. Serverless instances
// are ephemeral, so a cold instance recomputes once; within an instance,
// the second and later requests for a fixture never re-fold.

const TTL_MS = 60 * 60_000;
const MAX_ENTRIES = 64;
const cache = new Map<number, { at: number; timeline: MatchTimeline }>();

// Test/observability hook: how many times an actual compute ran.
let computeCount = 0;
export function timelineComputeCount(): number {
  return computeCount;
}

async function compute(fixtureId: number): Promise<MatchTimeline | null> {
  // Bundled replays are local; real fixtures come from the historical feed.
  const bundleRaw = readBundleRaw(fixtureId);
  if (bundleRaw) {
    const meta = readBundleFixture(fixtureId) ?? {};
    computeCount += 1;
    return build(fixtureId, bundleRaw, meta);
  }
  const real = await fetchRealRaw(fixtureId);
  if (!real) return null;
  computeCount += 1;
  return build(fixtureId, real.raw, real.fixture);
}

export async function getMatchTimeline(fixtureId: number): Promise<MatchTimeline | null> {
  const hit = cache.get(fixtureId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.timeline;
  const timeline = await compute(fixtureId);
  if (timeline) {
    if (cache.size >= MAX_ENTRIES) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    cache.set(fixtureId, { at: Date.now(), timeline });
  }
  return timeline;
}

// Whether a report is buildable at all: bundled replays always, plus any
// fixture the caller knows has coverage. Used by the schedule to decide
// which result rows link (a dead click is worse than no link).
export function reportAvailable(fixtureId: number, hasCanonicalScore: boolean): boolean {
  return isBundledReplay(fixtureId) || hasCanonicalScore;
}

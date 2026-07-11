// The real World Cup schedule for the bench, read-only. Fixtures come
// from the TxLINE fixtures snapshot; the phase (upcoming / live /
// finished) is derived from kickoff time, because the snapshot carries
// no status field (the spike found GameState unreliable). Result scores
// come from each finished fixture's CANONICAL final state, the
// game_finalised Score map returned by /scores/snapshot/{id} (the path
// proven in SMOKE9), never by folding whole historical logs on load.
//
// Everything is wrapped in a short server-side cache (revalidate ~10
// min) so a page load is one cheap read most of the time. Any upstream
// failure degrades gracefully: the schedule sections empty out with a
// note, and the bundled replay rail (built elsewhere) still stands.

import { normalizeFixture } from "@/lib/feed/normalize";
import type { Fixture, Phase } from "@/lib/feed/types";
import { epochDay, txGetJson } from "@/lib/server/txline";

// Kickoff to roughly full time plus 30 minutes: the window a fixture is
// treated as LIVE. 150 minutes safely spans 90 plus stoppage, a
// half-time break, and even extra time, without pretending to know the
// real final whistle (which the schedule feed does not give us).
const LIVE_WINDOW_MS = 150 * 60_000;
// How far back to pull finished fixtures for the results wall.
const LOOKBACK_DAYS = 14;
// How many finished fixtures the results wall shows, most recent first.
// Every shown result gets a canonical-score fetch, so this also bounds
// the per-load fan-out; older finished fixtures are simply not listed
// (a documented limitation, not a scoreless guess).
const RESULTS_SHOWN = 12;
const CACHE_TTL_MS = 10 * 60_000;

export interface ScheduleFixture {
  fixture: Fixture;
  phase: Phase;
  live: boolean;
  kickoffToday: boolean;
}

export interface FinalScore {
  // null score means the feed gave no canonical final state (FT, no
  // score shown, rather than a guess).
  score: { p1: number; p2: number } | null;
  pens: { p1: number; p2: number } | null;
  scoreless: boolean;
}

export interface ResultFixture extends ScheduleFixture, FinalScore {}

export interface SchedulePayload {
  now: number;
  // Finished-today fixtures carry their final score too, so the union.
  today: (ScheduleFixture | ResultFixture)[];
  comingUp: { date: string; label: string; fixtures: ScheduleFixture[] }[];
  results: ResultFixture[];
  liveNow: boolean;
  // Set when the live schedule could not be read; the bench keeps the
  // replay rail and shows this note instead of breaking.
  error: string | null;
}

function phaseFor(startTime: number, now: number): { phase: Phase; live: boolean } {
  if (startTime > now) return { phase: "upcoming", live: false };
  if (now < startTime + LIVE_WINDOW_MS) return { phase: "live", live: true };
  return { phase: "finished", live: false };
}

function sameUtcDay(a: number, b: number): boolean {
  return Math.floor(a / 86_400_000) === Math.floor(b / 86_400_000);
}

function dayLabel(startTime: number): string {
  return new Date(startTime).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

// Read a value by PascalCase or camelCase key off a raw feed object.
function pick(obj: unknown, pascal: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  if (pascal in o) return o[pascal];
  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  return camel in o ? o[camel] : undefined;
}

// Canonical final score from the per-action snapshot: the latest
// Score-bearing record's Total.Goals per participant (absent means zero
// by feed contract), plus the PE shootout tally when present. Returns
// null when the feed has no canonical state at all.
export async function canonicalFinalScore(fixtureId: number): Promise<FinalScore | null> {
  let snap: unknown[];
  try {
    snap = await txGetJson<unknown[]>(`/scores/snapshot/${fixtureId}`);
  } catch {
    return null;
  }
  if (!Array.isArray(snap) || snap.length === 0) return null;

  let best: unknown = null;
  let bestSeq = -1;
  for (const e of snap) {
    const score = pick(e, "Score");
    const hasParticipant =
      pick(score, "Participant1") !== undefined || pick(score, "Participant2") !== undefined;
    const seq = (pick(e, "Seq") as number) ?? 0;
    if (score && hasParticipant && seq > bestSeq) {
      best = e;
      bestSeq = seq;
    }
  }
  if (!best) return null;

  const score = pick(best, "Score");
  const goals = (part: 1 | 2): number => {
    const p = pick(score, `Participant${part}`);
    const total = pick(p, "Total");
    const g = pick(total, "Goals");
    return typeof g === "number" ? g : 0;
  };
  const penGoals = (part: 1 | 2): number | null => {
    const p = pick(score, `Participant${part}`);
    const pe = pick(p, "PE");
    if (pe === undefined || pe === null) return null;
    const g = pick(pe, "Goals");
    return typeof g === "number" ? g : 0;
  };

  const p1 = goals(1);
  const p2 = goals(2);
  const pe1 = penGoals(1);
  const pe2 = penGoals(2);
  const pens = pe1 !== null || pe2 !== null ? { p1: pe1 ?? 0, p2: pe2 ?? 0 } : null;
  return { score: { p1, p2 }, pens, scoreless: false };
}

async function buildSchedule(now: number): Promise<SchedulePayload> {
  const startEpochDay = epochDay(now) - LOOKBACK_DAYS;
  let raw: unknown[];
  try {
    raw = await txGetJson<unknown[]>(`/fixtures/snapshot?startEpochDay=${startEpochDay}`);
  } catch (err) {
    return {
      now,
      today: [],
      comingUp: [],
      results: [],
      liveNow: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const fixtures = raw
    .map(normalizeFixture)
    .filter((f): f is Fixture => f !== null)
    .map((fixture) => {
      const { phase, live } = phaseFor(fixture.startTime, now);
      return {
        fixture,
        phase,
        live,
        kickoffToday: sameUtcDay(fixture.startTime, now),
      } as ScheduleFixture;
    });

  const today = fixtures
    .filter((f) => f.kickoffToday)
    .sort((a, b) => a.fixture.startTime - b.fixture.startTime);

  const upcoming = fixtures
    .filter((f) => f.phase === "upcoming" && !f.kickoffToday)
    .sort((a, b) => a.fixture.startTime - b.fixture.startTime);
  const comingUpMap = new Map<string, ScheduleFixture[]>();
  for (const f of upcoming) {
    const key = String(Math.floor(f.fixture.startTime / 86_400_000));
    const list = comingUpMap.get(key) ?? [];
    list.push(f);
    comingUpMap.set(key, list);
  }
  const comingUp = [...comingUpMap.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, list]) => ({
      date: new Date(list[0].fixture.startTime).toISOString().slice(0, 10),
      label: dayLabel(list[0].fixture.startTime),
      fixtures: list,
    }));

  // Finished, previous days, most recent first, capped to the wall size.
  // Today's finished fixtures stay under TODAY so nothing appears twice.
  const finished = fixtures
    .filter((f) => f.phase === "finished" && !f.kickoffToday)
    .sort((a, b) => b.fixture.startTime - a.fixture.startTime)
    .slice(0, RESULTS_SHOWN);

  // Canonical scores for the results wall AND any finished-today
  // fixtures, run in parallel; each failure degrades that one fixture to
  // a scoreless FT, never the page.
  const needScore = [...today.filter((f) => f.phase === "finished"), ...finished];
  const scoreByFixture = new Map<number, FinalScore>();
  await Promise.all(
    needScore.map(async (f) => {
      const s = await canonicalFinalScore(f.fixture.fixtureId).catch(() => null);
      scoreByFixture.set(
        f.fixture.fixtureId,
        s ?? { score: null, pens: null, scoreless: true }
      );
    })
  );

  const withScore = (f: ScheduleFixture): ResultFixture => {
    const s = scoreByFixture.get(f.fixture.fixtureId) ?? {
      score: null,
      pens: null,
      scoreless: true,
    };
    return { ...f, ...s };
  };

  const results = finished.map(withScore);
  // Fold finished-today scores back into the today list so the card can
  // render an FT score there too.
  const todayWithScores: (ScheduleFixture | ResultFixture)[] = today.map((f) =>
    f.phase === "finished" ? withScore(f) : f
  );

  return {
    now,
    today: todayWithScores,
    comingUp,
    results,
    liveNow: fixtures.some((f) => f.live),
    error: null,
  };
}

let cache: { at: number; payload: SchedulePayload } | null = null;

// Cached schedule build. The `now` inside the payload is the build time,
// so countdowns stay live client-side while the heavy fetch is reused
// for up to CACHE_TTL_MS.
export async function getSchedule(nowMs: number): Promise<SchedulePayload> {
  if (cache && nowMs - cache.at < CACHE_TTL_MS) return cache.payload;
  const payload = await buildSchedule(nowMs);
  // Only cache a good build; a failed one should be retried next load.
  if (payload.error === null) cache = { at: nowMs, payload };
  return payload;
}

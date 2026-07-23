// Full tournament history for the RESULTS tab: every finished fixture the
// feed can supply, grouped by UTC day, newest day first, paginated by day
// so the client never renders (or the server never fetches) everything at
// once. Read-only.
//
// Performance is the whole point. Two caches and day pagination keep it
// cheap:
//   1. The day LIST (fixture metadata grouped by day, cached ~10 min) is
//      one fixtures-snapshot call for the whole tournament. It carries no
//      scores, so it is tiny.
//   2. Each fixture's CANONICAL final score comes from the game_finalised
//      Score map on /scores/snapshot/{id} (the SMOKE9 path, never a fold
//      of the whole log) and is cached per fixture for hours, because a
//      finished match's score is immutable.
//   3. A request returns one PAGE of days. Only the days on that page have
//      their scores fetched, so opening the tab pays for the most recent
//      few days; older days are fetched when the client asks for them.

import { normalizeFixture } from "@/lib/feed/normalize";
import type { Fixture } from "@/lib/feed/types";
import { epochDay, txGetJson } from "@/lib/server/txline";
import { reportAvailable } from "@/lib/server/match-timeline";
import { canonicalFinalScore, type FinalScore, type ResultFixture } from "@/lib/server/schedule";
import { isWorldCup } from "@/lib/worldcup";

// Kickoff to full time plus 30 minutes: past this a fixture is finished
// (matches the schedule's heuristic; the feed carries no final-whistle).
const LIVE_WINDOW_MS = 150 * 60_000;
// A tournament runs about a month; look back far enough to cover it.
const TOURNAMENT_LOOKBACK_DAYS = 45;
const DAY_LIST_TTL_MS = 10 * 60_000;
// A finished fixture's canonical score never changes, so cache it long.
const SCORE_TTL_MS = 6 * 60 * 60_000;
// Days returned per page. Each day is a few fixtures, so a page is a
// handful of canonical-score fetches at most on a cold cache.
export const DAYS_PER_PAGE = 4;

export interface ResultDay {
  key: number; // epoch day
  date: string; // yyyy-mm-dd (UTC)
  label: string; // "SAT 18 JUL"
  fixtures: ResultFixture[];
}

export interface ResultsPage {
  page: number;
  days: ResultDay[];
  hasMore: boolean;
  totalFinished: number;
  totalDays: number;
  error: string | null;
}

function sameUtcDay(a: number, b: number): boolean {
  return Math.floor(a / 86_400_000) === Math.floor(b / 86_400_000);
}

function dayHeader(ts: number): string {
  return new Date(ts)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .toUpperCase();
}

// ---- per-fixture canonical-score cache ------------------------------------

const scoreCache = new Map<number, { at: number; score: FinalScore }>();

async function cachedScore(fixtureId: number): Promise<FinalScore> {
  const hit = scoreCache.get(fixtureId);
  if (hit && Date.now() - hit.at < SCORE_TTL_MS) return hit.score;
  const score =
    (await canonicalFinalScore(fixtureId).catch(() => null)) ?? {
      score: null,
      pens: null,
      scoreless: true,
    };
  scoreCache.set(fixtureId, { at: Date.now(), score });
  return score;
}

// ---- day-list cache (metadata only, no scores) ----------------------------

interface DayMeta {
  key: number;
  date: string;
  label: string;
  fixtures: Fixture[];
}

let dayCache: { at: number; days: DayMeta[]; total: number } | null = null;

async function finishedDays(now: number): Promise<{ days: DayMeta[]; total: number; error: string | null }> {
  if (dayCache && now - dayCache.at < DAY_LIST_TTL_MS) {
    return { days: dayCache.days, total: dayCache.total, error: null };
  }
  let raw: unknown[];
  try {
    raw = await txGetJson<unknown[]>(
      `/fixtures/snapshot?startEpochDay=${epochDay(now) - TOURNAMENT_LOOKBACK_DAYS}`
    );
  } catch (err) {
    return { days: [], total: 0, error: err instanceof Error ? err.message : String(err) };
  }

  // Finished, and not today: today's finished fixtures live in the TODAY
  // tab, so the history wall is every finished fixture from earlier days.
  const finished = raw
    .map(normalizeFixture)
    .filter((f): f is Fixture => f !== null)
    // World Cup only: Friendlies never reach the results history.
    .filter(isWorldCup)
    .filter((f) => now >= f.startTime + LIVE_WINDOW_MS && !sameUtcDay(f.startTime, now));

  const byDay = new Map<number, Fixture[]>();
  for (const f of finished) {
    const k = Math.floor(f.startTime / 86_400_000);
    const list = byDay.get(k) ?? [];
    list.push(f);
    byDay.set(k, list);
  }
  const days: DayMeta[] = [...byDay.entries()]
    .sort((a, b) => b[0] - a[0]) // newest day first
    .map(([key, fixtures]) => ({
      key,
      date: new Date(key * 86_400_000).toISOString().slice(0, 10),
      label: dayHeader(fixtures[0].startTime),
      fixtures: fixtures.sort((a, b) => b.startTime - a.startTime), // latest kickoff first within the day
    }));

  dayCache = { at: now, days, total: finished.length };
  return { days, total: finished.length, error: null };
}

// ---- page assembly --------------------------------------------------------

export async function getResultsPage(page: number, now: number): Promise<ResultsPage> {
  const { days, total, error } = await finishedDays(now);
  if (error) {
    return { page, days: [], hasMore: false, totalFinished: 0, totalDays: 0, error };
  }
  const start = Math.max(0, page) * DAYS_PER_PAGE;
  const slice = days.slice(start, start + DAYS_PER_PAGE);

  const resultDays: ResultDay[] = await Promise.all(
    slice.map(async (d) => {
      const fixtures: ResultFixture[] = await Promise.all(
        d.fixtures.map(async (fx) => {
          const s = await cachedScore(fx.fixtureId);
          return {
            fixture: fx,
            phase: "finished" as const,
            live: false,
            kickoffToday: false,
            ...s,
            hasReport: reportAvailable(fx.fixtureId, s.score !== null),
          };
        })
      );
      return { key: d.key, date: d.date, label: d.label, fixtures };
    })
  );

  return {
    page,
    days: resultDays,
    hasMore: start + DAYS_PER_PAGE < days.length,
    totalFinished: total,
    totalDays: days.length,
    error: null,
  };
}

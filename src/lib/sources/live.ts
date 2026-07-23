// The live match source. SSE streams are primary; join and reconnect
// reconstruct current state first (binding architecture requirement 4):
//
//   scores: GET /scores/snapshot/{id}   latest event per action type,
//                                       carries cumulative Score and Stats
//         + GET /scores/updates/{epochDay}/{hour}/{interval}
//                                       sealed 5-minute intervals from
//                                       kickoff to now (the asOf approach
//                                       validated in the spike)
//   odds:   GET /odds/snapshot/{id}     flaky at interval boundaries;
//                                       an empty [] answer is retried once
//                                       and then tolerated (requirement:
//                                       [] must be handled gracefully)
//         + the same sealed 5-minute odds intervals for curve history
//
// then attach GET /scores/stream and GET /odds/stream. The stream is the
// source of truth from that point; the snapshot is never polled while
// streaming (spike risk 5).

import {
  normalizeFixture,
  normalizeMatchEvent,
  normalizeOddsUpdate,
  is1x2FullTime,
} from "@/lib/feed/normalize";
import type { Fixture, MatchEvent, OddsUpdate } from "@/lib/feed/types";
import { phaseFromKickoff } from "@/lib/state/fold";
import { isWorldCup } from "@/lib/worldcup";
import {
  epochDay,
  fiveMinInterval,
  hourOfDay,
  sealedIntervalStarts,
  txGetJson,
  txStream,
} from "@/lib/server/txline";
import type {
  FixtureListing,
  MatchLog,
  MatchSource,
  SourceCallbacks,
} from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchFixture(fixtureId: number): Promise<Fixture | null> {
  const lookbackDay = epochDay(Date.now()) - 13;
  const raw = await txGetJson<unknown[]>(`/fixtures/snapshot?startEpochDay=${lookbackDay}`);
  // World Cup only: a friendly id resolves to null, so getFixture/getLog/
  // connect all reject it the same way an unknown id does.
  return (
    raw
      .map(normalizeFixture)
      .find((f): f is Fixture => f !== null && f.fixtureId === fixtureId && isWorldCup(f)) ?? null
  );
}

// Reconstruct the score event log for a fixture in play: sealed intervals
// for completeness, snapshot for the freshest per-action state. Merged and
// deduped by seq, so overlap is harmless.
async function fetchScoreLog(fixtureId: number, startTime: number, now: number): Promise<MatchEvent[]> {
  const bySeq = new Map<number, MatchEvent>();

  const addRaw = (raw: unknown) => {
    const e = normalizeMatchEvent(raw);
    if (e && e.fixtureId === fixtureId) bySeq.set(e.seq, e);
  };

  // Sealed intervals from shortly before kickoff. The whole event log of
  // a match lives within a few hours of kickoff, so cap the sweep at
  // kickoff + 3.5h rather than running it to "now" (for a day-old
  // finished fixture that would be hundreds of empty interval calls; a
  // live fixture is well under the cap, so this changes nothing there).
  // Fetched concurrently; individual interval failures are tolerated, the
  // snapshot still anchors cumulative state.
  const from = startTime - 10 * 60_000;
  const until = Math.min(now, startTime + 3.5 * 3_600_000);
  const batches = await Promise.all(
    sealedIntervalStarts(from, until, now).map((t) =>
      txGetJson<unknown[]>(
        `/scores/updates/${epochDay(t)}/${hourOfDay(t)}/${fiveMinInterval(t)}?fixtureId=${fixtureId}`
      ).catch(() => [] as unknown[])
    )
  );
  for (const batch of batches) batch.forEach(addRaw);

  try {
    const snapshot = await txGetJson<unknown[]>(`/scores/snapshot/${fixtureId}`);
    snapshot.forEach(addRaw);
  } catch {
    // The interval log alone still folds correctly from kickoff.
  }

  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

async function fetchOddsLog(fixtureId: number, startTime: number, now: number): Promise<OddsUpdate[]> {
  const byKey = new Map<string, OddsUpdate>();
  const addRaw = (raw: unknown) => {
    const o = normalizeOddsUpdate(raw);
    if (o && o.fixtureId === fixtureId && is1x2FullTime(o)) {
      byKey.set(o.messageId ?? `${o.ts}:${o.prices.join(",")}`, o);
    }
  };

  // Same cap and concurrency as the score log: the odds curve is bounded
  // to kickoff + 3.5h, so a finished fixture never sweeps a day of empty
  // intervals, and a live one is under the cap and unchanged.
  const from = startTime - 30 * 60_000;
  const until = Math.min(now, startTime + 3.5 * 3_600_000);
  const batches = await Promise.all(
    sealedIntervalStarts(from, until, now).map((t) =>
      txGetJson<unknown[]>(
        `/odds/updates/${epochDay(t)}/${hourOfDay(t)}/${fiveMinInterval(t)}?fixtureId=${fixtureId}`
      ).catch(() => [] as unknown[])
    )
  );
  for (const batch of batches) batch.forEach(addRaw);

  // Snapshot for the freshest lines. Observed flake: [] right after an
  // interval rollover. One retry, then move on; the SSE stream will fill
  // the gap within seconds.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const snapshot = await txGetJson<unknown[]>(`/odds/snapshot/${fixtureId}`);
      if (snapshot.length > 0) {
        snapshot.forEach(addRaw);
        break;
      }
    } catch {
      // tolerated
    }
    await sleep(2_000);
  }

  return [...byKey.values()].sort((a, b) => a.ts - b.ts);
}

export function createLiveSource(): MatchSource {
  return {
    mode: "live",

    async listFixtures(): Promise<FixtureListing[]> {
      const raw = await txGetJson<unknown[]>("/fixtures/snapshot");
      const now = Date.now();
      return raw
        .map(normalizeFixture)
        .filter((f): f is Fixture => f !== null)
        // World Cup only: Friendlies never appear in a fixture listing.
        .filter(isWorldCup)
        .map((fixture) => ({
          fixture,
          phase: phaseFromKickoff(fixture, now),
          mode: "live" as const,
        }))
        .sort((a, b) => a.fixture.startTime - b.fixture.startTime);
    },

    async getFixture(fixtureId: number): Promise<Fixture | null> {
      return fetchFixture(fixtureId);
    },

    async getLog(fixtureId: number, upToFeedTs?: number): Promise<MatchLog> {
      const fixture = await fetchFixture(fixtureId);
      if (!fixture) throw new Error(`Fixture ${fixtureId} not found.`);
      const now = Date.now();
      const [events, odds] = await Promise.all([
        fetchScoreLog(fixtureId, fixture.startTime, now),
        fetchOddsLog(fixtureId, fixture.startTime, now),
      ]);
      const cutoff = upToFeedTs ?? now;
      return {
        fixture,
        events: events.filter((e) => e.ts <= cutoff),
        odds: odds.filter((o) => o.ts <= cutoff),
      };
    },

    async feedNow(): Promise<number> {
      return Date.now();
    },

    async connect(fixtureId, cb: SourceCallbacks, signal: AbortSignal): Promise<void> {
      const fixture = await fetchFixture(fixtureId);
      if (!fixture) {
        cb.onError(`Fixture ${fixtureId} not found.`);
        return;
      }

      cb.onMeta({ mode: "live", speed: 1, fixture, virtualNow: Date.now() });

      const now = Date.now();
      const [events, odds] = await Promise.all([
        fetchScoreLog(fixtureId, fixture.startTime, now),
        fetchOddsLog(fixtureId, fixture.startTime, now),
      ]);
      cb.onBackfill({ events, odds });

      // Wall-clock heartbeat.
      const clockTimer = setInterval(() => {
        if (!signal.aborted) cb.onClock(Date.now());
      }, 1_000);

      // Two upstream SSE connections, each with its own reconnect loop.
      // The client dedupes by seq, so a re-delivered event is harmless.
      const scoresLoop = (async () => {
        while (!signal.aborted) {
          try {
            await txStream(
              `/scores/stream?fixtureId=${fixtureId}`,
              signal,
              (data) => {
                try {
                  const e = normalizeMatchEvent(JSON.parse(data));
                  if (e && e.fixtureId === fixtureId) cb.onEvent(e);
                } catch {
                  // ignore malformed frames
                }
              }
            );
          } catch (err) {
            if (!signal.aborted) {
              cb.onError(`scores stream dropped: ${err instanceof Error ? err.message : err}`);
            }
          }
          if (!signal.aborted) await sleep(2_000);
        }
      })();

      const oddsLoop = (async () => {
        while (!signal.aborted) {
          try {
            await txStream(
              `/odds/stream?fixtureId=${fixtureId}`,
              signal,
              (data) => {
                try {
                  const o = normalizeOddsUpdate(JSON.parse(data));
                  if (o && o.fixtureId === fixtureId && is1x2FullTime(o)) cb.onOdds(o);
                } catch {
                  // ignore malformed frames
                }
              }
            );
          } catch (err) {
            if (!signal.aborted) {
              cb.onError(`odds stream dropped: ${err instanceof Error ? err.message : err}`);
            }
          }
          if (!signal.aborted) await sleep(2_000);
        }
      })();

      try {
        await Promise.all([scoresLoop, oddsLoop]);
      } finally {
        clearInterval(clockTimer);
      }
    },
  };
}

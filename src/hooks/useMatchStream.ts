"use client";

// Client spine: connects to the app's own SSE endpoint, accumulates the
// normalized event log and odds log, and re-folds on every change. The
// fold IS the state; nothing is incrementally tallied here (binding
// architecture requirement 2). EventSource reconnects transparently and
// the server re-sends meta plus backfill, so everything dedupes by seq
// (events) and messageId (odds).

import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchEvent, OddsUpdate } from "@/lib/feed/types";
import { foldMatch, type MatchState } from "@/lib/state/fold";
import { foldProbSeries } from "@/lib/state/winprob";
import type { SourceMeta } from "@/lib/sources/types";

export interface MatchStream {
  meta: SourceMeta | null;
  state: MatchState | null;
  events: MatchEvent[];
  probSeries: ReturnType<typeof foldProbSeries>;
  feedNow: number;
  connected: boolean;
  fault: string | null;
}

export function useMatchStream(
  fixtureId: number,
  opts: { mode?: string | null; speed?: string | null; restart?: boolean } = {}
): MatchStream {
  const eventsRef = useRef<Map<number, MatchEvent>>(new Map());
  const oddsRef = useRef<Map<string, OddsUpdate>>(new Map());
  const [version, setVersion] = useState(0);
  const [meta, setMeta] = useState<SourceMeta | null>(null);
  const [feedNow, setFeedNow] = useState(0);
  const [connected, setConnected] = useState(false);
  const [fault, setFault] = useState<string | null>(null);

  useEffect(() => {
    // Reset accumulators when the target changes.
    eventsRef.current = new Map();
    oddsRef.current = new Map();
    setVersion(0);
    setMeta(null);
    setFeedNow(0);
    setFault(null);

    const params = new URLSearchParams();
    if (opts.mode) params.set("mode", opts.mode);
    if (opts.speed) params.set("speed", opts.speed);
    if (opts.restart) params.set("restart", "1");
    const qs = params.toString();
    const es = new EventSource(`/api/stream/${fixtureId}${qs ? `?${qs}` : ""}`);

    // Coalesce bursts into at most ~8 re-renders per second.
    let dirty = false;
    const flushTimer = setInterval(() => {
      if (dirty) {
        dirty = false;
        setVersion((v) => v + 1);
      }
    }, 120);

    const addEvent = (e: MatchEvent) => {
      eventsRef.current.set(e.seq, e);
      dirty = true;
    };
    const addOdds = (o: OddsUpdate) => {
      oddsRef.current.set(o.messageId ?? `${o.ts}:${o.prices.join(",")}`, o);
      dirty = true;
    };

    es.addEventListener("meta", (ev) => {
      const m = JSON.parse((ev as MessageEvent).data) as SourceMeta;
      setMeta(m);
      setFeedNow(m.virtualNow);
      setConnected(true);
      setFault(null);
    });
    es.addEventListener("backfill", (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data) as {
        events: MatchEvent[];
        odds: OddsUpdate[];
      };
      payload.events.forEach(addEvent);
      payload.odds.forEach(addOdds);
      setVersion((v) => v + 1);
    });
    es.addEventListener("match", (ev) => addEvent(JSON.parse((ev as MessageEvent).data)));
    es.addEventListener("odds", (ev) => addOdds(JSON.parse((ev as MessageEvent).data)));
    es.addEventListener("clock", (ev) => {
      const { feedNow: t } = JSON.parse((ev as MessageEvent).data) as { feedNow: number };
      setFeedNow(t);
    });
    es.addEventListener("fault", (ev) => {
      const { message } = JSON.parse((ev as MessageEvent).data) as { message: string };
      setFault(message);
    });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    return () => {
      clearInterval(flushTimer);
      es.close();
    };
    // opts.restart is only meaningful on first mount of a target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId, opts.mode, opts.speed]);

  const events = useMemo(
    () => [...eventsRef.current.values()].sort((a, b) => a.seq - b.seq),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );
  const odds = useMemo(
    () => [...oddsRef.current.values()].sort((a, b) => a.ts - b.ts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const state = useMemo(
    () => (events.length > 0 ? foldMatch(events, { feedNow: feedNow || undefined }) : null),
    [events, feedNow]
  );
  const probSeries = useMemo(() => foldProbSeries(odds), [odds]);

  return { meta, state, events, probSeries, feedNow, connected, fault };
}

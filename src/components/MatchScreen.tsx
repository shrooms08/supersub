"use client";

// The Match screen: the product. Scoreboard, the win probability curve,
// the team picker, ENTER THE PITCH, on-the-pitch provisional points with
// VAR rollback, and the full-time resolution takeover.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMatchStream } from "@/hooks/useMatchStream";
import { getUserId } from "@/lib/identity";
import { fetchEntry, postEnter, postResolve, type EntryRow } from "@/lib/entry";
import { fmtMultiplier, fmtPct } from "@/lib/format";
import { probAt, teamProb } from "@/lib/state/winprob";
import { multiplierForProb, scoreWindow } from "@/lib/state/scoring";
import { Scoreboard } from "./Scoreboard";
import { WinProbChart } from "./WinProbChart";
import { EventTicker } from "./EventTicker";
import { TeamPicker } from "./TeamPicker";
import { EnterCta } from "./EnterCta";
import { OnPitchPanel } from "./OnPitchPanel";
import { ResolutionOverlay } from "./ResolutionOverlay";

export function MatchScreen({
  fixtureId,
  mode,
  speed,
}: {
  fixtureId: number;
  mode: string | null;
  speed: string | null;
}) {
  const stream = useMatchStream(fixtureId, { mode, speed });
  const { meta, state, probSeries, feedNow } = stream;

  const [userId, setUserId] = useState<string | null>(null);
  const [entry, setEntry] = useState<EntryRow | null>(null);
  const [entryLoaded, setEntryLoaded] = useState(false);
  const [selected, setSelected] = useState<1 | 2>(1);
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [varBanner, setVarBanner] = useState(false);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  // Restore an existing entry on reload.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchEntry(userId, fixtureId).then((row) => {
      if (cancelled) return;
      if (row) {
        setEntry(row);
        setSelected(row.team);
      }
      setEntryLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, fixtureId]);

  const team: 1 | 2 = entry ? entry.team : selected;
  const phase = state?.phase ?? "upcoming";

  // Current market read for the chosen team.
  const lastTick = probSeries.length > 0 ? probSeries[probSeries.length - 1] : null;
  const prob = lastTick ? teamProb(lastTick, team) : null;
  const previewMultiplier = prob !== null ? multiplierForProb(prob) : null;

  // CTA pulse when the market swung more than 10 points inside 2 minutes.
  const swinging = useMemo(() => {
    if (!lastTick || feedNow === 0) return false;
    const before = probAt(probSeries, feedNow - 120_000);
    if (!before) return false;
    return Math.abs(teamProb(lastTick, team) - teamProb(before, team)) > 0.1;
  }, [probSeries, lastTick, feedNow, team]);

  // Provisional scoring while on the pitch; the same pure function the
  // server uses at resolution, so a VAR overturn rolls it back on its own.
  const provisional = useMemo(() => {
    if (!entry || !state) return null;
    return scoreWindow(
      {
        team: entry.team,
        entryFeedTs: entry.entry_feed_ts,
        scoreTeamAtEntry: entry.score_team_at_entry,
        scoreOppAtEntry: entry.score_opp_at_entry,
      },
      state,
      { settled: phase === "finished" }
    );
  }, [entry, state, phase]);

  // VAR watch: a goal id flipping to discarded triggers the overturn
  // banner once.
  const seenDiscarded = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!state) return;
    for (const c of state.countables) {
      if (c.kind === "goal" && c.discarded && !seenDiscarded.current.has(c.id)) {
        seenDiscarded.current.add(c.id);
        // Only flash after the backfill settled, so a mid-match join does
        // not replay old drama as if it just happened.
        if (state.eventCount > 0 && feedNow - c.ts < 15 * 60_000 * (meta?.speed ?? 1)) {
          setVarBanner(true);
          window.setTimeout(() => setVarBanner(false), 5_200);
        }
      }
    }
  }, [state, feedNow, meta?.speed]);

  const enter = useCallback(async () => {
    if (!userId || entering) return;
    setEntering(true);
    setEnterError(null);
    const res = await postEnter({
      userId,
      fixtureId,
      team,
      mode,
      speed,
      feedTs: feedNow || undefined,
    });
    setEntering(false);
    if (res.entry) {
      setEntry(res.entry);
      setSelected(res.entry.team);
    } else {
      setEnterError(res.error ?? "Could not get you on. Try again.");
    }
  }, [userId, entering, fixtureId, team, mode, speed, feedNow]);

  // Resolution at the derived whistle: idempotent, retried while the
  // source settles.
  const resolveInFlight = useRef(false);
  const resolve = useCallback(async () => {
    if (!userId || !entry || entry.resolved_at || resolveInFlight.current) return;
    resolveInFlight.current = true;
    setResolving(true);
    setResolveError(null);
    const res = await postResolve({ userId, fixtureId, mode: mode ?? entry.mode });
    setResolving(false);
    resolveInFlight.current = false;
    if (res.entry?.resolved_at) {
      setEntry(res.entry);
    } else if (res.status === 409) {
      // The server's fold has not called full time yet; ask again shortly.
      window.setTimeout(() => void resolve(), 4_000);
    } else {
      setResolveError(res.error ?? "Could not settle the score.");
    }
  }, [userId, entry, fixtureId, mode]);

  useEffect(() => {
    if (phase === "finished" && entry && !entry.resolved_at) void resolve();
  }, [phase, entry, resolve]);

  const disabledReason =
    phase === "upcoming"
      ? "The whistle has not gone yet. Hold your run."
      : phase === "finished"
        ? "Full time. The bench is closed."
        : prob === null
          ? "Waiting on the market."
          : null;

  if (!meta || !state) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6">
        <Link href="/" className="whisper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt">
          &lsaquo; Back to the bench
        </Link>
        <div className="h-20 animate-pulse rounded-lg border border-pitch-700 bg-pitch-850" />
        <div className="h-56 animate-pulse rounded-lg border border-pitch-700 bg-pitch-850" />
        <div className="h-32 animate-pulse rounded-lg border border-pitch-700 bg-pitch-850" />
        {stream.fault && (
          <p className="text-center text-sm text-chalk-400">Feed trouble: {stream.fault}</p>
        )}
      </main>
    );
  }

  const fixture = meta.fixture;
  const kickoffTs = fixture.startTime;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6 lg:max-w-4xl">
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="whisper rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
        >
          &lsaquo; The bench
        </Link>
        <p className="whisper">
          {meta.mode === "replay" ? `Replay ${meta.speed}x` : "Live feed"}
          {!stream.connected && " · reconnecting"}
        </p>
      </header>

      {stream.fault && (
        <p role="status" className="rounded-md border border-pitch-600 bg-pitch-850 px-3 py-2 text-xs text-chalk-400">
          Feed hiccup: {stream.fault}
        </p>
      )}

      <Scoreboard fixture={fixture} state={state} feedNow={feedNow} replay={meta.mode === "replay"} />

      <section aria-label="Win probability" className="rounded-lg border border-pitch-600 bg-pitch-850 p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="whisper">
              P({team === 1 ? fixture.participant1 : fixture.participant2} win)
            </p>
            <p className="hero-number text-6xl leading-none text-volt sm:text-7xl" aria-live="polite">
              {prob !== null ? fmtPct(prob) : "--"}
              <span className="text-3xl sm:text-4xl">%</span>
            </p>
          </div>
          <div className="pb-1 text-right">
            <p className="whisper">{entry ? "Your multiplier" : "Multiplier on offer"}</p>
            <p className={`hero-number text-4xl sm:text-5xl ${entry ? "text-chalk-50" : "text-chalk-100"}`}>
              {entry
                ? fmtMultiplier(entry.multiplier)
                : previewMultiplier !== null
                  ? fmtMultiplier(previewMultiplier)
                  : "--"}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <WinProbChart
            series={probSeries}
            team={team}
            kickoffTs={kickoffTs}
            feedNow={feedNow}
            entry={
              entry
                ? {
                    ts: entry.entry_feed_ts,
                    prob: entry.win_prob_at_entry,
                    minute: entry.entry_minute,
                  }
                : null
            }
          />
        </div>
        {lastTick?.suspended && (
          <p className="whisper mt-2 text-center">Market suspended. Holding the last price.</p>
        )}
      </section>

      {entryLoaded && !entry && (
        <section aria-label="Enter the pitch" className="flex flex-col gap-4 rounded-lg border border-pitch-600 bg-pitch-850 p-4">
          <p className="text-sm text-chalk-300">
            You are on the bench. Pick your side, pick your moment. The worse it looks when you
            step on, the bigger the multiplier you carry.
          </p>
          <TeamPicker fixture={fixture} selected={selected} onSelect={setSelected} locked={false} />
          <EnterCta
            prob={prob}
            multiplier={previewMultiplier}
            disabled={disabledReason !== null}
            disabledReason={disabledReason}
            swinging={swinging}
            busy={entering}
            onEnter={() => void enter()}
          />
          {enterError && (
            <p role="alert" className="text-center text-sm text-chalk-300">
              {enterError}
            </p>
          )}
        </section>
      )}

      {entry && provisional && phase !== "finished" && (
        <OnPitchPanel entry={entry} provisional={provisional} varBanner={varBanner} />
      )}

      <EventTicker items={state.ticker} fixture={fixture} />

      {phase === "finished" && entry && (
        <ResolutionOverlay
          entry={entry}
          resolving={resolving || (!entry.resolved_at && !resolveError)}
          error={resolveError}
          onRetry={() => void resolve()}
        />
      )}

      {phase === "finished" && entryLoaded && !entry && (
        <section className="rounded-lg border border-pitch-600 bg-pitch-850 p-6 text-center">
          <p className="font-display text-xl font-black uppercase tracking-widest text-chalk-50">
            Full time
          </p>
          <p className="mt-2 text-sm text-chalk-400">
            You never came off the bench. The gaffer noticed.
          </p>
        </section>
      )}
    </main>
  );
}

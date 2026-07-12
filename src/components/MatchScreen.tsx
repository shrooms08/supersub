"use client";

// The Match screen: the product. Scoreboard, the win probability curve,
// the team picker, ENTER THE PITCH, on-the-pitch provisional points with
// VAR rollback, and the full-time resolution takeover.
//
// Identity is the signed player cookie; a visitor without a player can
// watch, but the pitch is for contracted players only.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMatchStream } from "@/hooks/useMatchStream";
import { fetchEntry, postEnter, postResolve, type EntryRow } from "@/lib/entry";
import { fetchPlayerSummary, type PlayerRow } from "@/lib/player";
import { fmtMultiplier, fmtPct } from "@/lib/format";
import { tierForMultiplier } from "@/lib/config/scoring";
import { probAt, teamProb } from "@/lib/state/winprob";
import { stateMinute } from "@/lib/state/fold";
import { finalPoints, multiplierForProb, scoreWindow } from "@/lib/state/scoring";
import { Scoreboard, shootoutNote } from "./Scoreboard";
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
  clean = false,
}: {
  fixtureId: number;
  mode: string | null;
  speed: string | null;
  clean?: boolean;
}) {
  // The replay timeline anchor: minted once per browser tab, persisted in
  // sessionStorage, sent on every stream/enter/resolve call. Each tab gets
  // its own timeline; a refresh resumes exactly where the match was, even
  // if the request lands on a different server instance. Harmless in live
  // mode (ignored server-side).
  const [anchor] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const key = `supersub:replay-anchor:${fixtureId}`;
    const stored = window.sessionStorage.getItem(key);
    if (stored && Number.isFinite(Number(stored))) return Number(stored);
    const minted = Date.now();
    window.sessionStorage.setItem(key, String(minted));
    return minted;
  });

  const stream = useMatchStream(fixtureId, { mode, speed, anchor });
  const { meta, state, scoringState, probSeries, feedNow } = stream;

  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [entry, setEntry] = useState<EntryRow | null>(null);
  const [entryLoaded, setEntryLoaded] = useState(false);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [selected, setSelected] = useState<1 | 2>(1);
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [varBanner, setVarBanner] = useState(false);

  // Resolved player names for the ticker, from the Match Detail resolver
  // (the same server that powers /match/[id]/report). Fetched on mount
  // and refreshed at 45s so a live match picks up new names; the ticker
  // falls back to team-only where the roster does not resolve.
  const [tickerNames, setTickerNames] = useState<
    Record<number, { playerName?: string | null; secondaryName?: string | null }>
  >({});
  useEffect(() => {
    let cancelled = false;
    const NAMED = new Set(["goal", "var_overturn", "yellow_card", "red_card", "substitution"]);
    const load = async () => {
      try {
        const res = await fetch(`/api/match-timeline/${fixtureId}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          timeline: { events: Array<{ id?: number; kind: string; playerName?: string | null; secondaryName?: string | null }> } | null;
        };
        if (cancelled || !body.timeline) return;
        const map: Record<number, { playerName?: string | null; secondaryName?: string | null }> = {};
        for (const e of body.timeline.events) {
          if (e.id != null && NAMED.has(e.kind)) {
            map[e.id] = { playerName: e.playerName ?? null, secondaryName: e.secondaryName ?? null };
          }
        }
        if (!cancelled) setTickerNames(map);
      } catch {
        // names are enrichment; a miss just keeps the team-only rows
      }
    };
    void load();
    const t = setInterval(() => void load(), 45_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [fixtureId]);

  useEffect(() => {
    let cancelled = false;
    fetchPlayerSummary().then((s) => {
      if (cancelled) return;
      setPlayer(s.player);
      setPlayerLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore an existing entry on reload.
  useEffect(() => {
    if (!playerLoaded) return;
    if (!player) {
      setEntryLoaded(true);
      return;
    }
    let cancelled = false;
    fetchEntry(fixtureId).then((row) => {
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
  }, [playerLoaded, player, fixtureId]);

  const team: 1 | 2 = entry ? entry.team : selected;
  const phase = state?.phase ?? "upcoming";

  // Current market read for the chosen team.
  const lastTick = probSeries.length > 0 ? probSeries[probSeries.length - 1] : null;
  const prob = lastTick ? teamProb(lastTick, team) : null;
  const previewMultiplier = prob !== null ? multiplierForProb(prob) : null;

  // Swing since kickoff for the ticker footer: peak/low/now of the
  // chosen team's probability, plus the multiplier on offer.
  const swingStats = useMemo(() => {
    if (probSeries.length === 0 || prob === null || previewMultiplier === null) return null;
    let peak = 0;
    let low = 1;
    for (const t of probSeries) {
      const v = teamProb(t, team);
      if (v > peak) peak = v;
      if (v < low) low = v;
    }
    return { peak, low, now: prob, mult: fmtMultiplier(previewMultiplier) };
  }, [probSeries, prob, previewMultiplier, team]);

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
    if (!entry || !scoringState) return null;
    // Scored against the regulation fold: windows settle at the
    // regulation whistle, so extra time never moves this number.
    return scoreWindow(
      {
        team: entry.team,
        entryFeedTs: entry.entry_feed_ts,
        scoreTeamAtEntry: entry.score_team_at_entry,
        scoreOppAtEntry: entry.score_opp_at_entry,
      },
      scoringState,
      { settled: phase === "finished" }
    );
  }, [entry, scoringState, phase]);

  // VAR watch: a goal id flipping to discarded triggers the overturn
  // banner once.
  const seenDiscarded = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!state) return;
    for (const c of state.countables) {
      if (c.kind === "goal" && c.discarded && !seenDiscarded.current.has(c.id)) {
        seenDiscarded.current.add(c.id);
        if (state.eventCount > 0 && feedNow - c.ts < 15 * 60_000 * (meta?.speed ?? 1)) {
          setVarBanner(true);
          window.setTimeout(() => setVarBanner(false), 5_200);
        }
      }
    }
  }, [state, feedNow, meta?.speed]);

  const enter = useCallback(async () => {
    if (!player || entering) return;
    setEntering(true);
    setEnterError(null);
    const res = await postEnter({ fixtureId, team, mode, speed, feedTs: feedNow || undefined, anchor });
    setEntering(false);
    if (res.entry) {
      setEntry(res.entry);
      setSelected(res.entry.team);
    } else {
      setEnterError(res.error ?? "Could not get you on. Try again.");
    }
  }, [player, entering, fixtureId, team, mode, speed, feedNow, anchor]);

  // Resolution at the derived whistle: idempotent, retried while the
  // source settles.
  const resolveInFlight = useRef(false);
  const resolve = useCallback(async () => {
    if (!player || !entry || entry.resolved_at || resolveInFlight.current) return;
    resolveInFlight.current = true;
    setResolving(true);
    setResolveError(null);
    const res = await postResolve({
      fixtureId,
      mode: mode ?? entry.mode,
      anchor,
      speed: meta?.speed ?? null,
    });
    setResolving(false);
    resolveInFlight.current = false;
    if (res.entry?.resolved_at) {
      setEntry(res.entry);
      setNewBadges(res.newBadges ?? []);
    } else if (res.status === 409) {
      // The server's fold has not called full time yet; ask again shortly.
      window.setTimeout(() => void resolve(), 4_000);
    } else {
      setResolveError(res.error ?? "Could not settle the score.");
    }
  }, [player, entry, fixtureId, mode, anchor, meta?.speed]);

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
        <Link href="/" className="whisper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50">
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
          className="whisper rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          &lsaquo; The bench
        </Link>
        {!clean && (
          <p className="whisper">
            {meta.mode === "replay" ? `Replay ${meta.speed}x` : "Live feed"}
            {!stream.connected && " · reconnecting"}
          </p>
        )}
      </header>

      {stream.fault && (
        <p role="status" className="rounded-md border border-pitch-600 bg-pitch-850 px-3 py-2 text-xs text-chalk-400">
          Feed hiccup: {stream.fault}
        </p>
      )}

      {/* One sticky stack: the broadcast bug, and beneath it (never
          overlapping) your window strip while you are on the pitch. */}
      <div className="sticky top-2 z-40 flex flex-col gap-2">
        <Scoreboard fixture={fixture} state={state} feedNow={feedNow} replay={meta.mode === "replay"} />
        {entry && provisional && phase === "live" && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-pitch-500 bg-pitch-900/95 px-3 py-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] backdrop-blur-sm"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="hero-number text-lg leading-none text-chalk-50">
                {player?.shirt_number ?? entry.team}
              </span>
              <span className="label truncate !text-chalk-300">
                On {entry.entry_minute}&apos; · was {fmtPct(entry.win_prob_at_entry)}%
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="hero-number text-2xl leading-none text-volt">
                {finalPoints(provisional.windowPoints, entry.multiplier)}
              </span>
              <span className="whisper ml-1.5">Provisional</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.65fr_1fr] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
      <section aria-label="Win probability" className="panel !rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500">
            Live win probability
          </p>
          <p className="flex items-baseline gap-2">
            <span className="font-label text-[9px] font-semibold uppercase tracking-[0.12em] text-chalk-400">
              {team === 1 ? fixture.participant1 : fixture.participant2}
            </span>
            <span className="hero-number text-[22px] leading-none text-chalk-50" aria-live="polite">
              {prob !== null ? `${fmtPct(prob)}%` : "--"}
            </span>
            {swinging && (
              <span className="font-label text-[9px] font-bold uppercase text-chalk-500">
                &#9660; Swinging
              </span>
            )}
          </p>
        </div>
        <div className="mt-3">
          <WinProbChart
            series={probSeries}
            team={team}
            kickoffTs={kickoffTs}
            feedNow={feedNow}
            nowMinute={state ? stateMinute(state, feedNow) : undefined}
            entry={
              entry
                ? {
                    ts: entry.entry_feed_ts,
                    prob: entry.win_prob_at_entry,
                    minute: entry.entry_minute,
                    shirtNumber: player?.shirt_number,
                  }
                : null
            }
          />
        </div>
        {lastTick?.suspended && (
          <p className="whisper mt-2 text-center">Market suspended. Holding the last price.</p>
        )}
      </section>

      {playerLoaded && !player && phase !== "finished" && (
        <section className="panel p-5 text-center">
          <p className="text-sm text-chalk-300">
            You can watch from the stands, but the pitch is for contracted players.
          </p>
          <Link
            href="/"
            className="mt-3 inline-block min-h-[44px] rounded-md border border-chalk-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
          >
            Sign your forms
          </Link>
        </section>
      )}

      {player && entryLoaded && !entry && (
        <section aria-label="Enter the pitch" className="panel flex flex-col gap-4 p-4">
          <p className="text-sm text-chalk-300">
            You are on the bench, {player.name}. Pick your side, pick your moment. The worse it
            looks when you step on, the bigger the multiplier you carry.
          </p>
          <TeamPicker fixture={fixture} selected={selected} onSelect={setSelected} locked={false} />
          <EnterCta
            teamName={team === 1 ? fixture.participant1 : fixture.participant2}
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
        <OnPitchPanel
          entry={entry}
          provisional={provisional}
          varBanner={varBanner}
          shirtNumber={player?.shirt_number}
        />
      )}
      </div>

      <EventTicker
        items={state.ticker}
        fixture={fixture}
        live={phase === "live"}
        swing={phase === "live" ? swingStats : null}
        names={tickerNames}
      />
      </div>

      {phase === "finished" && entry && (
        <ResolutionOverlay
          entry={entry}
          newBadges={newBadges}
          resolving={resolving || (!entry.resolved_at && !resolveError)}
          error={resolveError}
          onRetry={() => void resolve()}
          knockout={Boolean(state?.wentToExtraTime || state?.shootout)}
          resultNote={shootoutNote(state?.shootout ?? null, fixture.participant1, fixture.participant2)}
        />
      )}

      {phase === "finished" && entryLoaded && !entry && (
        <section className="panel p-6 text-center">
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

"use client";

// The Bench: today's and upcoming fixtures as cards. It exists to reach
// the Match screen; one tap on a live (or replaying) card and you are in
// the tunnel.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PhaseBadge } from "@/components/PhaseBadge";
import { fmtKickoffUtc } from "@/lib/format";
import type { FixtureListing } from "@/lib/sources/types";

interface FixturesResponse {
  mode: "replay" | "live";
  fixtures: FixtureListing[];
  error?: string;
}

function BenchInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const speed = searchParams.get("speed");
  const [data, setData] = useState<FixturesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/fixtures${mode ? `?mode=${mode}` : ""}`, {
          cache: "no-store",
        });
        const body = (await res.json()) as FixturesResponse;
        if (cancelled) return;
        if (!res.ok) setError(body.error ?? `HTTP ${res.status}`);
        else {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mode]);

  const matchHref = (fixtureId: number) => {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    if (speed) params.set("speed", speed);
    const qs = params.toString();
    return `/match/${fixtureId}${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-chalk-50">
          Super Sub
        </h1>
        <p className="text-sm text-chalk-400">
          You are the substitute. Pick your moment, enter the pitch, and everything
          after the board goes up is yours.
        </p>
        {data && <p className="whisper mt-1">Feed: {data.mode} mode</p>}
      </header>

      <section aria-label="Fixtures" className="flex flex-col gap-3">
        {!data && !error && (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg border border-pitch-700 bg-pitch-850"
              />
            ))}
          </>
        )}

        {error && (
          <div className="rounded-lg border border-pitch-600 bg-pitch-850 p-4">
            <p className="text-sm text-chalk-300">The feed is down: {error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-md border border-chalk-600 px-3 py-2 text-sm font-semibold text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
            >
              Try again
            </button>
          </div>
        )}

        {data && data.fixtures.length === 0 && (
          <div className="rounded-lg border border-pitch-700 bg-pitch-850 p-6 text-center">
            <p className="text-sm text-chalk-300">Nothing on the fixture list right now.</p>
            <p className="whisper mt-2">
              {data.mode === "live"
                ? "Check back closer to kickoff."
                : "Add a replay bundle under data/replay to warm up."}
            </p>
          </div>
        )}

        {data?.fixtures.map(({ fixture, phase, mode: fxMode }) => {
          const playable = phase === "live" || fxMode === "replay";
          const inner = (
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate text-lg font-bold text-chalk-50">
                  {fixture.participant1}
                  <span className="px-2 font-normal text-chalk-500">v</span>
                  {fixture.participant2}
                </p>
                <p className="whisper">
                  {fixture.competition || "Football"} · {fmtKickoffUtc(fixture.startTime)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <PhaseBadge phase={phase} replay={fxMode === "replay"} />
                {playable && (
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-chalk-300">
                    {phase === "upcoming" && fxMode === "replay"
                      ? "Kick it off"
                      : phase === "finished" && fxMode === "replay"
                        ? "Watch back"
                        : "In the tunnel"}
                    <span aria-hidden> &rsaquo;</span>
                  </span>
                )}
              </div>
            </div>
          );
          return playable ? (
            <Link
              key={fixture.fixtureId}
              href={matchHref(fixture.fixtureId)}
              className="rounded-lg border border-pitch-600 bg-pitch-850 transition-colors hover:border-chalk-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={fixture.fixtureId}
              className="rounded-lg border border-pitch-700 bg-pitch-900 opacity-70"
            >
              {inner}
            </div>
          );
        })}
      </section>
    </main>
  );
}

export default function BenchPage() {
  return (
    <Suspense>
      <BenchInner />
    </Suspense>
  );
}

"use client";

// The Bench: the matchday hub. Masthead, your kit card, the slate of
// fixtures, the table of every player in the instance, the legendary
// entries, and the on-chain tease. Single column on a phone, two columns
// at desktop (kit card and table in the left rail, fixtures and legends
// in the main channel). First visit runs signing day.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Masthead } from "@/components/Masthead";
import { PlayerCard } from "@/components/PlayerCard";
import { FixtureCard } from "@/components/FixtureCard";
import { TheTable } from "@/components/TheTable";
import { LegendaryEntries } from "@/components/LegendaryEntries";
import { SigningForm } from "@/components/SigningForm";
import { fetchPlayerSummary, type PlayerSummary } from "@/lib/player";
import type { FixtureListing } from "@/lib/sources/types";
import type { MatchdayPayload } from "@/app/api/matchday/route";

interface FixturesResponse {
  mode: "replay" | "live";
  fixtures: FixtureListing[];
  error?: string;
}

function BenchInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const speed = searchParams.get("speed");
  // OBS-friendly capture mode: hides feed/mode chrome.
  const clean = searchParams.get("clean") === "1";
  const [data, setData] = useState<FixturesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PlayerSummary | null>(null);
  const [matchday, setMatchday] = useState<MatchdayPayload | null>(null);

  const loadIdentity = async () => {
    const [s, m] = await Promise.all([
      fetchPlayerSummary(),
      fetch("/api/matchday", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<MatchdayPayload>) : null))
        .catch(() => null),
    ]);
    setSummary(s);
    setMatchday(m);
  };

  useEffect(() => {
    void loadIdentity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (clean) params.set("clean", "1");
    const qs = params.toString();
    return `/match/${fixtureId}${qs ? `?${qs}` : ""}`;
  };

  const player = summary?.player ?? null;
  const liveNow = (data?.fixtures ?? []).some((f) => f.phase === "live");

  // ONE shared 1s clock drives every countdown on the slate (rider: no
  // per-card intervals). It only runs while a real upcoming fixture needs
  // it; replay fixtures are on demand and show no countdown.
  const needsClock = (data?.fixtures ?? []).some(
    (f) => f.phase === "upcoming" && f.mode !== "replay"
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!needsClock) return;
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [needsClock]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6 lg:max-w-5xl">
      <Masthead liveNow={liveNow} dateMs={Date.now()} />
      {data && !clean && <p className="whisper -mt-3">Feed: {data.mode} mode</p>}

      {!summary && (
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <div className="panel-quiet h-56 animate-pulse" />
          <div className="flex flex-col gap-3">
            <div className="panel-quiet h-28 animate-pulse" />
            <div className="panel-quiet h-28 animate-pulse" />
          </div>
        </div>
      )}

      {summary && !player && (
        <div className="mx-auto w-full max-w-2xl">
          <SigningForm
            onSigned={(p) => {
              setSummary({ player: p, appearances: 0, impactRating: null, played: {} });
              void loadIdentity();
            }}
          />
        </div>
      )}

      {player && (
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          {/* Left rail on desktop; interleaved by order on mobile */}
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
            <div className="order-1 lg:order-none">
              <PlayerCard
                player={player}
                appearances={summary?.appearances ?? 0}
                impactRating={summary?.impactRating ?? null}
                form={matchday?.you?.form ?? []}
                nextBadge={matchday?.you?.nextBadge ?? null}
              />
            </div>
            <div className="order-3 lg:order-none">
              <TheTable rows={matchday?.table ?? []} />
            </div>
          </div>

          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
            <section aria-label="The slate" className="order-2 flex flex-col gap-3 lg:order-none">
              <div className="flex items-baseline justify-between">
                <h2 className="label">The slate</h2>
                <p className="whisper">
                  {data ? `${data.fixtures.length} fixture${data.fixtures.length === 1 ? "" : "s"} listed` : "Checking the board"}
                </p>
              </div>

              {!data && !error && (
                <>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="panel-quiet h-28 animate-pulse" />
                  ))}
                </>
              )}

              {error && (
                <div className="panel p-4">
                  <p className="font-display text-sm font-black uppercase tracking-wide text-chalk-100">
                    The feed is down
                  </p>
                  <p className="mt-1 text-sm text-chalk-400">{error}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-3 min-h-[44px] rounded-md border border-chalk-600 px-3 py-2 text-sm font-semibold text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
                  >
                    Raise the fourth official
                  </button>
                </div>
              )}

              {data && data.fixtures.length === 0 && (
                <div className="panel-quiet px-4 py-6 text-center">
                  <p className="font-display text-sm font-black uppercase tracking-wide text-chalk-300">
                    Empty tunnel
                  </p>
                  <p className="mt-1.5 text-sm text-chalk-400">
                    Nothing on the slate right now.
                  </p>
                  <p className="whisper mt-1.5">
                    {data.mode === "live"
                      ? "Team news lands closer to kickoff."
                      : "Add a replay bundle under data/replay and it appears here."}
                  </p>
                </div>
              )}

              {data?.fixtures.map((listing) => (
                <FixtureCard
                  key={listing.fixture.fixtureId}
                  listing={listing}
                  result={matchday?.you?.results[listing.fixture.fixtureId] ?? null}
                  href={matchHref(listing.fixture.fixtureId)}
                  now={now}
                />
              ))}
            </section>

            <div className="order-4 lg:order-none">
              <LegendaryEntries rows={matchday?.legendary ?? []} />
            </div>
          </div>
        </div>
      )}

      <footer className="mt-1 flex flex-col items-center gap-1 border-t border-pitch-700 pb-2 pt-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-xs text-chalk-400">
          <span className="font-display text-[11px] font-black uppercase tracking-[0.18em] text-chalk-300">
            Claim your legend
          </span>
          <span className="ml-2 rounded-sm bg-pitch-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-chalk-400">
            Coming soon
          </span>
        </p>
        <p className="text-xs text-chalk-500">
          Mint your career on Solana when the tournament ends.
        </p>
      </footer>
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

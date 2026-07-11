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
  const liveFixtures = (data?.fixtures ?? []).filter((f) => f.phase === "live");
  const liveNow = liveFixtures.length > 0;

  // Banner mini stats, derived from the matchday results map (no API
  // change: every value is already served).
  const myResults = Object.values(matchday?.you?.results ?? {});
  const totalPoints = myResults.length
    ? myResults.reduce((sum, r) => sum + r.points, 0)
    : null;
  const averageMultiplier = myResults.length
    ? myResults.reduce((sum, r) => sum + r.multiplier, 0) / myResults.length
    : null;

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

  // First run (or any playerless visit) lands on Signing Day, not the
  // hub: the ceremony takes the whole screen, tunnel-quiet, no slate.
  if (summary && !player) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10">
        <SigningForm
          onSigned={(p) => {
            setSummary({ player: p, appearances: 0, impactRating: null, played: {} });
            void loadIdentity();
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6 lg:max-w-5xl">
      <Masthead
        liveNow={liveNow}
        liveCount={liveFixtures.length}
        fixtureCount={data ? data.fixtures.length : null}
        dateMs={Date.now()}
      />
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

      {player && (
        <>
          <PlayerCard
            player={player}
            appearances={summary?.appearances ?? 0}
            impactRating={summary?.impactRating ?? null}
            form={matchday?.you?.form ?? []}
            nextBadge={matchday?.you?.nextBadge ?? null}
            totalPoints={totalPoints}
            averageMultiplier={averageMultiplier}
          />

          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.55fr_1fr] lg:items-start">
            <div className="flex min-w-0 flex-col gap-5">
              <section aria-label="The slate" className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-chalk-500">
                    Today&apos;s fixtures
                  </h2>
                  <p className="font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-chalk-600">
                    {data ? `${data.fixtures.length} listed` : "Checking the board"}
                  </p>
                </div>

                {!data && !error && (
                  <>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="panel-quiet h-28 animate-pulse !rounded-[14px]" />
                    ))}
                  </>
                )}

                {error && (
                  <div className="panel !rounded-[14px] p-4">
                    <p className="hero-number text-sm uppercase tracking-wide text-chalk-100">
                      The feed is down
                    </p>
                    <p className="mt-1 font-label text-sm text-chalk-400">{error}</p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="mt-3 min-h-[44px] rounded-md border border-chalk-600 px-3 py-2 font-label text-sm font-semibold text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
                    >
                      Raise the fourth official
                    </button>
                  </div>
                )}

                {data && data.fixtures.length === 0 && (
                  <div className="panel-quiet !rounded-[14px] px-4 py-6 text-center">
                    <p className="hero-number text-sm uppercase tracking-wide text-chalk-300">
                      Empty tunnel
                    </p>
                    <p className="mt-1.5 font-label text-sm text-chalk-400">
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

              <LegendaryEntries rows={matchday?.legendary ?? []} />
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <TheTable rows={matchday?.table ?? []} />

              <div
                className="rounded-[14px] p-4 text-center"
                style={{
                  border: "1px dashed rgba(200,255,0,.35)",
                  background: "linear-gradient(180deg, rgba(200,255,0,.05), transparent)",
                }}
              >
                <p className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-volt">
                  Coming at full time
                </p>
                <p className="hero-number mt-1.5 text-2xl uppercase leading-none text-chalk-50">
                  Claim your legend
                </p>
                <p className="mt-1.5 font-label text-[10px] leading-relaxed text-chalk-400">
                  Mint your career, appearances, badges and match reports, permanently on
                  Solana when the tournament ends.
                </p>
                <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-[20px] border border-white/10 px-3 py-[7px] font-label text-[9px] font-bold uppercase tracking-[0.14em] text-chalk-600">
                  &#9678; Solana · Locked until FT
                </p>
              </div>
            </div>
          </div>
        </>
      )}


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

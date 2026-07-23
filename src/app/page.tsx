"use client";

// The Bench: the matchday hub. Masthead, your kit card, then the real
// World Cup board in four bands (TODAY, COMING UP, RESULTS, and the
// bundled REPLAYS rail), the table of every player, the legendary
// entries, and the on-chain tease. Single column on a phone, two
// columns at desktop. First visit runs signing day.
//
// Fixtures come from /api/schedule (real schedule plus canonical result
// scores, read-only). The three bundled replays always show in their
// own rail even if the live feed is down: they are the judges' path.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Masthead } from "@/components/Masthead";
import { PlayerCard } from "@/components/PlayerCard";
import { FixtureCard, type FixtureFinal } from "@/components/FixtureCard";
import { TheTable } from "@/components/TheTable";
import { LegendaryEntries } from "@/components/LegendaryEntries";
import { SigningForm } from "@/components/SigningForm";
import { ResumeGate } from "@/components/ResumeGate";
import { ClaimLegend } from "@/components/ClaimLegend";
import { teamCode } from "@/components/Scoreboard";
import { fetchPlayerSummary, type PlayerSummary } from "@/lib/player";
import type { Fixture, Phase } from "@/lib/feed/types";
import type { FixtureListing } from "@/lib/sources/types";
import type { MatchdayPayload } from "@/app/api/matchday/route";
import type { ScheduleResponse } from "@/app/api/schedule/route";
import type { ResultFixture } from "@/lib/server/schedule";

function pensNote(fixture: Fixture, pens: { p1: number; p2: number } | null): string | null {
  if (!pens || pens.p1 === pens.p2) return null;
  const winner = pens.p1 > pens.p2 ? fixture.participant1 : fixture.participant2;
  return `${teamCode(winner)} advanced on penalties ${Math.max(pens.p1, pens.p2)}-${Math.min(
    pens.p1,
    pens.p2
  )}`;
}

// Shape of one page from /api/results (the paginated tournament history).
interface ResultDayData {
  key: number;
  date: string;
  label: string;
  fixtures: ResultFixture[];
}
interface ResultsResponse {
  page: number;
  days: ResultDayData[];
  hasMore: boolean;
  totalFinished: number;
  totalDays: number;
  error: string | null;
}

function finalFor(fixture: Fixture, r: ResultFixture): FixtureFinal {
  return { score: r.score, note: pensNote(fixture, r.pens) };
}

const asListing = (fixture: Fixture, phase: Phase): FixtureListing => ({
  fixture,
  phase,
  mode: "live",
});

type Tab = "today" | "results" | "upcoming";
const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "results", label: "Results" },
  { key: "upcoming", label: "Upcoming" },
];

// LiveScore-style day header, e.g. "SAT 11 JUL".
function dayHeader(ts: number): string {
  return new Date(ts)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .toUpperCase();
}

function DayHead({ label }: { label: string }) {
  return (
    <p className="mt-1 px-1 font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500">
      {label}
    </p>
  );
}

function TabBar({
  tab,
  onSelect,
  counts,
  live,
}: {
  tab: Tab;
  onSelect: (t: Tab) => void;
  counts: Record<Tab, number>;
  live: boolean;
}) {
  return (
    <div role="tablist" aria-label="Fixtures" className="flex items-stretch gap-1 border-b border-white/[0.08]">
      {TABS.map(({ key, label }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onSelect(key)}
            className={`relative flex-1 px-2 pb-2.5 pt-1 text-center font-label text-[11px] font-bold uppercase tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 ${
              active ? "text-volt" : "text-chalk-500"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {key === "today" && live && (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-volt animate-live-pulse" />
              )}
              {label}
              <span className="text-chalk-600">{counts[key]}</span>
            </span>
            {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-volt" />}
          </button>
        );
      })}
    </div>
  );
}

function BenchInner() {
  const searchParams = useSearchParams();
  const speed = searchParams.get("speed");
  // OBS-friendly capture mode: hides feed/mode chrome.
  const clean = searchParams.get("clean") === "1";
  const [sched, setSched] = useState<ScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PlayerSummary | null>(null);
  const [matchday, setMatchday] = useState<MatchdayPayload | null>(null);

  // Full tournament history for the RESULTS tab, loaded a page of days at a
  // time from /api/results so neither side handles every fixture at once.
  const [resultDays, setResultDays] = useState<ResultDayData[]>([]);
  const [resultsPage, setResultsPage] = useState(0);
  const [resultsHasMore, setResultsHasMore] = useState(false);
  const [resultsTotal, setResultsTotal] = useState<number | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const loadResultsPage = async (page: number) => {
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/results?page=${page}`, { cache: "no-store" });
      const body = (await res.json()) as ResultsResponse;
      setResultsError(body.error);
      setResultsTotal(body.totalFinished);
      setResultsHasMore(body.hasMore);
      setResultsPage(body.page);
      setResultDays((prev) => (page === 0 ? body.days : [...prev, ...body.days]));
    } catch (err) {
      setResultsError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    void loadResultsPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const res = await fetch("/api/schedule", { cache: "no-store" });
        const body = (await res.json()) as ScheduleResponse;
        if (cancelled) return;
        setSched(body);
        setError(null);
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
  }, []);

  // Live fixtures wire ENTER to live mode; replays to replay mode.
  const matchHref = (fixtureId: number, forcedMode: "live" | "replay") => {
    const params = new URLSearchParams();
    params.set("mode", forcedMode);
    if (speed) params.set("speed", speed);
    if (clean) params.set("clean", "1");
    return `/match/${fixtureId}?${params.toString()}`;
  };

  const player = summary?.player ?? null;

  const myResults = Object.values(matchday?.you?.results ?? {});
  const totalPoints = myResults.length ? myResults.reduce((s, r) => s + r.points, 0) : null;
  const averageMultiplier = myResults.length
    ? myResults.reduce((s, r) => s + r.multiplier, 0) / myResults.length
    : null;

  const today = sched?.today ?? [];
  const comingUp = sched?.comingUp ?? [];
  const liveNow = sched?.liveNow ?? false;
  const liveCount = today.filter((f) => f.live).length;
  const upcomingCount = comingUp.reduce((n, g) => n + g.fixtures.length, 0);
  const fixtureCount = sched ? today.length + upcomingCount + (resultsTotal ?? 0) : null;

  // ONE shared 1s clock drives every countdown (rider: no per-card
  // intervals). It runs only while a genuinely upcoming fixture is on
  // the board.
  const needsClock = today.some((f) => f.phase === "upcoming") || upcomingCount > 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!needsClock) return;
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [needsClock]);

  // Live score/minute for the live fixtures, from ONE shared poll (no
  // per-card streams). Cached server-side; refreshed at 40s.
  const liveIdsKey = today
    .filter((f) => f.live)
    .map((f) => f.fixture.fixtureId)
    .join(",");
  const [liveScores, setLiveScores] = useState<
    Record<number, { score: { p1: number; p2: number }; minute: number; label: string | null }>
  >({});
  useEffect(() => {
    if (!liveIdsKey) {
      setLiveScores({});
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/live-scores?ids=${liveIdsKey}`, { cache: "no-store" });
        if (res.ok && !cancelled) setLiveScores(await res.json());
      } catch {
        // a missed poll just leaves the last values; the card stays live
      }
    };
    void poll();
    const t = setInterval(() => void poll(), 40_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [liveIdsKey]);

  // Tab state, mirrored to ?tab= so a link lands on a specific tab.
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    tabParam === "results" || tabParam === "upcoming" ? tabParam : "today"
  );
  const selectTab = (t: Tab) => {
    setTab(t);
    const p = new URLSearchParams(window.location.search);
    p.set("tab", t);
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  };
  // Today with any live match pinned to the top under the volt pulse.
  const todaySorted = [...today].sort(
    (a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || a.fixture.startTime - b.fixture.startTime
  );

  // First run (or any playerless visit) lands on Signing Day. A returning
  // player who claimed on another browser gets a Resume banner above it
  // (inert while the claim feature is dark).
  if (summary && !player) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10">
        <ResumeGate onResumed={() => void loadIdentity()} />
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
        liveCount={liveCount}
        fixtureCount={fixtureCount}
        dateMs={Date.now()}
      />

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
              <section aria-label="Fixtures" className="flex flex-col gap-2.5">
                <TabBar
                  tab={tab}
                  onSelect={selectTab}
                  counts={{ today: today.length, results: resultsTotal ?? 0, upcoming: upcomingCount }}
                  live={liveCount > 0}
                />

                <Link
                  href="/bracket"
                  className="flex items-center justify-between rounded-[12px] border border-pitch-700 bg-pitch-850 px-3.5 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
                >
                  <span className="font-label text-[11px] font-bold uppercase tracking-[0.14em] text-chalk-300">
                    Knockout bracket
                  </span>
                  <span className="font-label text-[11px] font-bold uppercase tracking-[0.14em] text-volt">
                    View &rsaquo;
                  </span>
                </Link>

                {!sched && !error &&
                  [0, 1].map((i) => (
                    <div key={i} className="panel-quiet h-28 animate-pulse !rounded-[14px]" />
                  ))}

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

                {sched && sched.error && (
                  <div className="panel-quiet !rounded-[14px] px-4 py-5 text-center">
                    <p className="hero-number text-sm uppercase tracking-wide text-chalk-300">
                      Schedule feed unavailable
                    </p>
                    <p className="mt-1.5 font-label text-xs text-chalk-500">
                      The bundled replays are always available.
                    </p>
                  </div>
                )}

                {/* TODAY */}
                {sched && tab === "today" && (
                  todaySorted.length === 0 ? (
                    <div className="panel-quiet !rounded-[14px] px-4 py-5 text-center">
                      <p className="hero-number text-sm uppercase tracking-wide text-chalk-300">
                        No matches today
                      </p>
                      <p className="mt-1.5 font-label text-xs text-chalk-500">
                        Check Upcoming for what is next.
                      </p>
                    </div>
                  ) : (
                    todaySorted.map((f) => (
                      <FixtureCard
                        key={f.fixture.fixtureId}
                        listing={asListing(f.fixture, f.phase)}
                        result={matchday?.you?.results[f.fixture.fixtureId] ?? null}
                        href={matchHref(f.fixture.fixtureId, "live")}
                        now={now}
                        final={f.phase === "finished" && "score" in f ? finalFor(f.fixture, f) : undefined}
                        live={f.live ? liveScores[f.fixture.fixtureId] ?? null : undefined}
                        reportHref={
                          f.phase === "finished" && "hasReport" in f && f.hasReport
                            ? `/match/${f.fixture.fixtureId}/report`
                            : undefined
                        }
                      />
                    ))
                  )
                )}

                {/* RESULTS, grouped by day, newest day first */}
                {tab === "results" && (
                  resultDays.length === 0 ? (
                    <div className="panel-quiet !rounded-[14px] px-4 py-5 text-center">
                      <p className="font-label text-sm text-chalk-400">
                        {loadingResults
                          ? "Loading results..."
                          : resultsError
                            ? "Results are unavailable right now."
                            : "No results yet."}
                      </p>
                    </div>
                  ) : (
                    <>
                      {resultDays.map((day) => (
                        <div key={day.key} className="flex flex-col gap-2.5">
                          <DayHead label={day.label} />
                          {day.fixtures.map((f) => (
                            <FixtureCard
                              key={f.fixture.fixtureId}
                              listing={asListing(f.fixture, "finished")}
                              result={matchday?.you?.results[f.fixture.fixtureId] ?? null}
                              href={matchHref(f.fixture.fixtureId, "live")}
                              now={now}
                              final={finalFor(f.fixture, f)}
                              reportHref={f.hasReport ? `/match/${f.fixture.fixtureId}/report` : undefined}
                            />
                          ))}
                        </div>
                      ))}
                      {resultsHasMore && (
                        <button
                          type="button"
                          onClick={() => void loadResultsPage(resultsPage + 1)}
                          disabled={loadingResults}
                          className="panel-quiet !rounded-[14px] px-4 py-3 text-center font-label text-xs font-bold uppercase tracking-[0.14em] text-chalk-300 transition disabled:opacity-60"
                        >
                          {loadingResults ? "Loading..." : "Load older results"}
                        </button>
                      )}
                    </>
                  )
                )}

                {/* UPCOMING, grouped by day */}
                {sched && tab === "upcoming" && (
                  comingUp.length === 0 ? (
                    <div className="panel-quiet !rounded-[14px] px-4 py-5 text-center">
                      <p className="font-label text-sm text-chalk-400">Nothing scheduled yet.</p>
                    </div>
                  ) : (
                    comingUp.map((group) => (
                      <div key={group.date} className="flex flex-col gap-2.5">
                        <DayHead label={dayHeader(group.fixtures[0].fixture.startTime)} />
                        {group.fixtures.map((f) => (
                          <FixtureCard
                            key={f.fixture.fixtureId}
                            listing={asListing(f.fixture, f.phase)}
                            result={null}
                            href={matchHref(f.fixture.fixtureId, "live")}
                            now={now}
                          />
                        ))}
                      </div>
                    ))
                  )
                )}
              </section>

              <LegendaryEntries rows={matchday?.legendary ?? []} />
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <TheTable rows={matchday?.table ?? []} />

              <ClaimLegend
                variant="bench"
                claim={summary?.claim ?? null}
                hasPlayer={Boolean(player)}
                onChanged={() => void loadIdentity()}
              />
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

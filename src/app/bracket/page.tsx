// The knockout bracket view: /bracket. Server-rendered from the cached
// bracket structure; read-only, no entry paths.
//
// Stage names are inferred from fixture counts (documented in bracket.ts),
// never read from the feed. The group stage is not drawn as structure - the
// feed exposes no group letters - so it is a single honest line linking to
// the Results tab.
//
// Layout: the knockout tree is the same data at both widths, laid out by
// one responsive flex container.
//   - Mobile (<lg): flex-col, so rounds STACK vertically. Each round is a
//     section with a sticky header and full-width match cards. This is the
//     deliberate 390px treatment - a real tree does not fit, so rounds read
//     top to bottom instead.
//   - Desktop (lg+): flex-row with horizontal scroll, one column per round,
//     cards distributed so later (smaller) rounds centre against earlier
//     ones for the classic bracket pyramid.

import Link from "next/link";
import { getBracket, type BracketFixture } from "@/lib/server/bracket";
import { flagFor } from "@/lib/flags";
import { teamCode } from "@/lib/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pensLine(f: BracketFixture): string | null {
  if (!f.pens || f.pens.p1 === f.pens.p2) return null;
  const winner = f.pens.p1 > f.pens.p2 ? f.participant1 : f.participant2;
  return `${teamCode(winner)} advanced on penalties ${Math.max(f.pens.p1, f.pens.p2)}-${Math.min(
    f.pens.p1,
    f.pens.p2
  )}`;
}

function kickoff(ts: number): string {
  return new Date(ts)
    .toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    })
    .toUpperCase();
}

function Flag({ team }: { team: string }) {
  const flag = flagFor(team);
  return (
    <span aria-hidden className="w-5 shrink-0 text-center text-sm leading-none">
      {flag ?? ""}
    </span>
  );
}

// One team row inside a match card. Winner is bright and bold; the beaten
// side is dimmed. A missing score leaves both sides neutral.
function TeamRow({
  name,
  score,
  isWinner,
  decided,
}: {
  name: string;
  score: number | null;
  isWinner: boolean;
  decided: boolean;
}) {
  const tone = !decided ? "text-chalk-300" : isWinner ? "text-chalk-50" : "text-chalk-500";
  return (
    <div className={`flex items-center gap-2 ${isWinner ? "font-bold" : ""} ${tone}`}>
      <Flag team={name} />
      <span className="min-w-0 flex-1 truncate font-label text-[13px] uppercase tracking-wide">
        {name}
      </span>
      <span className="hero-number w-5 text-right text-sm tabular-nums">
        {score !== null ? score : ""}
      </span>
    </div>
  );
}

function Match({ f, now }: { f: BracketFixture; now: number }) {
  const decided = f.winner !== null;
  const upcoming = f.score === null && f.startTime > now;
  const pens = pensLine(f);

  const body = (
    <div className="flex flex-col gap-1.5 rounded-[12px] border border-pitch-700 bg-pitch-850 px-3 py-2.5">
      <TeamRow
        name={f.participant1}
        score={f.score ? f.score.p1 : null}
        isWinner={f.winner === 1}
        decided={decided}
      />
      <TeamRow
        name={f.participant2}
        score={f.score ? f.score.p2 : null}
        isWinner={f.winner === 2}
        decided={decided}
      />
      <div className="flex items-center justify-between gap-2 border-t border-pitch-700 pt-1.5">
        <span className="font-label text-[10px] font-semibold uppercase tracking-[0.12em] text-chalk-500">
          {upcoming ? kickoff(f.startTime) : pens ? pens : f.score ? "Full time" : "Full time · no score"}
        </span>
        {f.hasReport && (
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.12em] text-volt">
            Report &rsaquo;
          </span>
        )}
      </div>
    </div>
  );

  if (f.hasReport) {
    return (
      <Link
        href={`/match/${f.fixtureId}/report`}
        className="block rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
      >
        {body}
      </Link>
    );
  }
  return body;
}

export default async function BracketPage() {
  const now = Date.now();
  const bracket = await getBracket(now);

  if (bracket.error || bracket.rounds.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <p className="hero-number text-2xl uppercase tracking-tight text-chalk-50">Bracket unavailable</p>
        <p className="font-label text-sm text-chalk-400">The knockout structure is not in the feed right now.</p>
        <Link
          href="/"
          className="min-h-[44px] rounded-md border border-chalk-600 px-4 py-2.5 font-label text-sm font-bold uppercase tracking-wide text-chalk-100"
        >
          To the bench
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="whisper rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          &lsaquo; The bench
        </Link>
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500">
          Knockout bracket
        </p>
      </header>

      {/* Champion: the payoff, shown first. Only when the Final has a
          canonical result; otherwise no one is crowned. */}
      {bracket.champion ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-volt/40 bg-volt/10 px-4 py-3.5">
          <span aria-hidden className="text-2xl">
            {flagFor(bracket.champion.team) ?? "🏆"}
          </span>
          <div className="flex flex-col">
            <span className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-volt">
              Champion
            </span>
            <span className="hero-number text-xl uppercase tracking-tight text-chalk-50">
              {bracket.champion.team}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-[14px] border border-pitch-700 bg-pitch-850 px-4 py-3">
          <p className="font-label text-sm text-chalk-400">
            The final has no result on the feed yet, so no champion is crowned.
          </p>
        </div>
      )}

      {/* The tree: flex-col on mobile (rounds stack), flex-row + horizontal
          scroll on desktop (one column per round). */}
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-4 lg:overflow-x-auto lg:pb-2">
        {bracket.rounds.map((round) => (
          <section key={round.stage} className="flex flex-col gap-3 lg:min-w-[210px] lg:flex-1 lg:justify-around">
            <h2 className="sticky top-0 z-10 -mx-1 bg-pitch-900/90 px-1 py-1 font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500 backdrop-blur">
              {round.name}
              <span className="ml-1.5 text-chalk-600">{round.fixtures.length}</span>
            </h2>
            <div className="flex flex-col gap-3 lg:gap-4">
              {round.fixtures.map((f) => (
                <Match key={f.fixtureId} f={f} now={now} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Third-place playoff: a knockout fixture, but off the champion's
          path, so shown on its own rather than in the spine. */}
      {bracket.thirdPlace && (
        <section className="flex flex-col gap-3">
          <h2 className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500">
            Third-place playoff
          </h2>
          <div className="max-w-sm">
            <Match f={bracket.thirdPlace} now={now} />
          </div>
        </section>
      )}

      {/* Group stage: no group letters exist in the feed, so this is one
          honest line, not invented structure. */}
      {bracket.groupStageCount > 0 && (
        <section className="rounded-[14px] border border-pitch-700 bg-pitch-850 px-4 py-3.5">
          <h2 className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500">
            Group stage
          </h2>
          <p className="mt-1 font-label text-sm text-chalk-300">
            {bracket.groupStageCount} group-stage fixtures, listed by matchday in{" "}
            <Link href="/?tab=results" className="font-bold text-volt underline underline-offset-2">
              Results
            </Link>
            .
          </p>
        </section>
      )}
    </main>
  );
}

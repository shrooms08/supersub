// The Match Detail page: /match/[fixtureId]/report. Server-rendered from
// the cached timeline; read-only, no entry paths. If the story cannot be
// built (no local bundle and the historical feed has no log), it renders
// a quiet "unavailable" panel rather than an error, though the results
// rows only link when a report is known to exist.

import Link from "next/link";
import { getMatchTimeline } from "@/lib/server/match-timeline";
import { MatchReport } from "@/components/MatchReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MatchReportPage({
  params,
}: {
  params: { fixtureId: string };
}) {
  const fixtureId = Number(params.fixtureId);
  const timeline = Number.isInteger(fixtureId) ? await getMatchTimeline(fixtureId) : null;

  if (!timeline) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <p className="hero-number text-2xl uppercase tracking-tight text-chalk-50">
          No report on file
        </p>
        <p className="font-label text-sm text-chalk-400">
          The story for this match is not in the feed.
        </p>
        <Link
          href="/"
          className="min-h-[44px] rounded-md border border-chalk-600 px-4 py-2.5 font-label text-sm font-bold uppercase tracking-wide text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          To the bench
        </Link>
      </main>
    );
  }

  return <MatchReport timeline={timeline} />;
}

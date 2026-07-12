// The computed match timeline as JSON, so the live match ticker can
// resolve player names against the same roster + confirmed-PlayerId
// resolver the Match Detail page uses. Read-only; cached per fixture in
// the timeline builder (60s for a live fixture, 60 min for a finished
// one), so this is one cheap lookup after the first build.

import { NextRequest, NextResponse } from "next/server";
import { getMatchTimeline } from "@/lib/server/match-timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  const fixtureId = Number(params.fixtureId);
  if (!Number.isInteger(fixtureId)) {
    return NextResponse.json({ error: "bad fixture id" }, { status: 400 });
  }
  const timeline = await getMatchTimeline(fixtureId);
  if (!timeline) return NextResponse.json({ timeline: null }, { status: 404 });
  return NextResponse.json({ timeline });
}

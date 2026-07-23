// The knockout bracket structure. Read-only.
//
//   GET /api/bracket
//   -> { rounds, thirdPlace, champion, groupStageCount, error }
//
// Stage names are inferred from fixture counts (see bracket.ts); the feed
// carries no round or group names. Canonical scores come from the shared
// cached score path, never from folding logs.

import { NextResponse } from "next/server";
import { getBracket } from "@/lib/server/bracket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getBracket(Date.now());
  return NextResponse.json(data);
}

// Live score/minute for the bench's TODAY cards. One shared, cached poll
// covers every live fixture; there are no per-card streams on the bench.
// Read-only.
//
//   GET /api/live-scores?ids=18222446,18202701
//   -> { "18222446": { score:{p1,p2}, minute, label, live }, ... }

import { NextRequest, NextResponse } from "next/server";
import { liveMatchStates } from "@/lib/server/live-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 12);
  if (ids.length === 0) return NextResponse.json({});
  const states = await liveMatchStates(ids);
  return NextResponse.json(states);
}

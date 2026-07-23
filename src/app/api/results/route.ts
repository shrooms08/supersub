// Full tournament history, one page of days at a time. Read-only.
//
//   GET /api/results?page=0
//   -> { page, days: [{ key, date, label, fixtures }], hasMore,
//        totalFinished, totalDays, error }
//
// The client loads page 0 for the RESULTS tab and requests older pages on
// demand, so neither side handles every day at once.

import { NextRequest, NextResponse } from "next/server";
import { getResultsPage } from "@/lib/server/results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("page") ?? 0);
  const page = Number.isInteger(raw) && raw >= 0 ? raw : 0;
  const data = await getResultsPage(page, Date.now());
  return NextResponse.json(data);
}

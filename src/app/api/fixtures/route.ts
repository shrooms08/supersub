// The Bench's data: fixtures with a derived phase badge. Mode comes from
// the env default or ?mode= override; the response says which was used so
// the UI can label replay cards.

import { NextRequest, NextResponse } from "next/server";
import { getSource } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode");
  const source = getSource({ mode });
  try {
    const fixtures = await source.listFixtures();
    return NextResponse.json({ mode: source.mode, fixtures });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ mode: source.mode, fixtures: [], error: message }, { status: 502 });
  }
}

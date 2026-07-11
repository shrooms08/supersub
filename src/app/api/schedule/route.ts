// The bench's matchday board: the real World Cup schedule (today,
// coming up, results) plus the bundled replay rail. Read-only and
// additive; the older /api/fixtures endpoint is left untouched for the
// smoke and live-verify scripts that call it.
//
// The replay rail is always included regardless of feed health, because
// it is the judges' path and must never depend on the live token.

import { NextResponse } from "next/server";
import { getSchedule, type SchedulePayload } from "@/lib/server/schedule";
import { createReplaySource } from "@/lib/sources/replay";
import type { FixtureListing } from "@/lib/sources/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ScheduleResponse extends SchedulePayload {
  replays: FixtureListing[];
}

export async function GET() {
  const now = Date.now();

  // Replay rail first and independently: bundled data, no network.
  let replays: FixtureListing[] = [];
  try {
    replays = await createReplaySource().listFixtures();
  } catch {
    replays = [];
  }

  let schedule: SchedulePayload;
  try {
    schedule = await getSchedule(now);
  } catch (err) {
    schedule = {
      now,
      today: [],
      comingUp: [],
      results: [],
      liveNow: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const body: ScheduleResponse = { ...schedule, replays };
  return NextResponse.json(body);
}

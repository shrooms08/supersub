// Resolution sweep, run on a schedule (Vercel Cron) so entries resolve
// whether or not anyone was watching at the whistle. It finds every
// unresolved entry, folds each finished fixture once, and resolves its
// entries server-side from the event-sourced log. Deterministic and
// idempotent: already-resolved entries are skipped, and re-running is
// harmless.
//
// Scheduled in vercel.json (every 10 minutes). Vercel adds
// `Authorization: Bearer $CRON_SECRET` to cron invocations when the env
// var is set; we require it (also honouring Vercel's internal
// `x-vercel-cron` header) so the endpoint cannot be triggered by anyone
// else. It can be run manually with the same bearer for a one-off sweep.

import { NextRequest, NextResponse } from "next/server";
import { resolveFinishedEntries } from "@/lib/server/resolve-entry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Report generation runs per resolved entry; give the sweep room.
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (dev): allow
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await resolveFinishedEntries();
  return NextResponse.json({
    ok: true,
    resolvedCount: result.resolved.length,
    resolved: result.resolved,
    skippedLive: result.skippedLive,
    errors: result.errors,
  });
}

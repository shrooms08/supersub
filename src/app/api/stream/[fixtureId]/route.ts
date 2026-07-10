// The app's own SSE endpoint. The browser connects here and receives the
// normalized internal protocol regardless of source:
//
//   event: meta      {mode, speed, fixture, virtualNow}
//   event: backfill  {events: MatchEvent[], odds: OddsUpdate[]}
//   event: match     MatchEvent
//   event: odds      OddsUpdate
//   event: clock     {feedNow}
//   event: fault     {message}   (non-fatal source hiccups)
//
// Raw feed shapes never appear on this wire; both sources normalize before
// emitting. Switching replay to live is ?mode= or the SUPERSUB_MODE env
// var, nothing else.

import { NextRequest } from "next/server";
import { getSource, resetReplaySession, resolveMode } from "@/lib/sources";
import type { SourceCallbacks } from "@/lib/sources/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  const fixtureId = Number(params.fixtureId);
  if (!Number.isInteger(fixtureId)) {
    return new Response("bad fixture id", { status: 400 });
  }

  const search = req.nextUrl.searchParams;
  const mode = resolveMode(search.get("mode"));
  if (mode === "replay" && search.get("restart") === "1") {
    resetReplaySession(fixtureId);
  }
  const source = getSource({ mode, speed: search.get("speed") });

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          abort.abort();
        }
      };

      const callbacks: SourceCallbacks = {
        onMeta: (meta) => send("meta", meta),
        onBackfill: (payload) => send("backfill", payload),
        onEvent: (event) => send("match", event),
        onOdds: (odds) => send("odds", odds),
        onClock: (feedNow) => send("clock", { feedNow }),
        onError: (message) => send("fault", { message }),
      };

      source
        .connect(fixtureId, callbacks, abort.signal)
        .catch((err) => {
          send("fault", { message: err instanceof Error ? err.message : String(err) });
        })
        .finally(() => {
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

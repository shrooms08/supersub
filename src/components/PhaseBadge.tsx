import type { Phase } from "@/lib/feed/types";

// Grayscale by design: the volt accent is reserved for the CTA, the curve,
// and hero numbers. LIVE reads through motion, not color.
export function PhaseBadge({ phase, replay }: { phase: Phase; replay?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {phase === "live" && (
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-chalk-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-100">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-chalk-100 animate-live-dot" />
          Live
        </span>
      )}
      {phase === "upcoming" && (
        <span className="rounded-sm border border-pitch-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-400">
          Upcoming
        </span>
      )}
      {phase === "finished" && (
        <span className="rounded-sm border border-pitch-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-500">
          Full time
        </span>
      )}
      {replay && (
        <span className="rounded-sm bg-pitch-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-300">
          Replay
        </span>
      )}
    </span>
  );
}

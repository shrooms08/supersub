import type { Phase } from "@/lib/feed/types";

// Phase chip. The LIVE beacon is one of the seven sanctioned volt uses;
// everything else on the chip row is grayscale.
export function PhaseBadge({ phase, replay }: { phase: Phase; replay?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {phase === "live" && (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-volt"
          style={{ background: "rgba(200,255,0,.12)" }}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-volt animate-live-pulse" />
          Live
        </span>
      )}
      {phase === "upcoming" && (
        <span className="rounded-md bg-pitch-700 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-400">
          Upcoming
        </span>
      )}
      {phase === "finished" && (
        <span className="rounded-md bg-pitch-700 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-500">
          Full time
        </span>
      )}
      {replay && (
        <span className="rounded-md border border-pitch-600 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-300">
          Replay
        </span>
      )}
    </span>
  );
}

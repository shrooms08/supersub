"use client";

// THE button. One dominant action in the whole product. It carries the
// volt accent, presses like a physical button, and beneath it the live
// multiplier readout tracks the curve. When the market has swung more
// than 10 points inside two minutes it gains a slow pulse: this is your
// moment.

import { tierForMultiplier } from "@/lib/config/scoring";
import { fmtMultiplier, fmtPct } from "@/lib/format";

export function EnterCta({
  prob,
  multiplier,
  disabled,
  disabledReason,
  swinging,
  busy,
  onEnter,
}: {
  prob: number | null;
  multiplier: number | null;
  disabled: boolean;
  disabledReason: string | null;
  swinging: boolean;
  busy: boolean;
  onEnter: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onEnter}
        className={`display-condensed min-h-[76px] w-full rounded-lg bg-volt px-6 py-5 font-display text-2xl font-black uppercase tracking-wide text-pitch-950 shadow-[0_6px_0_rgba(157,191,31,0.55),0_14px_32px_-10px_rgba(214,255,63,0.35)] transition-[transform,box-shadow,background-color] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950 enabled:hover:bg-volt-bright enabled:active:translate-y-[3px] enabled:active:shadow-[0_2px_0_rgba(157,191,31,0.55),0_6px_16px_-8px_rgba(214,255,63,0.3)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${
          swinging && !disabled ? "animate-cta-pulse" : ""
        }`}
      >
        {busy ? "Stepping on..." : "Enter the pitch"}
      </button>

      <div aria-live="polite" className="text-center">
        {disabled && disabledReason ? (
          <p className="text-xs text-chalk-400">{disabledReason}</p>
        ) : prob !== null && multiplier !== null ? (
          <p className="text-xs text-chalk-400">
            Enter now:{" "}
            <span className="font-display text-sm font-black tabular-nums text-chalk-100">
              {fmtMultiplier(multiplier)}
            </span>
            <span className="mx-1.5 font-bold uppercase tracking-[0.12em] text-chalk-300">
              {tierForMultiplier(multiplier).name}
            </span>
            <span className="text-chalk-500">
              Your side wins it {fmtPct(prob)} times in 100.
            </span>
          </p>
        ) : (
          <p className="text-xs text-chalk-400">Waiting on the market to post a price.</p>
        )}
      </div>
    </div>
  );
}

"use client";

// THE button. Full width, 60px tall, canonical volt; ctaPulse when the
// market has swung more than 10 points inside two minutes. Beneath it,
// the live multiplier readout tracks the curve in Saira Condensed volt.

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
        className={`hero-number h-[60px] w-full rounded-xl bg-volt px-6 text-2xl uppercase tracking-wide text-pitch-950 shadow-[0_6px_0_rgba(158,196,0,0.55),0_14px_32px_-10px_rgba(200,255,0,0.35)] transition-[transform,box-shadow,background-color] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950 enabled:hover:bg-volt-bright enabled:active:translate-y-[3px] enabled:active:shadow-[0_2px_0_rgba(158,196,0,0.55),0_6px_16px_-8px_rgba(200,255,0,0.3)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${
          swinging && !disabled ? "animate-cta-pulse" : ""
        }`}
      >
        {busy ? "Stepping on..." : "Enter the pitch"}
      </button>

      <div aria-live="polite" className="text-center">
        {disabled && disabledReason ? (
          <p className="font-label text-xs text-chalk-400">{disabledReason}</p>
        ) : prob !== null && multiplier !== null ? (
          <p className="flex items-baseline justify-center gap-2 font-label text-xs text-chalk-400">
            <span>Enter now:</span>
            <span className="hero-number text-[30px] leading-none text-volt">
              {fmtMultiplier(multiplier)}
            </span>
            <span className="font-bold uppercase tracking-[0.12em] text-chalk-300">
              · {tierForMultiplier(multiplier).name}
            </span>
            <span className="hidden text-chalk-500 sm:inline">
              wins it {fmtPct(prob)} in 100
            </span>
          </p>
        ) : (
          <p className="font-label text-xs text-chalk-400">
            Waiting on the market to post a price.
          </p>
        )}
      </div>
    </div>
  );
}

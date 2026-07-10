"use client";

// THE button. One dominant action in the whole product. It carries the
// volt accent and, when the market has swung more than 10 points inside
// two minutes, a slow pulse that says "this is your moment".

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
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onEnter}
        className={`min-h-[64px] w-full rounded-lg bg-volt px-6 py-4 font-display text-xl font-black uppercase tracking-wide text-pitch-950 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950 enabled:hover:bg-volt-bright enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
          swinging && !disabled ? "animate-cta-pulse" : ""
        }`}
      >
        {busy ? "Stepping on..." : "Enter the pitch"}
      </button>
      <p className="text-center text-xs text-chalk-400" aria-live="polite">
        {disabled && disabledReason ? (
          disabledReason
        ) : prob !== null && multiplier !== null ? (
          <>
            Step on now and you carry{" "}
            <span className="font-bold text-chalk-100">{fmtMultiplier(multiplier)}</span>: your
            side wins it {fmtPct(prob)} times in 100.
          </>
        ) : (
          "Waiting on the market."
        )}
      </p>
    </div>
  );
}

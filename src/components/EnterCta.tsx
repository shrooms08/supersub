"use client";

// THE button, per the reference: Saira 26px (30px desktop) on flat volt,
// ctaPulse while the market is swinging (the developer spec gates the
// pulse on a swing; the mock's always-on pulse is its demo state).
// Beneath it, the ENTER NOW readout: the multiplier at 44px (60px
// desktop) in volt with the tier pill, volt-tinted only when the tier is
// Miracle Territory, and a persuasion line bound to the real numbers.

import { tierForMultiplier } from "@/lib/config/scoring";
import { fmtMultiplier, fmtPct } from "@/lib/format";

export function EnterCta({
  teamName,
  prob,
  multiplier,
  disabled,
  disabledReason,
  swinging,
  busy,
  onEnter,
}: {
  teamName: string;
  prob: number | null;
  multiplier: number | null;
  disabled: boolean;
  disabledReason: string | null;
  swinging: boolean;
  busy: boolean;
  onEnter: () => void;
}) {
  const tier = multiplier !== null ? tierForMultiplier(multiplier).name : null;
  const miracle = tier === "Miracle Territory";

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onEnter}
        className={`hero-number w-full rounded-[13px] bg-volt px-6 py-[17px] text-[26px] uppercase tracking-[0.05em] text-pitch-900 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950 enabled:hover:bg-volt-bright enabled:active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-40 lg:py-5 lg:text-[30px] lg:tracking-[0.06em] ${
          swinging && !disabled ? "animate-cta-pulse" : ""
        }`}
      >
        {busy ? "Stepping on..." : "Enter the pitch"}
      </button>

      <div aria-live="polite">
        {disabled && disabledReason ? (
          <p className="text-center font-label text-xs text-chalk-400">{disabledReason}</p>
        ) : prob !== null && multiplier !== null ? (
          <>
            <div className="flex items-center justify-center gap-3 lg:gap-3.5">
              <div className="text-right">
                <p className="font-label text-[8px] font-bold uppercase leading-[1.4] tracking-[0.14em] text-chalk-500 lg:text-[9px] lg:tracking-[0.16em]">
                  Enter
                  <br />
                  now
                </p>
              </div>
              <p className="hero-number text-[44px] leading-[0.8] text-volt [text-shadow:0_0_24px_rgba(200,255,0,.4)] lg:text-[60px] lg:[text-shadow:0_0_32px_rgba(200,255,0,.4)]">
                {fmtMultiplier(multiplier)}
              </p>
              <span
                className="rounded-[16px] px-2.5 py-[5px] text-center font-label text-[8px] font-bold uppercase leading-[1.3] tracking-[0.14em] lg:rounded-[20px] lg:px-3 lg:py-1.5 lg:text-[9px] lg:tracking-[0.16em]"
                style={
                  miracle
                    ? {
                        border: "1px solid rgba(200,255,0,.4)",
                        background: "rgba(200,255,0,.08)",
                        color: "#c8ff00",
                      }
                    : {
                        border: "1px solid rgba(255,255,255,.14)",
                        background: "rgba(255,255,255,.04)",
                        color: "#a1a1aa",
                      }
                }
              >
                {tier}
              </span>
            </div>
            <p className="mt-2 hidden text-center font-label text-[11px] leading-[1.5] text-chalk-500 lg:block">
              {teamName} win it {fmtPct(prob)} times in 100. Walk on now and everything they
              do after scores at{" "}
              <b className="text-chalk-300">&times;{multiplier.toFixed(2)}</b>.
            </p>
          </>
        ) : (
          <p className="text-center font-label text-xs text-chalk-400">
            Waiting on the market to post a price.
          </p>
        )}
      </div>
    </div>
  );
}

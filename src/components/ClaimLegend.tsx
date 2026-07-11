"use client";

// Claim Your Legend. Two variants, one on the bench card and one on the
// career page. When the feature is dark (flag off or unconfigured) the
// bench renders the original static Solana tease and the career renders
// nothing, so anonymous play is entirely unchanged.
//
// States when live:
//   unclaimed, not signed in   -> CLAIM YOUR LEGEND (volt CTA) opens Privy
//   unclaimed, signed in       -> confirm the permanent bind
//   no local career, signed in -> RESUME YOUR CAREER (restore any browser)
//   claimed                    -> LEGEND CLAIMED, masked wallet, email

import Link from "next/link";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { claimActive } from "@/lib/claim";
import { maskWallet, type ClaimState } from "@/lib/player";

interface Props {
  variant: "bench" | "career";
  claim: ClaimState | null;
  hasPlayer: boolean;
  onChanged: () => void;
}

// The original bench tease, shown verbatim while the feature is dark.
function StaticTease() {
  return (
    <div
      className="rounded-[14px] p-4 text-center"
      style={{
        border: "1px dashed rgba(200,255,0,.35)",
        background: "linear-gradient(180deg, rgba(200,255,0,.05), transparent)",
      }}
    >
      <p className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-volt">
        Coming at full time
      </p>
      <p className="hero-number mt-1.5 text-2xl uppercase leading-none text-chalk-50">
        Claim your legend
      </p>
      <p className="mt-1.5 font-label text-[10px] leading-relaxed text-chalk-400">
        Mint your career, appearances, badges and match reports, permanently on Solana when the
        tournament ends.
      </p>
      <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-[20px] border border-white/10 px-3 py-[7px] font-label text-[9px] font-bold uppercase tracking-[0.14em] text-chalk-600">
        &#9678; Solana · Locked until FT
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[14px] p-4 text-center"
      style={{
        border: "1px dashed rgba(200,255,0,.35)",
        background: "linear-gradient(180deg, rgba(200,255,0,.05), transparent)",
      }}
    >
      {children}
    </div>
  );
}

export function ClaimLegend(props: Props) {
  if (!claimActive) return props.variant === "bench" ? <StaticTease /> : null;
  return <ClaimLegendLive {...props} />;
}

function ClaimLegendLive({ claim, hasPlayer, onChanged }: Props) {
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = (user?.email?.address as string | undefined) ?? null;

  async function postClaim(path: string) {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Sign-in did not complete. Try again.");
        return;
      }
      const res = await fetch(path, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) onChanged();
      else setError(body.error ?? "That did not go through. Try again.");
    } catch {
      setError("The line dropped. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Claimed: the trophy state.
  if (claim?.claimed) {
    return (
      <Shell>
        <p className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-volt">
          Legend claimed
        </p>
        <p className="hero-number mt-1.5 text-2xl uppercase leading-none text-chalk-50">
          Yours, for good
        </p>
        <div className="mt-2.5 flex flex-col items-center gap-1">
          <span className="font-label text-[10px] font-semibold uppercase tracking-[0.12em] text-chalk-400">
            Wallet {maskWallet(claim.walletAddress) ?? "linked"}
          </span>
          {email && (
            <span className="font-label text-[10px] tracking-[0.04em] text-chalk-500">{email}</span>
          )}
        </div>
        <Link
          href="/wallet"
          className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-[9px] border border-white/15 px-4 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          Open wallet
        </Link>
      </Shell>
    );
  }

  const cta =
    "mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-[10px] bg-volt px-4 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-pitch-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 disabled:opacity-60";

  // Signed in, no local career: offer to resume a claimed one.
  if (authenticated && !hasPlayer) {
    return (
      <Shell>
        <p className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-volt">
          Welcome back
        </p>
        <p className="hero-number mt-1.5 text-2xl uppercase leading-none text-chalk-50">
          Resume your career
        </p>
        <p className="mt-1.5 font-label text-[10px] leading-relaxed text-chalk-400">
          Bring the legend you claimed to this device. One account, one career, any browser.
        </p>
        <button type="button" disabled={busy || !ready} onClick={() => void postClaim("/api/claim/resume")} className={cta}>
          {busy ? "Checking the books..." : "Resume your career"}
        </button>
        {error && <p className="mt-2 font-label text-[10px] text-chalk-400">{error}</p>}
      </Shell>
    );
  }

  // Signed in with a local career: confirm the permanent bind.
  if (authenticated && hasPlayer) {
    return (
      <Shell>
        <p className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-volt">
          One step left
        </p>
        <p className="hero-number mt-1.5 text-2xl uppercase leading-none text-chalk-50">
          Claim your legend
        </p>
        <p className="mt-1.5 font-label text-[10px] leading-relaxed text-chalk-400">
          Bind this career to your account and its Solana wallet. This is permanent. A career is
          claimed once, for good.
        </p>
        <button type="button" disabled={busy || !ready} onClick={() => void postClaim("/api/claim")} className={cta}>
          {busy ? "Signing the forms..." : "Claim it, permanently"}
        </button>
        {error && <p className="mt-2 font-label text-[10px] text-chalk-400">{error}</p>}
      </Shell>
    );
  }

  // Not signed in: open Privy.
  return (
    <Shell>
      <p className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-volt">
        Make it permanent
      </p>
      <p className="hero-number mt-1.5 text-2xl uppercase leading-none text-chalk-50">
        Claim your legend
      </p>
      <p className="mt-1.5 font-label text-[10px] leading-relaxed text-chalk-400">
        Sign in to bind your career and its badges to your account and a Solana wallet, on any
        browser. Anonymous play stays exactly as it is.
      </p>
      <button type="button" disabled={busy || !ready} onClick={() => login()} className={cta}>
        Claim your legend
      </button>
      {error && <p className="mt-2 font-label text-[10px] text-chalk-400">{error}</p>}
    </Shell>
  );
}

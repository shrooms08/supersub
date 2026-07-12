"use client";

// Resume affordance for the no-cookie state. Signing Day renders when a
// visit has no player; a returning player who already claimed a career
// on another browser needs a way back in from exactly here. This banner
// sits above the signing form and, for a signed-in Privy visitor,
// restores their career via /api/claim/resume (which mints the same HMAC
// cookie by privy_user_id). When the claim feature is dark it renders
// nothing, so Signing Day is byte-for-byte unchanged.

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { claimActive } from "@/lib/claim";

export function ResumeGate({ onResumed }: { onResumed: () => void }) {
  if (!claimActive) return null;
  return <ResumeGateLive onResumed={onResumed} />;
}

const CTA =
  "mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-[10px] bg-volt px-4 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-pitch-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 disabled:opacity-60";

function ResumeGateLive({ onResumed }: { onResumed: () => void }) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resume() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Sign-in did not complete. Try again.");
        return;
      }
      const res = await fetch("/api/claim/resume", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) onResumed();
      else setError(body.error ?? "No claimed career on this account.");
    } catch {
      setError("The line dropped. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-6 rounded-[14px] p-4 text-center"
      style={{
        border: "1px dashed rgba(200,255,0,.35)",
        background: "linear-gradient(180deg, rgba(200,255,0,.05), transparent)",
      }}
    >
      <p className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-volt">
        Returning player
      </p>
      <p className="hero-number mt-1.5 text-xl uppercase leading-none text-chalk-50">
        Resume your career
      </p>
      <p className="mt-1.5 font-label text-[10px] leading-relaxed text-chalk-400">
        Already claimed a legend? Bring it to this device. One account, one career, any browser. Or
        sign a new contract below.
      </p>
      {authenticated ? (
        <button type="button" disabled={busy || !ready} onClick={() => void resume()} className={CTA}>
          {busy ? "Checking the books..." : "Resume your career"}
        </button>
      ) : (
        <button type="button" disabled={!ready} onClick={() => login()} className={CTA}>
          Sign in to resume
        </button>
      )}
      {error && <p className="mt-2 font-label text-[10px] text-chalk-400">{error}</p>}
    </div>
  );
}

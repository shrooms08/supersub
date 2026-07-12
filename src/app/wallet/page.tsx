"use client";

// The wallet page, signed-in only. Display and export ONLY: the wallet
// address (masked, with copy), its live SOL balance from a public RPC,
// an Export Wallet deep-link into Privy's export flow, and a Transaction
// History shell marked SOON. There are deliberately no send, receive, or
// deposit flows in this pass; the mint stays the full-time roadmap beat.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy, useExportWallet } from "@privy-io/react-auth";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { claimActive, SOLANA_RPCS } from "@/lib/claim";
import { maskWallet } from "@/lib/player";

// The user's Solana wallet address from their linked accounts. The app
// is configured solana-only, so the embedded wallet is Solana; fall back
// to the primary wallet if a chain-tagged one is not found.
function solanaAddress(user: unknown): string | null {
  const u = user as { wallet?: { address?: string }; linkedAccounts?: Array<Record<string, unknown>> };
  for (const acct of u?.linkedAccounts ?? []) {
    if (acct.type === "wallet" && acct.chainType === "solana" && typeof acct.address === "string") {
      return acct.address;
    }
  }
  return u?.wallet?.address ?? null;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <header className="flex items-center justify-between gap-2">
        <p className="font-label text-[9px] font-bold uppercase tracking-[0.22em] text-volt lg:text-[10px]">
          The wallet
        </p>
        <Link
          href="/"
          className="whisper rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          &lsaquo; The bench
        </Link>
      </header>
      {children}
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel-quiet !rounded-2xl px-5 py-10 text-center">
      <p className="hero-number text-xl uppercase tracking-wide text-chalk-100">{title}</p>
      <p className="mt-2 font-label text-sm text-chalk-400">{body}</p>
    </div>
  );
}

export default function WalletPage() {
  if (!claimActive) {
    return (
      <Frame>
        <Notice title="Not enabled" body="The wallet opens once Claim Your Legend is live." />
      </Frame>
    );
  }
  return <WalletInner />;
}

function WalletInner() {
  const { ready, authenticated, user, login } = usePrivy();
  const { exportWallet } = useExportWallet();
  const [balance, setBalance] = useState<number | null | "error">(null);
  const [copied, setCopied] = useState(false);

  const address = authenticated ? solanaAddress(user) : null;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setBalance(null);
    const key = new PublicKey(address);
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error("rpc timeout")), ms)),
      ]);
    (async () => {
      // Try each public RPC in turn; the first that answers wins, so a
      // rate-limited or CORS-blocked endpoint falls through instead of
      // reading "Unavailable".
      for (const url of SOLANA_RPCS) {
        try {
          const conn = new Connection(url, "confirmed");
          const lamports = await withTimeout(conn.getBalance(key), 6000);
          if (!cancelled) setBalance(lamports / LAMPORTS_PER_SOL);
          return;
        } catch {
          // next endpoint
        }
      }
      if (!cancelled) setBalance("error");
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const copy = useCallback(() => {
    if (!address) return;
    void navigator.clipboard?.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [address]);

  if (!ready) {
    return (
      <Frame>
        <div className="panel-quiet h-40 animate-pulse !rounded-2xl" />
      </Frame>
    );
  }

  if (!authenticated) {
    return (
      <Frame>
        <div className="panel-quiet !rounded-2xl px-5 py-10 text-center">
          <p className="hero-number text-xl uppercase tracking-wide text-chalk-100">Sign in first</p>
          <p className="mt-2 font-label text-sm text-chalk-400">
            Your wallet lives behind your account. Sign in to open it.
          </p>
          <button
            type="button"
            onClick={() => login()}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-volt px-5 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-pitch-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
          >
            Sign in
          </button>
        </div>
      </Frame>
    );
  }

  if (!address) {
    return (
      <Frame>
        <Notice title="No wallet yet" body="An embedded Solana wallet is created on your next sign-in." />
      </Frame>
    );
  }

  return (
    <Frame>
      {/* Address + balance */}
      <section
        aria-label="Wallet"
        className="panel relative overflow-hidden !rounded-2xl !bg-gradient-to-br !from-pitch-800 !to-[#0c0c0f] p-5"
      >
        <p className="font-label text-[9px] font-semibold uppercase tracking-[0.18em] text-chalk-600">
          Solana wallet
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="hero-number text-[26px] leading-none tracking-[0.02em] text-chalk-50">
            {maskWallet(address)}
          </span>
          <button
            type="button"
            onClick={copy}
            className="rounded-[7px] border border-white/15 px-2.5 py-1 font-label text-[9px] font-bold uppercase tracking-[0.14em] text-chalk-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-1 break-all font-label text-[10px] leading-relaxed text-chalk-600">{address}</p>

        <div className="mt-4 border-t border-white/[0.07] pt-3">
          <p className="font-label text-[8px] font-bold uppercase tracking-[0.16em] text-chalk-600">
            Balance
          </p>
          <p className="hero-number mt-1 text-3xl leading-none text-chalk-50">
            {balance === null ? "..." : balance === "error" ? "Unavailable" : `${balance.toFixed(4)} SOL`}
          </p>
          <p className="mt-1 font-label text-[9px] tracking-[0.04em] text-chalk-600">
            Live from a public RPC. Display only.
          </p>
        </div>
      </section>

      {/* Export */}
      <section aria-label="Export" className="panel !rounded-2xl p-5">
        <p className="hero-number text-lg uppercase leading-none text-chalk-50">Export wallet</p>
        <p className="mt-1.5 font-label text-[11px] leading-relaxed text-chalk-400">
          Take your keys into any Solana wallet client. Privy shows the private key on a secure,
          isolated screen; this app never sees it.
        </p>
        <button
          type="button"
          onClick={() => void exportWallet({ address })}
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-white/15 px-5 font-label text-[11px] font-bold uppercase tracking-[0.14em] text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          Export wallet
        </button>
      </section>

      {/* Transaction history: shell only in this pass */}
      <section aria-label="Transaction history" className="panel-quiet !rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <p className="hero-number text-lg uppercase leading-none text-chalk-300">
            Transaction history
          </p>
          <span className="rounded-md border border-pitch-600 px-2 py-0.5 font-label text-[8px] font-bold uppercase tracking-[0.16em] text-chalk-500">
            Soon
          </span>
        </div>
        <p className="mt-2 font-label text-[11px] leading-relaxed text-chalk-500">
          Your on-chain activity lands here once minting opens at full time.
        </p>
      </section>
    </Frame>
  );
}

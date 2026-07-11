"use client";

// Signing Day: the contract ceremony, per the canonical reference.
// SIGNING DAY · FIRST RUN eyebrow, the live generated crest that
// redraws on every keystroke, CLAUSE I identity (surname, shirt number,
// position pills), CLAUSE II terms, the Gaffer's word, and SIGN
// CONTRACT. Identity is written once and is permanent; the copy says so
// and the API enforces it.

import { useMemo, useState } from "react";
import {
  createPlayer,
  POSITIONS,
  POSITION_GROUPS,
  POSITION_LABELS,
  validateSurname,
  type PlayerRow,
  type Position,
} from "@/lib/player";
import { PixelCrest } from "./PixelCrest";

export function SigningForm({ onSigned }: { onSigned: (player: PlayerRow) => void }) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("ST");
  const [shirtNumber, setShirtNumber] = useState(9);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const surname = validateSurname(name);
  const previewName = surname ?? (name.trim().toUpperCase() || "SURNAME");
  const crestSeed = useMemo(
    () => `${previewName}-${shirtNumber || 0}`,
    [previewName, shirtNumber]
  );
  const numberOk = Number.isInteger(shirtNumber) && shirtNumber >= 1 && shirtNumber <= 99;
  const ready = surname !== null && numberOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !ready || !surname) return;
    setBusy(true);
    setError(null);
    const res = await createPlayer({ name: surname, position, shirtNumber });
    setBusy(false);
    if (res.player) {
      onSigned(res.player);
    } else if (res.status === 0 || res.status >= 500) {
      // Timeout, network drop, or a server failure: one line, re-armed.
      setError("The ink did not take. Try again.");
    } else {
      setError(res.error ?? "The ink did not take. Try again.");
    }
  };

  return (
    <section aria-label="Sign your contract" className="mx-auto w-full max-w-md">
      <header className="text-center">
        <p className="font-label text-[9px] font-bold uppercase tracking-[0.22em] text-volt">
          Signing day · First run
        </p>
        <h1 className="hero-number mt-1.5 text-[34px] uppercase leading-[0.9] text-chalk-50 lg:text-[40px]">
          Sign your contract
        </h1>
        <p className="mt-2 font-label text-[11px] leading-relaxed text-chalk-400">
          One career. One identity. For the whole tournament.
        </p>
      </header>

      {/* The crest, live */}
      <div className="panel mt-4 bg-gradient-to-b from-pitch-800 to-pitch-900 p-4 text-center">
        <p className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-chalk-500">
          Generated crest · Live
        </p>
        <div className="mt-3 flex justify-center">
          <PixelCrest seed={crestSeed} number={shirtNumber || 0} size={118} />
        </div>
        <div className="mt-3 flex items-baseline justify-center gap-2">
          <span className="hero-number text-[28px] uppercase leading-none text-chalk-50">
            {previewName}
          </span>
          <span className="hero-number text-lg font-semibold leading-none text-chalk-500">
            #{numberOk ? shirtNumber : "--"}
          </span>
        </div>
        <p className="mt-1.5 font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-chalk-400">
          Super Sub · {POSITION_GROUPS[position]}
        </p>
      </div>

      <form onSubmit={submit}>
        {/* Clause I */}
        <div className="panel mt-3 p-4">
          <p className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-volt">
            Clause I · Identity
          </p>
          <label
            htmlFor="player-name"
            className="mt-3 block font-label text-[8px] font-semibold uppercase tracking-[0.16em] text-chalk-500"
          >
            Surname on shirt
          </label>
          <input
            id="player-name"
            type="text"
            required
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z-]/g, ""))}
            placeholder="SURNAME"
            aria-describedby="player-name-permanent"
            className="hero-number mt-2 w-full rounded-lg border border-white/15 bg-pitch-950 px-3.5 py-3 text-[22px] uppercase tracking-[0.03em] text-chalk-50 placeholder:text-chalk-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
          />
          <p id="player-name-permanent" className="mt-2 font-label text-[10px] italic text-chalk-400">
            Choose carefully. <b className="not-italic text-chalk-50">This name is permanent.</b>
          </p>

          <div className="mt-3.5 flex gap-3">
            <div className="w-[86px] flex-none">
              <label
                htmlFor="player-number"
                className="font-label text-[8px] font-semibold uppercase tracking-[0.16em] text-chalk-500"
              >
                Shirt &#8470;
              </label>
              <input
                id="player-number"
                type="number"
                required
                min={1}
                max={99}
                inputMode="numeric"
                value={shirtNumber}
                onChange={(e) => setShirtNumber(Number(e.target.value))}
                className="hero-number mt-2 w-full rounded-lg border border-volt/40 bg-pitch-950 px-3 py-3 text-center text-2xl text-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-label text-[8px] font-semibold uppercase tracking-[0.16em] text-chalk-500">
                Position
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Position">
                {POSITIONS.map((p) => {
                  const active = position === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      title={`${POSITION_LABELS[p]} (${POSITION_GROUPS[p]})`}
                      aria-pressed={active}
                      onClick={() => setPosition(p)}
                      className={`rounded-lg px-3 py-2.5 font-label text-[9px] font-bold tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 ${
                        active
                          ? "border border-chalk-100 bg-chalk-100 text-pitch-900"
                          : "border border-white/10 bg-transparent text-chalk-400 hover:text-chalk-100"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Clause II */}
        <div className="panel-quiet mt-3 px-4 py-3.5">
          <p className="mb-1.5 font-label text-[8px] font-bold uppercase tracking-[0.2em] text-chalk-500">
            Clause II · Terms
          </p>
          <div className="flex justify-between border-b border-white/5 py-2">
            <span className="font-label text-[9px] font-semibold text-chalk-500">CLUB</span>
            <span className="hero-number text-[13px] leading-none text-chalk-50">SUPER SUB FC</span>
          </div>
          <div className="flex justify-between border-b border-white/5 py-2">
            <span className="font-label text-[9px] font-semibold text-chalk-500">COMPETITION</span>
            <span className="hero-number text-[13px] leading-none text-chalk-50">WORLD CUP 2026</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-label text-[9px] font-semibold text-chalk-500">TERM</span>
            <span className="hero-number text-[13px] leading-none text-volt">PERMANENT</span>
          </div>
        </div>

        {/* The Gaffer's word */}
        <blockquote className="mt-3 px-1 font-slab text-xs italic leading-relaxed text-chalk-400">
          &ldquo;You&apos;ll not start a single match, son. But when it&apos;s slipping away,
          that&apos;s your moment.&rdquo;
          <cite className="mt-1.5 block font-label text-[8px] font-semibold not-italic tracking-[0.14em] text-chalk-600">
            - THE GAFFER
          </cite>
        </blockquote>

        <button
          type="submit"
          disabled={busy || !ready}
          className="hero-number mt-3.5 w-full rounded-[13px] px-4 py-4 text-2xl uppercase tracking-[0.05em] text-pitch-900 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: "linear-gradient(90deg, #c8ff00, #e4ff6b, #c8ff00)",
            backgroundSize: "200% 100%",
            animation:
              busy || !ready ? undefined : "glowBreath 2.6s infinite, sheen 3s linear infinite",
          }}
        >
          &#9998; {busy ? "Signing..." : "Sign contract"}
        </button>

        {error && (
          <p role="alert" className="mt-3 text-center font-label text-sm text-chalk-300">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

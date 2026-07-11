"use client";

// Signing Day: the contract ceremony, per the binding reference. Mobile
// stacks eyebrow, live crest, Clause I, Clause II, the Gaffer's word,
// SIGN CONTRACT; desktop is the two-column contract (clauses and the
// signature left, crest and the Gaffer's note right) under a header with
// the club seal. Identity is written once and is permanent; the copy
// says so and the API enforces it. Clause headings use a middle dot
// where the mock used an em dash: the no-em-dash rule outranks the file.

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
      setError("The ink did not take. Try again.");
    } else {
      setError(res.error ?? "The ink did not take. Try again.");
    }
  };

  const crestPanel = (
    <div className="panel !rounded-2xl bg-gradient-to-b from-pitch-800 to-[#0d0d10] p-5 text-center">
      <p className="font-label text-[9px] font-bold uppercase tracking-[0.2em] text-chalk-500">
        Generated crest · Live
      </p>
      <div className="mt-3.5 flex justify-center">
        <PixelCrest seed={crestSeed} number={shirtNumber || 0} size={118} className="lg:hidden" />
        <PixelCrest seed={crestSeed} number={shirtNumber || 0} size={150} className="hidden lg:block" />
      </div>
      <div className="mt-4 flex items-baseline justify-center gap-2">
        <span className="hero-number text-[28px] uppercase leading-none text-chalk-50 lg:text-[34px]">
          {previewName}
        </span>
        <span className="hero-number text-lg font-semibold leading-none text-chalk-500 lg:text-[22px]">
          #{numberOk ? shirtNumber : "--"}
        </span>
      </div>
      <p className="mt-1.5 font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-400">
        Super Sub · {POSITION_GROUPS[position]}
      </p>
      <p className="mt-3 font-label text-[10px] text-chalk-600">Crest regenerates as you type.</p>
    </div>
  );

  const gafferNote = (
    <div className="panel-quiet !rounded-[14px] px-[18px] py-4">
      <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-chalk-500">
        The Gaffer&apos;s note
      </p>
      <blockquote className="mt-2 font-slab text-[15px] italic leading-relaxed text-chalk-300">
        &ldquo;You&apos;ll not start a single match, son. But when it&apos;s slipping away and
        the crowd&apos;s gone quiet, that&apos;s your moment. Get warmed up.&rdquo;
      </blockquote>
      <p className="mt-2.5 text-right font-label text-[9px] font-semibold tracking-[0.14em] text-chalk-600">
        - THE GAFFER
      </p>
    </div>
  );

  const contractPanel = (
    <form onSubmit={submit} className="panel !rounded-2xl bg-gradient-to-b from-pitch-800 to-[#0d0d10] p-4 lg:px-6 lg:py-[22px]">
      <p className="font-label text-[9px] font-bold uppercase tracking-[0.2em] text-volt">
        Clause I · Identity
      </p>

      <label
        htmlFor="player-name"
        className="mt-3.5 block font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-500"
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
        className="hero-number mt-2 w-full rounded-[10px] border border-white/15 bg-pitch-950 px-4 py-3 text-[22px] uppercase tracking-[0.04em] text-chalk-50 placeholder:text-chalk-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 lg:text-[26px]"
      />
      <p id="player-name-permanent" className="mt-2 font-label text-[10px] italic leading-[1.4] text-chalk-400 lg:text-xs">
        Choose carefully. <b className="not-italic text-chalk-50">This name is permanent.</b>{" "}
        <span className="hidden lg:inline">It is minted with your career and cannot be changed.</span>
      </p>

      <div className="mt-4 flex items-start gap-4">
        <div className="w-[86px] flex-none lg:w-[120px]">
          <label
            htmlFor="player-number"
            className="font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-500"
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
            className="hero-number mt-2 w-full rounded-[10px] border border-volt/40 bg-pitch-950 px-3 py-3 text-center text-2xl text-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt lg:text-[30px]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-500">
            Position
          </span>
          <div className="mt-2 flex flex-wrap gap-[7px]" role="group" aria-label="Position">
            {POSITIONS.map((p) => {
              const active = position === p;
              return (
                <button
                  key={p}
                  type="button"
                  title={`${POSITION_LABELS[p]} (${POSITION_GROUPS[p]})`}
                  aria-pressed={active}
                  onClick={() => setPosition(p)}
                  className="rounded-[9px] px-3 py-2.5 font-label text-[10px] font-bold tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
                  style={{
                    border: `1px solid ${active ? "#c8ff00" : "rgba(255,255,255,.12)"}`,
                    background: active ? "#c8ff00" : "transparent",
                    color: active ? "#0a0a0c" : "#a1a1aa",
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-6 font-label text-[9px] font-bold uppercase tracking-[0.2em] text-chalk-500">
        Clause II · Terms
      </p>
      <div className="mt-2.5 border-t border-white/[0.07]">
        <div className="flex justify-between border-b border-white/5 py-2.5">
          <span className="font-label text-[10px] font-semibold tracking-[0.1em] text-chalk-500">CLUB</span>
          <span className="hero-number text-[15px] leading-none text-chalk-50">SUPER SUB FC</span>
        </div>
        <div className="flex justify-between border-b border-white/5 py-2.5">
          <span className="font-label text-[10px] font-semibold tracking-[0.1em] text-chalk-500">COMPETITION</span>
          <span className="hero-number text-[15px] leading-none text-chalk-50">WORLD CUP 2026</span>
        </div>
        <div className="hidden justify-between border-b border-white/5 py-2.5 lg:flex">
          <span className="font-label text-[10px] font-semibold tracking-[0.1em] text-chalk-500">ROLE</span>
          <span className="hero-number text-[15px] leading-none text-chalk-50">
            SUPER SUB · IMPACT FROM THE BENCH
          </span>
        </div>
        <div className="flex justify-between py-2.5">
          <span className="font-label text-[10px] font-semibold tracking-[0.1em] text-chalk-500">TERM</span>
          <span className="hero-number text-[15px] leading-none text-volt">
            <span className="hidden lg:inline">FULL TOURNAMENT · </span>PERMANENT
          </span>
        </div>
      </div>

      <div className="mt-4 hidden items-center gap-3 rounded-[11px] border border-white/[0.09] bg-white/[0.03] px-3.5 py-3 lg:flex">
        <span aria-hidden className="hero-number text-[26px] leading-none text-chalk-500">
          !
        </span>
        <span className="font-label text-[11px] leading-[1.45] text-chalk-400">
          Once you sign,{" "}
          <b className="text-chalk-50">
            {previewName}, #{numberOk ? shirtNumber : "--"}
          </b>{" "}
          is your identity for every match of the tournament. There are no transfers.
        </span>
      </div>

      <blockquote className="mt-4 px-1 font-slab text-xs italic leading-relaxed text-chalk-400 lg:hidden">
        &ldquo;You&apos;ll not start a single match, son. But when it&apos;s slipping away,
        that&apos;s your moment.&rdquo;
        <cite className="mt-1.5 block font-label text-[8px] font-semibold not-italic tracking-[0.14em] text-chalk-600">
          - THE GAFFER
        </cite>
      </blockquote>

      <button
        type="submit"
        disabled={busy || !ready}
        className="hero-number mt-4 w-full rounded-[14px] px-4 py-4 text-2xl uppercase tracking-[0.05em] text-pitch-900 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950 disabled:cursor-not-allowed disabled:opacity-40 lg:py-[19px] lg:text-[28px] lg:tracking-[0.06em]"
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
  );

  return (
    <section aria-label="Sign your contract" className="mx-auto w-full max-w-md lg:max-w-4xl">
      <header className="text-center lg:flex lg:items-start lg:justify-between lg:border-b lg:border-white/[0.09] lg:pb-[18px] lg:text-left">
        <div>
          <p className="font-label text-[9px] font-bold uppercase tracking-[0.22em] text-volt lg:text-[10px] lg:tracking-[0.24em]">
            Signing day · First run
          </p>
          <h1 className="hero-number mt-1.5 text-[34px] uppercase leading-[0.9] text-chalk-50 lg:mt-2 lg:text-[52px] lg:leading-[0.86]">
            Sign your contract
          </h1>
          <p className="mt-2 font-label text-[11px] leading-relaxed text-chalk-400 lg:text-xs">
            One career. One identity. Bound for the whole tournament.
          </p>
        </div>
        <div
          aria-hidden
          className="mx-auto mt-3 hidden h-[52px] w-[52px] place-items-center rounded-full text-center font-label text-[8px] font-bold leading-[1.2] tracking-[0.1em] text-volt lg:mx-0 lg:mt-0 lg:grid"
          style={{ border: "2px solid rgba(200,255,0,.5)" }}
        >
          CLUB
          <br />
          SEAL
        </div>
      </header>

      <div className="mt-4 flex flex-col gap-3 lg:mt-5 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-5">
        <div className="lg:hidden">{crestPanel}</div>
        <div>{contractPanel}</div>
        <div className="hidden flex-col gap-4 lg:flex">
          {crestPanel}
          {gafferNote}
        </div>
      </div>
    </section>
  );
}

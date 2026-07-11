"use client";

// First-run flow: create your player once. Signing day at the club.

import { useMemo, useState } from "react";
import { createPlayer, POSITIONS, POSITION_LABELS, type PlayerRow, type Position } from "@/lib/player";
import { PlayerAvatar } from "./PlayerAvatar";

export function SigningForm({ onSigned }: { onSigned: (player: PlayerRow) => void }) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("ST");
  const [shirtNumber, setShirtNumber] = useState(9);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewName = useMemo(() => name.trim() || "Unnamed", [name]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await createPlayer({ name: name.trim(), position, shirtNumber });
    setBusy(false);
    if (res.player) onSigned(res.player);
    else setError(res.error ?? "The fax machine jammed. Try again.");
  };

  return (
    <section
      aria-label="Create your player"
      className="rounded-lg border border-pitch-600 bg-pitch-850"
    >
      <div className="border-b border-pitch-700 px-5 py-4">
        <h2 className="font-display text-xl font-black uppercase tracking-tight text-chalk-50">
          Signing day
        </h2>
        <p className="mt-1 text-sm text-chalk-400">
          One player, one career. Pick a name, a shirt, a position. The gaffer
          only asks once.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
        <div className="flex items-center gap-4">
          <PlayerAvatar name={previewName} shirtNumber={shirtNumber} size={64} />
          <p className="whisper">
            Your crest. It follows from your name and number; there is no
            changing room mirror.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="player-name" className="whisper">
            Name on the shirt
          </label>
          <input
            id="player-name"
            type="text"
            required
            maxLength={20}
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Twenty characters, tops"
            aria-describedby="player-name-permanent"
            className="min-h-[44px] rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-base text-chalk-50 placeholder:text-chalk-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
          />
          <p id="player-name-permanent" className="text-xs text-chalk-400">
            Choose carefully. This name is permanent.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="player-number" className="whisper">
              Squad number
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
              className="min-h-[44px] rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-base tabular-nums text-chalk-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="player-position" className="whisper">
              Position
            </label>
            <select
              id="player-position"
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
              className="min-h-[44px] rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-base text-chalk-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p} · {POSITION_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || name.trim().length === 0}
          className="min-h-[52px] w-full rounded-lg bg-volt px-6 py-3 font-display text-lg font-black uppercase tracking-wide text-pitch-950 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950 enabled:hover:bg-volt-bright enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Signing..." : "Sign the forms"}
        </button>

        {error && (
          <p role="alert" className="text-center text-sm text-chalk-300">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

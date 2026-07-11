"use client";

// YOUR TEAM row, per the reference: label plus two flat buttons, the
// selected side a light chip. Locks at entry.

import type { Fixture } from "@/lib/feed/types";

export function TeamPicker({
  fixture,
  selected,
  onSelect,
  locked,
}: {
  fixture: Fixture;
  selected: 1 | 2;
  onSelect: (team: 1 | 2) => void;
  locked: boolean;
}) {
  const option = (team: 1 | 2, name: string) => {
    const active = selected === team;
    return (
      <button
        type="button"
        disabled={locked}
        aria-pressed={active}
        onClick={() => onSelect(team)}
        className="min-h-[40px] flex-1 truncate rounded-lg px-3 py-[9px] font-label text-[10px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 disabled:cursor-default"
        style={{
          border: `1px solid ${active ? "#e4e4e7" : "rgba(255,255,255,.12)"}`,
          background: active ? "#e4e4e7" : "transparent",
          color: active ? "#0a0a0c" : "#a1a1aa",
        }}
      >
        {name}
      </button>
    );
  };

  return (
    <fieldset aria-label="Pick your side" className="flex items-center gap-3">
      <legend className="sr-only">Whose shirt are you pulling on?</legend>
      <span className="font-label text-[9px] font-bold uppercase tracking-[0.14em] text-chalk-500">
        Your team
      </span>
      <div className="flex min-w-0 flex-1 gap-1.5">
        {option(1, fixture.participant1)}
        {option(2, fixture.participant2)}
      </div>
    </fieldset>
  );
}

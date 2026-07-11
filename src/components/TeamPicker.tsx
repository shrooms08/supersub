"use client";

// Pick your side before you step on. Locks at entry.

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
        className={`min-h-[48px] flex-1 truncate rounded-md border px-3 py-3 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 ${
          active
            ? "border-chalk-100 bg-pitch-700 text-chalk-50"
            : "border-pitch-600 bg-pitch-850 text-chalk-400 hover:border-chalk-600 hover:text-chalk-200"
        } ${locked ? "cursor-default opacity-90" : ""}`}
      >
        {name}
      </button>
    );
  };

  return (
    <fieldset aria-label="Pick your side">
      <legend className="whisper mb-2">
        {locked ? "Your side, locked at entry" : "Whose shirt are you pulling on?"}
      </legend>
      <div className="flex gap-2">
        {option(1, fixture.participant1)}
        {option(2, fixture.participant2)}
      </div>
    </fieldset>
  );
}

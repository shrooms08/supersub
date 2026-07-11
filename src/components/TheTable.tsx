// The Table: every player in the instance ranked by Impact Rating.
// Read-only social proof. Your row is the volt one:
// bg rgba(200,255,0,.09), border rgba(200,255,0,.55), volt rank and
// rating. Everyone else is grayscale.

import type { TableRow } from "@/app/api/matchday/route";
import { PixelCrest } from "./PixelCrest";

export function TheTable({ rows }: { rows: TableRow[] }) {
  return (
    <section aria-label="The table" className="panel-quiet overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-pitch-700 px-4 py-2">
        <h2 className="label">The table</h2>
        <p className="whisper">By Impact Rating</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="font-label text-sm font-bold text-chalk-300">Nobody on the books yet.</p>
          <p className="whisper mt-1.5">The first name signed tops the table by default.</p>
          <p className="mt-1 font-label text-xs text-chalk-500">It could be yours. Sign above.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1 p-2">
          {rows.map((row) => (
            <li
              key={`${row.rank}:${row.name}:${row.shirtNumber}`}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
              style={{
                background: row.isYou ? "rgba(200,255,0,.09)" : "transparent",
                border: row.isYou
                  ? "1px solid rgba(200,255,0,.55)"
                  : "1px solid rgba(255,255,255,.05)",
              }}
            >
              <span
                className={`hero-number w-6 shrink-0 text-base leading-none ${
                  row.isYou ? "text-volt" : "text-chalk-600"
                }`}
              >
                {row.rank}
              </span>
              <PixelCrest
                seed={`${row.name}-${row.shirtNumber}`}
                number={row.shirtNumber}
                size={20}
                className="shrink-0"
              />
              <span className="min-w-0 flex-1 truncate">
                <span
                  className={`font-label text-sm font-bold ${
                    row.isYou ? "text-chalk-50" : "text-chalk-300"
                  }`}
                >
                  {row.name}
                </span>
                <span className="ml-1.5 font-label text-xs text-chalk-500">
                  #{row.shirtNumber}
                </span>
                {row.isYou && <span className="whisper ml-2">You</span>}
              </span>
              <span className="shrink-0 font-label text-xs tabular-nums text-chalk-500">
                {row.apps}
              </span>
              <span
                className={`hero-number w-12 shrink-0 text-right text-[17px] leading-none ${
                  row.isYou ? "text-volt" : "text-chalk-400"
                }`}
              >
                {row.rating === null ? "--" : Math.round(row.rating)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

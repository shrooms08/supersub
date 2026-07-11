// The Table: every player in the instance ranked by Impact Rating.
// Read-only social proof. Your row is the volt one:
// bg rgba(200,255,0,.09), border rgba(200,255,0,.55), volt rank and
// rating. Everyone else is grayscale.

import type { TableRow } from "@/app/api/matchday/route";

export function TheTable({ rows }: { rows: TableRow[] }) {
  return (
    <section aria-label="The table">
      <div className="flex items-baseline justify-between px-1 pb-2">
        <h2 className="font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-chalk-500">
          The table
        </h2>
        <p className="font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-chalk-600">
          Impact ranking
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="font-label text-sm font-bold text-chalk-300">Nobody on the books yet.</p>
          <p className="whisper mt-1.5">The first name signed tops the table by default.</p>
          <p className="mt-1 font-label text-xs text-chalk-500">It could be yours. Sign above.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#0d0d10]">
          {rows.map((row) => (
            <li
              key={`${row.rank}:${row.name}:${row.shirtNumber}`}
              className="flex items-center gap-[11px] px-3 py-[9px]"
              style={{
                background: row.isYou ? "rgba(200,255,0,.09)" : "transparent",
                borderBottom: row.isYou
                  ? "1px solid rgba(200,255,0,.55)"
                  : "1px solid rgba(255,255,255,.05)",
                borderTop: row.isYou ? "1px solid rgba(200,255,0,.55)" : "none",
              }}
            >
              <span
                className={`hero-number w-[22px] shrink-0 text-base leading-none ${
                  row.isYou ? "text-volt" : "text-chalk-600"
                }`}
              >
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span
                  className={`font-label text-xs font-semibold tracking-[0.02em] ${
                    row.isYou ? "text-chalk-50" : "text-chalk-300"
                  }`}
                >
                  {row.name}
                </span>
                <span className="ml-1.5 font-label text-[10px] text-chalk-600">
                  #{row.shirtNumber}
                </span>
                {row.isYou && (
                  <span className="ml-2 font-label text-[9px] font-bold uppercase tracking-[0.14em] text-chalk-500">
                    You
                  </span>
                )}
              </span>
              <span className="shrink-0 font-label text-[10px] tabular-nums text-chalk-600">
                {row.apps}
              </span>
              <span
                className={`hero-number w-12 shrink-0 text-right text-[17px] tabular-nums leading-none ${
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

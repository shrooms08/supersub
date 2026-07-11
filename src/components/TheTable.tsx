// The Table: every player in the instance ranked by Impact Rating.
// Read-only social proof. Your row is the one with the volt numeral.

import type { TableRow } from "@/app/api/matchday/route";

export function TheTable({ rows }: { rows: TableRow[] }) {
  return (
    <section aria-label="The table" className="panel-quiet overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-pitch-700 px-4 py-2">
        <h2 className="label">The table</h2>
        <p className="whisper">By Impact Rating</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm font-bold text-chalk-300">Nobody on the books yet.</p>
          <p className="whisper mt-1.5">The first name signed tops the table by default.</p>
          <p className="mt-1 text-xs text-chalk-500">It could be yours. Sign above.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pitch-800">
              <th scope="col" className="label px-4 py-1.5 text-left font-bold">#</th>
              <th scope="col" className="label py-1.5 text-left font-bold">Player</th>
              <th scope="col" className="label py-1.5 text-right font-bold">Apps</th>
              <th scope="col" className="label px-4 py-1.5 text-right font-bold">Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.rank}:${row.name}:${row.shirtNumber}`}
                className={`border-b border-pitch-800 last:border-b-0 ${
                  row.isYou ? "bg-pitch-800/70" : ""
                }`}
              >
                <td className="px-4 py-2">
                  <span
                    className={`hero-number text-lg leading-none ${
                      row.isYou ? "text-volt" : "text-chalk-500"
                    }`}
                  >
                    {row.rank}
                  </span>
                </td>
                <td className="py-2">
                  <span className={`font-bold ${row.isYou ? "text-chalk-50" : "text-chalk-200"}`}>
                    {row.name}
                  </span>
                  <span className="ml-1.5 text-xs text-chalk-500">#{row.shirtNumber}</span>
                  {row.isYou && <span className="whisper ml-2">You</span>}
                </td>
                <td className="py-2 text-right tabular-nums text-chalk-400">{row.apps}</td>
                <td className="px-4 py-2 text-right">
                  <span className="font-display font-black tabular-nums text-chalk-100">
                    {row.rating === null ? "--" : Math.round(row.rating)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

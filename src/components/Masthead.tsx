// The Bench header, per the reference: volt eyebrow, Saira title, date
// and fixture count right on mobile; TODAY chip plus a volt LIVE NOW
// chip at desktop.

export function Masthead({
  liveNow,
  liveCount,
  fixtureCount,
  dateMs,
}: {
  liveNow: boolean;
  liveCount: number;
  fixtureCount: number | null;
  dateMs: number;
}) {
  const date = new Date(dateMs)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();
  return (
    <header className="flex items-end justify-between gap-3">
      <div>
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-volt">
          The Bench
        </p>
        <div className="mt-1 flex items-center gap-2">
          {/* The brand mark, inline so it paints with the header (no fetch,
              no layout shift) and sits at 24px next to the title. */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 100 100"
            aria-hidden
            className="shrink-0 rounded-[6px]"
          >
            <rect width="100" height="100" fill="#0b0b0d" />
            <path
              fill="#c8ff00"
              fillRule="evenodd"
              d="M26,12 H74 A18,18 0 0 1 92,30 V70 A18,18 0 0 1 74,88 H26 A18,18 0 0 1 8,70 V30 A18,18 0 0 1 26,12 Z M36,28 L47,46 L41,46 L41,72 L31,72 L31,46 L25,46 Z M64,72 L75,54 L69,54 L69,28 L59,28 L59,54 L53,54 Z"
            />
          </svg>
          <h1 className="hero-number text-[26px] uppercase leading-[0.9] text-chalk-50 lg:text-4xl">
            Matchday
          </h1>
        </div>
      </div>

      {/* Mobile: stacked date + count. Desktop: chips. */}
      <div className="text-right lg:hidden">
        <p className="font-label text-[10px] font-semibold tracking-[0.12em] text-chalk-500">
          {date}
        </p>
        <p className="mt-1.5 font-label text-[10px] font-semibold tracking-[0.12em] text-chalk-600">
          {fixtureCount === null ? "CHECKING THE BOARD" : `${fixtureCount} FIXTURES`}
        </p>
      </div>
      <div className="hidden gap-2 lg:flex">
        <div className="rounded-[9px] border border-white/[0.07] bg-pitch-900 px-3 py-1.5 text-right">
          <p className="font-label text-[8px] font-semibold uppercase tracking-[0.16em] text-chalk-600">
            Today
          </p>
          <p className="hero-number mt-0.5 text-lg leading-none text-chalk-50">{date}</p>
        </div>
        {liveNow && (
          <div
            className="flex items-center gap-2 rounded-[9px] px-3"
            style={{ border: "1px solid rgba(200,255,0,.35)", background: "rgba(200,255,0,.07)" }}
          >
            <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-volt animate-live-pulse" />
            <span className="font-label text-[9px] font-bold uppercase tracking-[0.16em] text-volt">
              {liveCount} live now
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

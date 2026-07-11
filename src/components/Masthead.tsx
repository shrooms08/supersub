// The MATCHDAY masthead: broadcast package top strip. Date, the wordmark,
// and a live-now beacon when anything is in play.

export function Masthead({ liveNow, dateMs }: { liveNow: boolean; dateMs: number }) {
  const date = new Date(dateMs)
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();
  return (
    <header className="border-b border-pitch-600 pb-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">{date}</p>
        {liveNow ? (
          <p className="flex items-center gap-1.5 font-label text-[10px] font-bold uppercase tracking-[0.24em] text-volt">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-volt animate-live-pulse" />
            In play now
          </p>
        ) : (
          <p className="label">The whistle is coming</p>
        )}
      </div>
      <h1 className="hero-number mt-1 text-[15vw] uppercase leading-[0.86] tracking-[0.01em] text-chalk-50 sm:text-7xl">
        MATCHDAY
      </h1>
      <p className="mt-1.5 font-label text-sm text-chalk-400">
        Super Sub. One decision: when you step on, everything after is yours.
      </p>
    </header>
  );
}

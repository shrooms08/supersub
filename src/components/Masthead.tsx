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
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-chalk-100">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-chalk-100 animate-live-dot" />
            In play now
          </p>
        ) : (
          <p className="label">The whistle is coming</p>
        )}
      </div>
      <h1 className="display-expanded mt-1 font-display text-[13vw] font-black leading-[0.9] tracking-tight text-chalk-50 sm:text-6xl">
        MATCHDAY
      </h1>
      <p className="mt-1.5 text-sm text-chalk-400">
        Super Sub. One decision: when you step on, everything after is yours.
      </p>
    </header>
  );
}

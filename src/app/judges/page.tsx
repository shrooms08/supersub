// One screen for judges. Two doors, three sentences, no tour.

import Link from "next/link";

export const metadata = {
  title: "Super Sub · For the judges",
};

export default function JudgesPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col gap-3 text-center">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-chalk-50">
          Super Sub
        </h1>
        <p className="text-base leading-relaxed text-chalk-300">
          You are a fantasy substitute: pick your moment in a real match, enter
          the pitch, and everything after that minute is yours, multiplied by
          how lost the cause looked when you stepped on. The tournament is
          over, so the buttons below replay real recorded TxLINE World Cup data
          through the exact same pipeline the live feed uses. Create a player,
          come on for Morocco, and see what the booth takes away.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <Link
          href="/match/18209181?mode=replay&speed=8"
          className="flex min-h-[76px] items-center justify-center rounded-lg bg-volt px-6 py-5 text-center font-display text-xl font-black uppercase tracking-wide text-pitch-950 transition-transform hover:bg-volt-bright active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950"
        >
          Watch a replayed match live
        </Link>
        <Link
          href="/"
          className="flex min-h-[76px] items-center justify-center rounded-lg border-2 border-chalk-600 px-6 py-5 text-center font-display text-xl font-black uppercase tracking-wide text-chalk-50 transition-colors hover:border-chalk-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          Create your player and play
        </Link>
      </div>

      <p className="whisper text-center">
        France v Morocco, 2026-07-09, replayed at 8x. Every goal, VAR call, and
        odds tick below is real.
      </p>
    </main>
  );
}

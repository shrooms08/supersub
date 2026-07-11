// The judges' door: one heading, two sentences, then the three bundled
// replay fixtures. Each replays real recorded TxLINE World Cup data
// through the exact pipeline the live feed uses. The bench no longer
// carries a replays rail; this is where the demo path lives.

import { createReplaySource } from "@/lib/sources/replay";
import { JudgesReplays } from "@/components/JudgesReplays";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Super Sub · For the judges",
};

export default async function JudgesPage() {
  let listings = [] as Awaited<ReturnType<ReturnType<typeof createReplaySource>["listFixtures"]>>;
  try {
    listings = await createReplaySource().listFixtures();
  } catch {
    listings = [];
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-7 px-4 py-10">
      <header className="flex flex-col gap-3 text-center">
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-volt">
          Super Sub · For the judges
        </p>
        <h1 className="hero-number text-4xl uppercase leading-none text-chalk-50">
          Replay a real match
        </h1>
        <p className="text-sm leading-relaxed text-chalk-300">
          Pick your moment in a real recorded World Cup match, enter the pitch, and everything
          after that minute is yours, multiplied by how lost the cause looked when you stepped on.
          Each button below replays genuine TxLINE data, every goal and VAR call, through the exact
          pipeline the live feed uses.
        </p>
      </header>

      <JudgesReplays listings={listings} />
    </main>
  );
}

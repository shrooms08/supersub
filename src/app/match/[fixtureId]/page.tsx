import { MatchScreen } from "@/components/MatchScreen";

export const dynamic = "force-dynamic";

export default function MatchPage({
  params,
  searchParams,
}: {
  params: { fixtureId: string };
  searchParams: { mode?: string; speed?: string };
}) {
  const fixtureId = Number(params.fixtureId);
  return (
    <MatchScreen
      fixtureId={fixtureId}
      mode={searchParams.mode ?? null}
      speed={searchParams.speed ?? null}
    />
  );
}

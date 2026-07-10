// The player's crest: deterministic pixel avatar from name + number.
// Grayscale on purpose; volt stays reserved for CTA, curve, hero numbers.

import { avatarSpec } from "@/lib/avatar";

export function PlayerAvatar({
  name,
  shirtNumber,
  size = 48,
  className,
}: {
  name: string;
  shirtNumber: number;
  size?: number;
  className?: string;
}) {
  const spec = avatarSpec(name, shirtNumber);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 7"
      role="img"
      aria-label={`${name}'s crest`}
      className={`rounded-md ${className ?? ""}`}
      shapeRendering="crispEdges"
    >
      <rect width="7" height="7" fill={spec.background} />
      {spec.grid.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect key={`${x}:${y}`} x={x + 1} y={y + 1} width="1" height="1" fill={spec.foreground} />
          ) : null
        )
      )}
    </svg>
  );
}

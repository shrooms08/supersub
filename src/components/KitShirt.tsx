// The anonymous kit: a shirt-and-number silhouette, the product's face.
// No player likenesses anywhere; the kit tone is derived from the same
// deterministic hash as the crest, so a player's shirt is always theirs.

import { avatarSpec } from "@/lib/avatar";

export function KitShirt({
  name,
  shirtNumber,
  size = 96,
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
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Kit number ${shirtNumber}`}
      className={className}
    >
      {/* sleeves */}
      <path
        d="M31 16 L10 26 L4 46 L22 52 L26 40 Z"
        fill={spec.background}
        stroke="rgba(245,245,242,0.14)"
        strokeWidth="1.5"
      />
      <path
        d="M69 16 L90 26 L96 46 L78 52 L74 40 Z"
        fill={spec.background}
        stroke="rgba(245,245,242,0.14)"
        strokeWidth="1.5"
      />
      {/* body */}
      <path
        d="M31 16 L42 11 Q50 19 58 11 L69 16 L74 40 L72 92 Q50 97 28 92 L26 40 Z"
        fill={spec.background}
        stroke="rgba(245,245,242,0.2)"
        strokeWidth="1.5"
      />
      {/* collar */}
      <path
        d="M42 11 Q50 19 58 11"
        fill="none"
        stroke={spec.foreground}
        strokeWidth="2"
        opacity="0.5"
      />
      {/* number */}
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fontFamily="var(--font-saira), Arial Narrow, sans-serif"
        fontWeight="900"
        fontSize="38"
        fill={spec.foreground}
      >
        {shirtNumber}
      </text>
    </svg>
  );
}

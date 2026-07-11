// Last five windows as W/D/L chips, most recent first. Chip treatment
// per the reference: W light chip dark glyph, D charcoal, L outlined.

import type { WindowResult } from "@/lib/career/window";

const LOOK: Record<WindowResult, { bg: string; col: string; bd: string }> = {
  W: { bg: "#e4e4e7", col: "#0a0a0c", bd: "transparent" },
  D: { bg: "#26262c", col: "#d4d4d8", bd: "transparent" },
  L: { bg: "transparent", col: "#52525b", bd: "#3a3a42" },
};

export function FormChips({ form, size = 20 }: { form: WindowResult[]; size?: number }) {
  if (form.length === 0) {
    return <span className="font-label text-xs text-chalk-500">No windows yet</span>;
  }
  return (
    <span className="flex gap-[5px]" aria-label={`Form, most recent first: ${form.join(", ")}`}>
      {form.map((r, i) => (
        <span
          key={i}
          className="grid place-items-center rounded-[5px] font-label text-[10px] font-bold"
          style={{
            width: size,
            height: size,
            background: LOOK[r].bg,
            color: LOOK[r].col,
            border: `1px solid ${LOOK[r].bd}`,
          }}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

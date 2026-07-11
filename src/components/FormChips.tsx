// Last five windows as W/D/L chips, most recent first. Shared by the
// bench player card and the career record.

import type { WindowResult } from "@/lib/career/window";

export function FormChips({ form, size = 7 }: { form: WindowResult[]; size?: 6 | 7 }) {
  if (form.length === 0) {
    return <span className="text-xs text-chalk-500">No windows yet</span>;
  }
  const box = size === 6 ? "h-6 w-6 text-[11px]" : "h-7 w-7 text-xs";
  return (
    <span className="flex gap-1.5" aria-label={`Form, most recent first: ${form.join(", ")}`}>
      {form.map((r, i) => (
        <span
          key={i}
          className={`flex items-center justify-center rounded-sm font-black ${box} ${
            r === "W"
              ? "bg-chalk-100 text-pitch-950"
              : r === "D"
                ? "bg-pitch-600 text-chalk-100"
                : "border border-pitch-600 bg-pitch-800 text-chalk-500"
          }`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

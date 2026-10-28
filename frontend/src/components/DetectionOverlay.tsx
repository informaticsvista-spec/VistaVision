import type { Box } from "../types";

export interface OverlayItem {
  key: string | number;
  box: Box; // normalised 0..1
  label: string;
  color: string;
  dashed?: boolean;
}

/** Draws boxes and labels in percentages over a positioned parent. Works for video and still images. */
export function DetectionOverlay({ items, mirrored = false }: { items: OverlayItem[]; mirrored?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {items.map((item) => {
        const left = mirrored ? 1 - (item.box.x + item.box.w) : item.box.x;
        const labelAtBottom = item.box.y < 0.07;
        return (
          <div
            key={item.key}
            className="absolute rounded-md"
            style={{
              left: `${left * 100}%`, top: `${item.box.y * 100}%`, width: `${item.box.w * 100}%`, height: `${item.box.h * 100}%`,
              border: `3px ${item.dashed ? "dashed" : "solid"} ${item.color}`, boxShadow: "0 0 0 1px rgba(0,0,0,.35)",
            }}
          >
            <span
              className="absolute left-[-3px] max-w-[260px] whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold leading-tight text-white sm:text-xs"
              style={{ background: item.color, [labelAtBottom ? "top" : "bottom"]: "100%", textShadow: "0 1px 1px rgba(0,0,0,.4)" }}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

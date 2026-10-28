import { useRef, useState } from "react";
import type { Box } from "../types";

/** Drag a rectangle over an image to choose the region to analyse. Reports a normalised box, or null. */
export function CropSelector({ src, onChange, children }: { src: string; onChange: (box: Box | null) => void; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = pos(e);
    setBox(null);
    onChange(null);
  };
  const move = (e: React.PointerEvent) => {
    if (!start.current) return;
    const p = pos(e), s = start.current;
    setBox({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const up = () => {
    start.current = null;
    setBox((b) => {
      const valid = b && b.w > 0.05 && b.h > 0.05 ? b : null;
      onChange(valid);
      return valid;
    });
  };

  return (
    <div ref={ref} className="no-touch-scroll relative w-full cursor-crosshair overflow-hidden rounded-2xl bg-navy-950" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <img src={src} alt="Captured image. Drag to select the area with your number." className="pointer-events-none block w-full" draggable={false} />
      {children}
      {box && (
        <div
          className="pointer-events-none absolute border-2 border-cyan-400 bg-cyan-400/10"
          style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, boxShadow: "0 0 0 9999px rgba(7,13,36,.45)" }}
        />
      )}
    </div>
  );
}

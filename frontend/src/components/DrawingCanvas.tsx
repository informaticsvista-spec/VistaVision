import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cx } from "../lib/format";

interface Stroke {
  points: { x: number; y: number }[]; // x, y as fractions of canvas width (so strokes survive resizing)
  width: number; // fraction of canvas width
  erase: boolean;
}

export interface DrawingHandle {
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
  hasInk: () => boolean;
}

const ASPECT = 2; // width : height
const EXPORT_WIDTH = 900;

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], widthPx: number, heightPx: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    ctx.strokeStyle = stroke.erase ? "#ffffff" : "#111111";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = stroke.width * widthPx * (stroke.erase ? 2.2 : 1);
    const pts = stroke.points.map((p) => ({ x: p.x * widthPx, y: p.y * widthPx }));
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }
}

/** Touch / stylus / mouse drawing surface: dark brush on white, with undo, erase and adjustable width. */
export const DrawingCanvas = forwardRef<DrawingHandle, { onInkChange?: (hasInk: boolean) => void; disabled?: boolean }>(function DrawingCanvas({ onInkChange, disabled }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const active = useRef<Stroke | null>(null);
  const [brush, setBrush] = useState(18); // in 1/600ths of canvas width
  const [erase, setErase] = useState(false);
  const [count, setCount] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    paint(ctx, active.current ? [...strokes.current, active.current] : strokes.current, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = wrap.clientWidth;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round((width / ASPECT) * dpr);
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [redraw]);

  const inkCount = () => strokes.current.filter((s) => !s.erase).length;
  const notify = () => {
    setCount(strokes.current.length);
    onInkChange?.(inkCount() > 0);
  };

  const pointFrom = (event: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: ((event.clientY - rect.top) / rect.width) };
  };

  const onDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = { points: [pointFrom(event)], width: brush / 600, erase };
    redraw();
  };
  const onMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active.current) return;
    event.preventDefault();
    const events = (event.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    const list = events.length ? events : [event.nativeEvent];
    const rect = canvasRef.current!.getBoundingClientRect();
    for (const e of list) active.current.points.push({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.width });
    redraw();
  };
  const finish = () => {
    if (!active.current) return;
    strokes.current.push(active.current);
    active.current = null;
    redraw();
    notify();
  };

  const clear = () => {
    strokes.current = [];
    active.current = null;
    redraw();
    notify();
  };
  const undo = () => {
    strokes.current.pop();
    redraw();
    notify();
  };

  useImperativeHandle(ref, () => ({
    clear,
    hasInk: () => inkCount() > 0,
    toBlob: () =>
      new Promise((resolve) => {
        const out = document.createElement("canvas");
        out.width = EXPORT_WIDTH;
        out.height = EXPORT_WIDTH / ASPECT;
        paint(out.getContext("2d")!, strokes.current, out.width, out.height);
        out.toBlob((b) => resolve(b), "image/png");
      }),
  }));

  return (
    <div className="space-y-3">
      <div ref={wrapRef} className="w-full overflow-hidden rounded-2xl border-2 border-dashed border-indigo-500/40 bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          aria-label="Drawing area. Draw a digit with your finger, stylus or mouse."
          role="img"
          className={cx("no-touch-scroll block w-full", erase ? "cursor-cell" : "cursor-crosshair")}
          style={{ aspectRatio: `${ASPECT} / 1`, touchAction: "none" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={undo} disabled={count === 0 || disabled}>Undo</button>
        <button className={erase ? "btn-primary" : "btn-secondary"} aria-pressed={erase} onClick={() => setErase((v) => !v)} disabled={disabled}>
          {erase ? "Erasing — tap to draw" : "Erase"}
        </button>
        <button className="btn-secondary" onClick={clear} disabled={count === 0 || disabled}>Clear</button>
        <label className="ml-auto flex min-w-[170px] flex-1 items-center gap-2 text-xs font-semibold text-navy-700 sm:flex-none">
          Brush
          <input type="range" min={8} max={40} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-full accent-indigo-600" aria-label="Brush width" />
        </label>
      </div>
    </div>
  );
});

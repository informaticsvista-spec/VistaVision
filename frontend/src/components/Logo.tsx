import { useId } from "react";
import { cx } from "../lib/format";

/** VistaVision mark: a friendly "AI eye" - a lens-like iris with a sparkle, on a purple-to-pink tile. Original artwork. */
export function Logo({ size = 44, className, rounded = "rounded-xl", bare = false }: { size?: number; className?: string; rounded?: string; bare?: boolean }) {
  const id = useId();
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center overflow-hidden", !bare && "shadow-md shadow-indigo-600/30", rounded, className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="VistaVision logo">
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#ff6bb5" />
          </linearGradient>
        </defs>
        {!bare && <rect width="64" height="64" fill={`url(#${id}g)`} />}
        <path d="M6 32C14 19 23 13 32 13s18 6 26 19c-8 13-17 19-26 19S14 45 6 32Z" fill="#fff" />
        <circle cx="32" cy="32" r="12" fill="#25104f" />
        <circle cx="32" cy="32" r="6" fill="#ffc933" />
        <circle cx="27.5" cy="27.5" r="3" fill="#fff" />
        <path d="M49 8l1.6 4.4L55 14l-4.4 1.6L49 20l-1.6-4.4L43 14l4.4-1.6Z" fill="#fff" opacity=".95" />
      </svg>
    </span>
  );
}

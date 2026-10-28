import { cx } from "../lib/format";

/** The two supplied institutional logos: PMIST (college) and VISTA (department). Both have white backgrounds, so they sit on a white badge. */
export function InstitutionLogos({ height = 40, className, stacked = false }: { height?: number; className?: string; stacked?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-3 rounded-xl bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5", stacked && "flex-col sm:flex-row", className)}>
      <img src="/logo-pmist.png" alt="Periyar Maniammai Institute of Science & Technology (PMIST) logo" style={{ height }} className="w-auto" draggable={false} />
      <span aria-hidden className="h-[70%] w-px self-stretch bg-mist-300" />
      <img src="/logo-vista.png" alt="VISTA department logo" style={{ height }} className="w-auto" draggable={false} />
    </span>
  );
}

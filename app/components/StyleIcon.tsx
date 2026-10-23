/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// Figma component "Style icon" (20×14): the glyph for a style channel.
export type StyleIconKind = "color" | "rainbow" | "size" | "shape" | "time" | "none";

export default function StyleIcon({ kind }: { kind: StyleIconKind }) {
  if (kind === "size") return <img src="/figma/style-size.svg" width={20} height={14} alt="" className="shrink-0" />;
  if (kind === "shape") return <img src="/figma/style-shape.svg" width={20} height={14} alt="" className="shrink-0" />;
  if (kind === "time") {
    return (
      <svg aria-hidden width={20} height={14} viewBox="0 0 20 14" fill="none" className="shrink-0">
        <circle cx="10" cy="7" r="5.5" stroke="#FAFAFA" strokeWidth="1.5" />
        <path d="M10 4.25V7l1.9 1.3" stroke="#FAFAFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "none") {
    return (
      <span aria-hidden className="relative h-[14px] w-[20px] shrink-0">
        <span className="absolute top-[6.25px] left-[6px] h-[1.5px] w-[8px] bg-ink-muted" />
        <span className="absolute top-[3px] left-[9.25px] h-[8px] w-[1.5px] bg-ink-muted" />
      </span>
    );
  }
  const gradient = kind === "color"
    ? "linear-gradient(90deg, #fef3c7, #f97316, #9a3412)"
    : "linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899)";
  return (
    <span aria-hidden className="relative h-[14px] w-[20px] shrink-0">
      <span className="absolute top-[2px] left-0 h-[10px] w-[20px] rounded-[3px]" style={{ background: gradient }} />
    </span>
  );
}

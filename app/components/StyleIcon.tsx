/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// Figma component "Style icon" (20×14): the glyph for a style channel.
import { FLOW_RAMP, SUNSET } from "@/lib/point-style";

export type StyleIconKind = "color" | "flowColor" | "rainbow" | "size" | "shape" | "width" | "none";

export default function StyleIcon({ kind }: { kind: StyleIconKind }) {
  if (kind === "size") return <img src="/figma/style-size.svg" width={20} height={14} alt="" className="shrink-0" />;
  if (kind === "shape") return <img src="/figma/style-shape.svg" width={20} height={14} alt="" className="shrink-0" />;
  if (kind === "none") {
    return (
      <span aria-hidden className="relative h-[14px] w-[20px] shrink-0">
        <span className="absolute top-[6.25px] left-[6px] h-[1.5px] w-[8px] bg-ink-muted" />
        <span className="absolute top-[3px] left-[9.25px] h-[8px] w-[1.5px] bg-ink-muted" />
      </span>
    );
  }
  if (kind === "width") {
    return (
      <svg aria-hidden width={20} height={14} viewBox="0 0 20 14" className="shrink-0">
        <polygon points="1,6.25 19,3 19,11 1,7.75" className="fill-ink" />
      </svg>
    );
  }
  const gradient = kind === "color"
    ? `linear-gradient(90deg, ${SUNSET.join(", ")})`
    : kind === "flowColor"
    ? `linear-gradient(90deg, ${FLOW_RAMP.join(", ")})`
    : "linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899)";
  return (
    <span aria-hidden className="relative h-[14px] w-[20px] shrink-0">
      <span className="absolute top-[2px] left-0 h-[10px] w-[20px] rounded-[3px]" style={{ background: gradient }} />
    </span>
  );
}

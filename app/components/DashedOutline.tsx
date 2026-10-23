// Dashed 1.5px outline with the Figma 8/6 dash pattern (CSS `dashed` can't set
// dash length). Place inside a `relative` box with a matching corner radius.
export default function DashedOutline({ radius, active }: { radius: number; active: boolean }) {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <rect
        x="0.75"
        y="0.75"
        rx={radius - 0.75}
        style={{ width: "calc(100% - 1.5px)", height: "calc(100% - 1.5px)" }}
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="8 6"
        className={`transition-colors ${active ? "stroke-accent-text" : "stroke-line-strong"}`}
      />
    </svg>
  );
}

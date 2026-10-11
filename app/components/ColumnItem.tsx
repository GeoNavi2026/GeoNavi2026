import type { ColumnSummary } from "@/lib/upload-summary";

// Figma component "Column item": one column from the uploaded file,
// its detected type and its header name.
export default function ColumnItem({ column }: { column: ColumnSummary }) {
  return (
    <li className="flex h-[36px] w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[8px]">
      <span className="flex w-[52px] shrink-0 items-center justify-center rounded-[6px] bg-chip py-[2px] text-[11px] leading-[16px] font-medium text-ink-muted">
        {column.kind}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] leading-[20px] text-ink" title={column.name}>
        {column.name}
      </span>
    </li>
  );
}

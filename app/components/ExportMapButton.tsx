"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// "Export map" in the sidebar header (Figma "Export · B · Sidebar header"):
// an icon button opening a panel to pick the format, resolution and whether
// the legend is included, then download the current map view as an image.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { EXPORT_FORMATS, type ExportFormat, type ExportResolution, type ResolutionId } from "@/lib/map-export";
import Button from "./Button";

export type ExportOptions = { format: ExportFormat; resolution: ExportResolution; legend: boolean };

type ExportMapButtonProps = {
  /** Export sizes for the map view as it is now; called when the panel opens. */
  getResolutions: () => ExportResolution[];
  /** Whether there is a legend to include. */
  hasLegend: boolean;
  disabled?: boolean;
  onExport: (options: ExportOptions) => Promise<void>;
};

const PANEL_WIDTH = 280;

export default function ExportMapButton({ getResolutions, hasLegend, disabled = false, onExport }: ExportMapButtonProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ rect: DOMRect; resolutions: ExportResolution[] } | null>(null);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [resolutionId, setResolutionId] = useState<ResolutionId>("view");
  const [legend, setLegend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, formatNumber } = useI18n();

  // Close on outside click, Escape, or scroll/resize (the panel is fixed-positioned).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        triggerRef.current?.focus();
      }
    };
    const close = () => setOpen(null);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(null);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setError(null);
      setOpen({ rect, resolutions: getResolutions() });
    }
  };

  const resolution = open?.resolutions.find((r) => r.id === resolutionId) ?? open?.resolutions[0];
  const download = async () => {
    if (!resolution) return;
    setBusy(true);
    setError(null);
    try {
      await onExport({ format, resolution, legend: hasLegend && legend });
      setOpen(null);
    } catch (err) {
      setError(t("export.failed", { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        size="icon"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open !== null}
        aria-label={t("export.button")}
        title={t("export.button")}
        className={open ? "ring-[1.5px] ring-accent-text" : ""}
      >
        <img src="/figma/icon-download.svg" width={18} height={18} alt="" />
      </Button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t("export.title")}
          className="fixed z-50 flex flex-col gap-[2px] rounded-[10px] border border-line-strong/60 bg-chip p-[6px] shadow-[0px_8px_24px_0px_rgba(0,0,0,0.45)]"
          style={{
            width: PANEL_WIDTH,
            top: open.rect.bottom + 6,
            left: Math.max(8, Math.min(open.rect.left, window.innerWidth - PANEL_WIDTH - 8)),
          }}
        >
          <div className="flex flex-col gap-[2px] px-[10px] pt-[6px] pb-[4px]">
            <h2 className="text-[13px] leading-[18px] font-semibold text-ink">{t("export.title")}</h2>
            <p className="text-[11px] leading-[14px] text-ink-muted">{t("export.subtitle")}</p>
          </div>

          <Choices legend={t("export.format")}>
            {EXPORT_FORMATS.map((f) => (
              <Choice
                key={f}
                name="export-format"
                label={t(`export.${f}`)}
                hint={t(`export.${f}Hint`)}
                checked={format === f}
                onChange={() => setFormat(f)}
              />
            ))}
          </Choices>

          <div className="my-[2px] h-px bg-line-strong/50" />

          <Choices legend={t("export.resolution")}>
            {open.resolutions.map((r) => (
              <Choice
                key={r.id}
                name="export-resolution"
                label={t(`export.${r.id}`)}
                hint={t("export.size", { width: formatNumber(r.width), height: formatNumber(r.height) })}
                checked={resolution?.id === r.id}
                onChange={() => setResolutionId(r.id)}
              />
            ))}
          </Choices>

          {/* Always shown so it can be found; without a styled column there's no legend to add. */}
          <label
            className={`flex items-center gap-[8px] px-[10px] pt-[6px] pb-[8px] ${hasLegend ? "cursor-pointer" : "cursor-default"}`}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`text-[13px] leading-[18px] ${hasLegend ? "text-ink" : "text-ink-muted"}`}>{t("export.legend")}</span>
              {!hasLegend && <span className="text-[11px] leading-[14px] text-ink-muted">{t("export.noLegend")}</span>}
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={hasLegend && legend}
              disabled={!hasLegend}
              onChange={(e) => setLegend(e.currentTarget.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`flex h-[18px] w-[32px] shrink-0 items-center rounded-full px-[2px] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent-text ${
                hasLegend && legend ? "justify-end bg-accent" : "bg-line-strong"
              } ${hasLegend ? "" : "opacity-40"}`}
            >
              <span className="size-[14px] rounded-full bg-ink" />
            </span>
          </label>

          {error && (
            <p role="alert" className="px-[10px] pb-[4px] text-[12px] leading-[16px] text-[#f87171]">
              {error}
            </p>
          )}

          <div className="px-[4px] pt-[4px] pb-[2px]">
            <Button onClick={download} disabled={busy} className="w-full">
              {busy ? t("export.busy") : t("export.download", { format: t(`export.${format}`) })}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function Choices({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-[2px]">
      <legend className="px-[10px] pt-[6px] pb-[2px] text-[10px] leading-[14px] font-medium tracking-[0.4px] text-ink-muted uppercase">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

// A radio styled like the style menu's items: label, hint, and a check when picked.
function Choice({
  name,
  label,
  hint,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-[10px] rounded-[6px] px-[10px] py-[7px] hover:bg-white/6 has-[:focus-visible]:bg-white/6 ${
        checked ? "bg-white/6" : ""
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] leading-[18px] font-medium text-ink">{label}</span>
        <span className="text-[11px] leading-[14px] text-ink-muted">{hint}</span>
      </span>
      {checked && <img src="/figma/icon-check.svg" width={14} height={14} alt="" />}
    </label>
  );
}

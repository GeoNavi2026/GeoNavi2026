"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// Figma "Style select" next to each column, its "Style menu", and the
// "Color settings" popover (page "3 · Customization").

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  channelAvailability,
  type ColorScale,
  type ColumnProfile,
  type StyleChannel,
} from "@/lib/point-style";
import Button from "./Button";
import StyleIcon, { type StyleIconKind } from "./StyleIcon";

const LABELS: Record<StyleChannel, string> = { color: "Color", size: "Size", shape: "Shape", time: "Time" };

type ColumnStyleControlProps = {
  column: string;
  /** lat/lon columns place the points, so they can't style them. */
  positional: boolean;
  profile: ColumnProfile;
  channel: StyleChannel | null;
  onChannelChange: (channel: StyleChannel | null) => void;
  colorScale: ColorScale;
  colorReverse: boolean;
  onColorOptionsChange: (options: { colorScale?: ColorScale; colorReverse?: boolean }) => void;
};

type Open = null | { kind: "menu" | "settings"; rect: DOMRect };

const iconFor = (channel: StyleChannel | null, numeric: boolean): StyleIconKind =>
  channel === "color" ? (numeric ? "color" : "rainbow") : channel ?? "none";

export default function ColumnStyleControl({
  column,
  positional,
  profile,
  channel,
  onChannelChange,
  colorScale,
  colorReverse,
  onColorOptionsChange,
}: ColumnStyleControlProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open>(null);

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
    if (open?.kind === "menu") panelRef.current?.querySelector<HTMLButtonElement>("[role=menuitemradio]:not([aria-disabled=true])")?.focus();
  }, [open]);

  const available = channelAvailability(profile);
  // lat/lon columns place the points; flow-only columns can only drive Time.
  if (positional || (!profile.onPoints && !available.time.enabled)) {
    return (
      <span
        className="shrink-0 px-[8px] text-[11px] leading-[16px] text-ink-muted"
        title={positional ? "Places the points on the map" : "These values are on flows, not points"}
      >
        {positional ? "Position" : "Flows"}
      </span>
    );
  }

  const toggle = () => {
    if (open) return setOpen(null);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setOpen({ kind: "menu", rect });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open !== null}
        aria-label={`Style for ${column}: ${channel ? LABELS[channel] : "none"}`}
        className={`flex h-[26px] shrink-0 cursor-pointer items-center gap-[6px] rounded-[6px] pr-[6px] pl-[8px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-text ${
          channel ? "bg-chip hover:bg-[#323236]" : "border border-dashed border-line-strong hover:bg-chip"
        } ${open ? "ring-[1.5px] ring-accent-text" : ""}`}
      >
        <StyleIcon kind={iconFor(channel, profile.numeric)} />
        <span className={`text-[12px] leading-[16px] font-medium whitespace-nowrap ${channel ? "text-ink" : "text-ink-muted"}`}>
          {channel ? LABELS[channel] : "Style"}
        </span>
        <img src="/figma/icon-chevron-down.svg" width={12} height={12} alt="" />
      </button>

      {open?.kind === "menu" && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={`Style ${column}`}
          className="fixed z-50 flex w-[236px] flex-col gap-[2px] rounded-[10px] border border-line-strong/60 bg-chip p-[6px] shadow-[0px_8px_24px_0px_rgba(0,0,0,0.45)]"
          style={{ top: open.rect.bottom + 6, left: open.rect.right - 236 }}
        >
          <div className="flex gap-[6px] px-[10px] pt-[6px] pb-[4px] text-[11px] leading-[14px]">
            <span className="font-medium text-ink-muted">Style</span>
            <span className="truncate font-mono text-ink">{column}</span>
          </div>
          <MenuItem
            icon="none"
            label="No style"
            hint="Points keep the default look"
            selected={channel === null}
            onSelect={() => {
              onChannelChange(null);
              setOpen(null);
            }}
          />
          {(Object.keys(LABELS) as StyleChannel[]).map((c) => (
            <MenuItem
              key={c}
              icon={iconFor(c, profile.numeric)}
              label={LABELS[c]}
              hint={available[c].hint}
              selected={channel === c}
              disabled={!available[c].enabled}
              onSelect={() => {
                onChannelChange(c);
                setOpen(null);
              }}
            />
          ))}
          {channel === "color" && profile.numeric && (
            <>
              <div className="my-[2px] h-px bg-line-strong/50" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const rect = triggerRef.current?.getBoundingClientRect();
                  if (rect) setOpen({ kind: "settings", rect });
                }}
                className="flex cursor-pointer items-center gap-[8px] rounded-[6px] px-[10px] py-[8px] text-left hover:bg-white/6 focus-visible:bg-white/6 focus-visible:outline-none"
              >
                <span className="flex-1 text-[13px] leading-[18px] font-medium text-ink">Color settings…</span>
                <img src="/figma/icon-chevron-right.svg" width={14} height={14} alt="" />
              </button>
            </>
          )}
        </div>
      )}

      {open?.kind === "settings" && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Color settings for ${column}`}
          className="fixed z-50 flex w-[300px] flex-col gap-[14px] rounded-[10px] border border-line-strong/60 bg-chip px-[16px] pt-[14px] pb-[16px] shadow-[0px_8px_24px_0px_rgba(0,0,0,0.45)]"
          style={{ top: Math.max(8, open.rect.top - 8), left: open.rect.right + 12 }}
        >
          <div className="flex items-center gap-[8px]">
            <StyleIcon kind="color" />
            <span className="text-[14px] leading-[20px] font-semibold text-ink">Color</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] leading-[16px] text-ink-muted">{column}</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(null)}
              className="flex size-[24px] cursor-pointer items-center justify-center rounded-[6px] hover:bg-white/6"
            >
              <img src="/figma/icon-close.svg" width={14} height={14} alt="" />
            </button>
          </div>

          <fieldset className="flex flex-col gap-[8px]">
            <legend className="mb-[8px] text-[11px] leading-[14px] font-medium text-ink-muted">Scale</legend>
            <div className="flex gap-[2px] rounded-[8px] bg-surface p-[2px]">
              {(["linear", "quantile", "log"] as ColorScale[]).map((scale) => (
                <label
                  key={scale}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-[6px] py-[5px] text-[12px] leading-[16px] font-medium capitalize has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-text ${
                    colorScale === scale ? "bg-chip text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name={`scale-${column}`}
                    value={scale}
                    checked={colorScale === scale}
                    onChange={() => onColorOptionsChange({ colorScale: scale })}
                    className="sr-only"
                  />
                  {scale}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-[8px]">
            <span className="flex-1 text-[13px] leading-[18px] text-ink">Reverse colours</span>
            <input
              type="checkbox"
              role="switch"
              checked={colorReverse}
              onChange={(e) => onColorOptionsChange({ colorReverse: e.currentTarget.checked })}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`flex h-[18px] w-[32px] items-center rounded-full px-[2px] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent-text ${
                colorReverse ? "justify-end bg-accent" : "bg-line-strong"
              }`}
            >
              <span className="size-[14px] rounded-full bg-ink" />
            </span>
          </label>

          <div className="flex justify-end">
            <Button onClick={() => setOpen(null)}>Done</Button>
          </div>
        </div>
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  selected,
  disabled = false,
  onSelect,
}: {
  icon: StyleIconKind;
  label: string;
  hint: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}): ReactNode {
  const hintId = useId();
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-label={label}
      aria-describedby={hintId}
      aria-checked={selected}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={`flex items-center gap-[10px] rounded-[6px] px-[10px] py-[7px] text-left focus-visible:outline-none ${
        disabled ? "cursor-default opacity-40" : "cursor-pointer hover:bg-white/6 focus-visible:bg-white/6"
      } ${selected ? "bg-white/6" : ""}`}
    >
      <StyleIcon kind={icon} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] leading-[18px] font-medium text-ink">{label}</span>
        <span id={hintId} className="text-[11px] leading-[14px] text-ink-muted">
          {hint}
        </span>
      </span>
      {selected && <img src="/figma/icon-check.svg" width={14} height={14} alt="" />}
    </button>
  );
}

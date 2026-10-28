"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// Figma "Style select" next to each column, its "Style menu", and the
// "Color settings" popover (page "3 · Customization").

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import {
  channelAvailability,
  type ColorScale,
  type ColumnProfile,
  type StyleChannel,
} from "@/lib/point-style";
import { useI18n, type MessageKey } from "@/lib/i18n";
import Button from "./Button";
import StyleIcon, { type StyleIconKind } from "./StyleIcon";

const LABELS: Record<StyleChannel, MessageKey> = { color: "style.color", size: "style.size", shape: "style.shape" };

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
  const { t, hint } = useI18n();

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

  // lat/lon columns place the points; flow-only columns can't style points.
  if (positional || !profile.onPoints) {
    return (
      <span
        className="shrink-0 px-[8px] text-[11px] leading-[16px] text-ink-muted"
        title={t(positional ? "style.positionTitle" : "style.flowsTitle")}
      >
        {t(positional ? "style.position" : "style.flows")}
      </span>
    );
  }

  function moveFocus(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = [
      ...e.currentTarget.querySelectorAll<HTMLButtonElement>("[role^=menuitem]:not([aria-disabled=true])"),
    ];
    const count = items.length;
    if (!count) return;

    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const targets: Record<string, number> = {
      ArrowDown: (at + 1) % count,
      ArrowUp: (at - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    if (!(e.key in targets)) return;

    e.preventDefault();
    items[targets[e.key]].focus(); // skips disabled
  }

  const available = channelAvailability(profile);
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
        aria-label={t("style.triggerLabel", { column, channel: t(channel ? LABELS[channel] : "style.none") })}
        className={`flex h-[26px] shrink-0 cursor-pointer items-center gap-[6px] rounded-[6px] pr-[6px] pl-[8px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-text ${
          channel ? "bg-chip hover:bg-[#323236]" : "border border-dashed border-line-strong hover:bg-chip"
        } ${open ? "ring-[1.5px] ring-accent-text" : ""}`}
      >
        <StyleIcon kind={iconFor(channel, profile.numeric)} />
        <span className={`text-[12px] leading-[16px] font-medium whitespace-nowrap ${channel ? "text-ink" : "text-ink-muted"}`}>
          {t(channel ? LABELS[channel] : "style.style")}
        </span>
        <img src="/figma/icon-chevron-down.svg" width={12} height={12} alt="" />
      </button>

      {open?.kind === "menu" && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={t("style.menuLabel", { column })}
          onKeyDown={moveFocus}
          className="fixed z-50 flex w-[236px] flex-col gap-[2px] rounded-[10px] border border-line-strong/60 bg-chip p-[6px] shadow-[0px_8px_24px_0px_rgba(0,0,0,0.45)]"
          style={{ top: open.rect.bottom + 6, left: open.rect.right - 236 }}
        >
          <div className="flex gap-[6px] px-[10px] pt-[6px] pb-[4px] text-[11px] leading-[14px]">
            <span className="font-medium text-ink-muted">{t("style.style")}</span>
            <span className="truncate font-mono text-ink">{column}</span>
          </div>
          <MenuItem
            icon="none"
            label={t("style.noStyle")}
            hint={t("style.noStyleHint")}
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
              label={t(LABELS[c])}
              hint={hint(available[c].hint)}
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
                <span className="flex-1 text-[13px] leading-[18px] font-medium text-ink">{t("style.colorSettings")}</span>
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
          aria-label={t("style.colorSettingsLabel", { column })}
          className="fixed z-50 flex w-[300px] flex-col gap-[14px] rounded-[10px] border border-line-strong/60 bg-chip px-[16px] pt-[14px] pb-[16px] shadow-[0px_8px_24px_0px_rgba(0,0,0,0.45)]"
          style={{ top: Math.max(8, open.rect.top - 8), left: open.rect.right + 12 }}
        >
          <div className="flex items-center gap-[8px]">
            <StyleIcon kind="color" />
            <span className="text-[14px] leading-[20px] font-semibold text-ink">{t("style.color")}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] leading-[16px] text-ink-muted">{column}</span>
            <button
              type="button"
              aria-label={t("style.close")}
              onClick={() => setOpen(null)}
              className="flex size-[24px] cursor-pointer items-center justify-center rounded-[6px] hover:bg-white/6"
            >
              <img src="/figma/icon-close.svg" width={14} height={14} alt="" />
            </button>
          </div>

          <fieldset className="flex flex-col gap-[8px]">
            <legend className="mb-[8px] text-[11px] leading-[14px] font-medium text-ink-muted">{t("style.scale")}</legend>
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
                  {t(`style.scale.${scale}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-[8px]">
            <span className="flex-1 text-[13px] leading-[18px] text-ink">{t("style.reverse")}</span>
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
            <Button onClick={() => setOpen(null)}>{t("style.done")}</Button>
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

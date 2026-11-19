"use client";

// Sidebar section for the look of the flow lines, independent of any column:
// a colour, a dash pattern, moving dashes and arrowheads. (Column-driven
// colour and width are in each column's Style menu.)

import { useId } from "react";
import {
  DASH_PATTERNS,
  DASH_STYLES,
  LINE_COLORS,
  MAX_DECORATED_FLOWS,
  WEIGHT_RAMP,
  type DashStyle,
  type FlowLineStyle,
} from "@/lib/flow-line-style";
import { useI18n } from "@/lib/i18n";

type FlowLineControlsProps = {
  style: FlowLineStyle;
  onChange: (style: FlowLineStyle) => void;
  /** Flows in the dataset, to say when arrows and animation can switch off by themselves. */
  flowCount: number;
};

/** A short sample of the line, drawn with the same pattern the map uses (in multiples of its width). */
function DashPreview({ dash }: { dash: DashStyle }) {
  const width = 2.5;
  const pattern = DASH_PATTERNS[dash];
  return (
    <svg aria-hidden width={44} height={12} viewBox="0 0 44 12" className="shrink-0">
      <line
        x1={2}
        y1={6}
        x2={42}
        y2={6}
        stroke="currentColor"
        strokeWidth={width}
        strokeDasharray={pattern?.map((v) => v * width).join(" ")}
      />
    </svg>
  );
}

export default function FlowLineControls({ style, onChange, flowCount }: FlowLineControlsProps) {
  const { t, formatNumber } = useI18n();
  const groupName = useId();
  const colorGroupName = useId();
  const canAnimate = style.dash !== "solid";
  // A colour typed or dragged in the picker that isn't one of the swatches.
  const customColor = style.color && !LINE_COLORS.some((c) => c.value === style.color?.toLowerCase()) ? style.color : null;
  const swatch =
    "relative flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/25 outline-offset-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-text";
  const ring = (on: boolean) => (on ? "ring-2 ring-accent-text ring-offset-2 ring-offset-surface" : "hover:ring-1 hover:ring-line-strong hover:ring-offset-2 hover:ring-offset-surface");

  return (
    <section className="flex w-full flex-col gap-[12px]" aria-labelledby="flow-lines-heading">
      <div className="flex flex-col gap-[2px]">
        <h2 id="flow-lines-heading" className="text-[15px] leading-[22px] font-semibold text-ink">
          {t("line.heading")}
        </h2>
        <p className="text-[12px] leading-[16px] text-ink-muted">{t("line.hint")}</p>
      </div>

      <fieldset className="flex flex-col gap-[8px]">
        <legend className="mb-[8px] text-[11px] leading-[14px] font-medium text-ink-muted">{t("line.dash")}</legend>
        <div className="flex gap-[2px] rounded-[8px] bg-canvas p-[2px]">
          {DASH_STYLES.map((dash) => (
            <label
              key={dash}
              title={t(`line.dash.${dash}`)}
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-[6px] py-[7px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-text ${
                style.dash === dash ? "bg-chip text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name={groupName}
                value={dash}
                checked={style.dash === dash}
                onChange={() => onChange({ ...style, dash })}
                className="sr-only"
              />
              <DashPreview dash={dash} />
              <span className="sr-only">{t(`line.dash.${dash}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-[8px]">
        <legend className="mb-[8px] text-[11px] leading-[14px] font-medium text-ink-muted">
          {t("line.color")} <span className="font-normal">· {t("line.colorHint")}</span>
        </legend>
        <div className="flex flex-wrap items-center gap-[10px] px-[2px] py-[2px]">
          <label
            title={t("line.color.default")}
            className={`${swatch} ${ring(style.color === null)}`}
            style={{ background: `linear-gradient(90deg, ${WEIGHT_RAMP.join(", ")})` }}
          >
            <input
              type="radio"
              name={colorGroupName}
              checked={style.color === null}
              onChange={() => onChange({ ...style, color: null })}
              className="sr-only"
            />
            <span className="sr-only">{t("line.color.default")}</span>
          </label>
          {LINE_COLORS.map(({ name, value }) => (
            <label
              key={name}
              title={t(`line.color.${name}`)}
              className={`${swatch} ${ring(style.color?.toLowerCase() === value)}`}
              style={{ background: value }}
            >
              <input
                type="radio"
                name={colorGroupName}
                checked={style.color?.toLowerCase() === value}
                onChange={() => onChange({ ...style, color: value })}
                className="sr-only"
              />
              <span className="sr-only">{t(`line.color.${name}`)}</span>
            </label>
          ))}
          <label
            title={t("line.color.custom")}
            className={`${swatch} overflow-hidden ${ring(customColor !== null)}`}
            style={{
              background: customColor ?? "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #8b5cf6, #ef4444)",
            }}
          >
            <input
              type="color"
              aria-label={t("line.color.custom")}
              value={style.color ?? LINE_COLORS[0].value}
              onChange={(e) => onChange({ ...style, color: e.currentTarget.value })}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </fieldset>

      <SwitchRow
        label={t("line.animate")}
        hint={t(canAnimate ? "line.animateHint" : "line.animateNeedsDash")}
        checked={style.animate && canAnimate}
        disabled={!canAnimate}
        onChange={(animate) => onChange({ ...style, animate })}
      />
      <SwitchRow
        label={t("line.arrows")}
        hint={t("line.arrowsHint")}
        checked={style.arrows}
        onChange={(arrows) => onChange({ ...style, arrows })}
      />

      {flowCount > MAX_DECORATED_FLOWS && (
        <p className="text-[11px] leading-[14px] text-ink-muted">
          {t("line.limit", { n: formatNumber(MAX_DECORATED_FLOWS) })}
        </p>
      )}
    </section>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-[8px] ${disabled ? "cursor-default opacity-40" : "cursor-pointer"}`}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] leading-[18px] text-ink">{label}</span>
        <span className="text-[11px] leading-[14px] text-ink-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`flex h-[18px] w-[32px] shrink-0 items-center rounded-full px-[2px] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent-text ${
          checked ? "justify-end bg-accent" : "bg-line-strong"
        }`}
      >
        <span className="size-[14px] rounded-full bg-ink" />
      </span>
    </label>
  );
}

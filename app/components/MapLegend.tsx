"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icon exported from Figma */

// Figma "Legend" (page "3 · Customization"): one collapsible section per
// active style channel.

import { useState } from "react";
import { formatValue, SUNSET, type LegendSection } from "@/lib/point-style";
import { shapePoints } from "@/lib/shapes";
import StyleIcon from "./StyleIcon";

const TITLES = { color: "Color", size: "Size", shape: "Shape" } as const;

export default function MapLegend({ sections }: { sections: LegendSection[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  if (!sections.length) return null;

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section
      aria-label="Legend"
      className="flex max-h-full w-[212px] flex-col gap-[14px] overflow-y-auto rounded-[12px] scheme-dark border border-line bg-surface/94 px-[14px] py-[12px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.3)]"
    >
      {sections.map((section) => {
        const key = `${section.channel}:${section.column}`;
        const open = !collapsed.has(key);
        const bodyId = `legend-${section.channel}`;
        const icon = section.channel === "color" ? (section.kind === "ramp" ? "color" : "rainbow") : section.channel;
        return (
          <div key={key} className="flex flex-col gap-[8px]">
            <button
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={open}
              aria-controls={bodyId}
              className="flex w-full cursor-pointer items-center gap-[6px] rounded-[4px] text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-text"
            >
              <StyleIcon kind={icon} />
              <span className="text-[11px] leading-[16px] font-semibold text-ink">{TITLES[section.channel]}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-[16px] text-ink-muted">{section.column}</span>
              <img
                src="/figma/icon-chevron-down.svg"
                width={12}
                height={12}
                alt=""
                className={`transition-transform ${open ? "" : "-rotate-90"}`}
              />
            </button>
            {open && (
              <div id={bodyId}>
                <LegendBody section={section} />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function LegendBody({ section }: { section: LegendSection }) {
  if (section.channel === "color" && section.kind === "ramp") {
    const stops = section.reverse ? [...SUNSET].reverse() : SUNSET;
    return (
      <div className="flex flex-col gap-[8px]">
        <div className="h-[8px] w-full rounded-[4px]" style={{ background: `linear-gradient(90deg, ${stops.join(", ")})` }} />
        <div className="flex justify-between text-[11px] leading-[14px] text-ink-muted">
          <span>{formatValue(section.min)}</span>
          <span>{formatValue(section.max)}</span>
        </div>
      </div>
    );
  }
  if (section.channel === "color") {
    return (
      <ul className="flex max-h-[160px] flex-col gap-[6px] overflow-y-auto">
        {section.items.map((item) => (
          <li key={item.label} className="flex items-center gap-[6px] text-[11px] leading-[14px] text-ink-muted">
            <span className="size-[10px] shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="truncate">{item.label}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (section.channel === "size") {
    return (
      <div className="flex items-end gap-[14px]">
        {section.items.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-[4px]">
            <span
              className="rounded-full border-[1.5px] border-ink"
              style={{ width: item.radius * 2, height: item.radius * 2 }}
            />
            <span className="text-[11px] leading-[14px] text-ink-muted">{item.label}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-y-[6px]">
      {section.items.map((item) => (
        <li key={item.label} className="flex min-w-0 items-center gap-[6px] text-[11px] leading-[14px] text-ink-muted">
          <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden className="shrink-0">
            <polygon points={shapePoints(item.shape, 10)} className="fill-ink" />
          </svg>
          <span className="truncate">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

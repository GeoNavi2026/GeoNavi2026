// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import Button from "../app/components/Button";
import DashedOutline from "../app/components/DashedOutline";
import ExportMapButton from "../app/components/ExportMapButton";
import GlobeGraphic from "../app/components/GlobeGraphic";
import LanguageToggle from "../app/components/LanguageToggle";
import Logo from "../app/components/Logo";
import MapLegend from "../app/components/MapLegend";
import StyleIcon, { type StyleIconKind } from "../app/components/StyleIcon";
import { LanguageProvider } from "../lib/i18n";
import { exportResolutions } from "../lib/map-export";
import type { LegendSection } from "../lib/point-style";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

function render(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(element));
  return container;
}

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.replaceChildren();
});

describe("basic UI rendering", () => {
  it("renders button variants and forwards button props", () => {
    const container = render(
      <div>
        <Button>Primary</Button>
        <Button variant="secondary" disabled aria-label="secondary">Secondary</Button>
      </div>
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe("Primary");
    expect(buttons[0].className).toContain("bg-accent");
    expect(buttons[1].className).toContain("border");
    expect(buttons[1]).toHaveProperty("disabled", true);
    expect(buttons[1].getAttribute("aria-label")).toBe("secondary");
  });

  it("renders both logo sizes and heading mode", () => {
    const container = render(
      <div>
        <Logo size="sm" />
        <Logo size="lg" as="h1" />
      </div>
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(container.querySelector("h1")?.textContent).toBe("GeoNavi");
    expect(container.textContent).toBe("GeoNaviGeoNavi");
  });

  it("renders every style icon kind", () => {
    const kinds: StyleIconKind[] = ["color", "flowColor", "rainbow", "size", "shape", "none", "width"];
    const container = render(
      <div>{kinds.map((kind) => <StyleIcon key={kind} kind={kind} />)}</div>
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(5);
  });

  it("renders the globe artwork layers", () => {
    const container = render(<GlobeGraphic />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(4);
    expect(container.querySelector('img[src="/figma/globe-sphere.svg"]')).not.toBeNull();
  });

  it("renders active and inactive dashed outlines", () => {
    const container = render(
      <div>
        <DashedOutline radius={12} active />
        <DashedOutline radius={8} active={false} />
      </div>
    );
    const rects = container.querySelectorAll("rect");
    expect(rects).toHaveLength(2);
    expect(rects[0].getAttribute("rx")).toBe("11.25");
    expect(rects[0].getAttribute("stroke-dasharray")).toBe("8 6");
    expect(rects[0].getAttribute("class")).toContain("stroke-accent-text");
    expect(rects[1].getAttribute("class")).toContain("stroke-line-strong");
  });

  it("renders the language toggle inside its provider", () => {
    const container = render(
      <LanguageProvider>
        <LanguageToggle />
      </LanguageProvider>
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe("EN");
    expect(buttons[1].textContent).toBe("PT");
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("renders each legend body variant", () => {
    const sections: LegendSection[] = [
      { target: "points", channel: "color", column: "score", kind: "ramp", min: 1, max: 9, stops: ["#000", "#fff", "#000"] },
      { target: "points", channel: "color", column: "group", kind: "categories", items: [{ label: "A", color: "#f00" }] },
      { target: "points", channel: "size", column: "score", items: [{ value: 1, radius: 4 }] },
      { target: "points", channel: "shape", column: "group", items: [{ label: "A", shape: "circle" }] },
      { target: "flows", channel: "width", column: "weight", items: [{ value: 2, width: 3 }] },
    ];
    const container = render(
      <LanguageProvider>
        <MapLegend sections={sections} />
      </LanguageProvider>
    );
    expect(container.querySelector('[aria-label="Legend"]')).not.toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(5);
    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("opens the export panel with PNG/JPEG, resolutions and the legend switch", () => {
    const exports: unknown[] = [];
    const container = render(
      <LanguageProvider>
        <ExportMapButton
          getResolutions={() => exportResolutions(1000, 800, 1)}
          hasLegend
          onExport={async (options) => {
            exports.push(options);
          }}
        />
      </LanguageProvider>
    );
    const trigger = container.querySelector("button")!;
    expect(trigger.getAttribute("aria-label")).toBe("Export map");
    act(() => trigger.click());

    const panel = document.querySelector('[role="dialog"]')!;
    const radios = [...panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.closest("label")?.textContent)).toEqual([
      "PNGSharp lines and text, larger file",
      "JPEGSmaller file, softer lines",
      "Current view1,000 × 800 px",
      "Full HD1,920 × 1,536 px",
      "4K3,840 × 3,072 px",
    ]);
    expect(panel.textContent).not.toContain("WebP");
    expect(panel.querySelector('input[role="switch"]')).toHaveProperty("checked", true);

    act(() => radios[1].click());
    act(() => radios[3].click());
    const download = [...panel.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Download"))!;
    expect(download.textContent).toBe("Download JPEG");
    act(() => download.click());
    expect(exports).toEqual([{ format: "jpeg", legend: true, resolution: { id: "fhd", scale: 1.92, width: 1920, height: 1536 } }]);
  });

  it("shows the legend switch disabled, with a hint, when there is no legend", () => {
    const container = render(
      <LanguageProvider>
        <ExportMapButton getResolutions={() => exportResolutions(1000, 800, 1)} hasLegend={false} onExport={async () => {}} />
      </LanguageProvider>
    );
    act(() => container.querySelector("button")!.click());
    const toggle = document.querySelector<HTMLInputElement>('[role="dialog"] input[role="switch"]')!;
    expect(toggle.disabled).toBe(true);
    expect(toggle.checked).toBe(false);
    expect(toggle.closest("label")?.textContent).toBe("Include legendStyle a column to get a legend");
  });
});

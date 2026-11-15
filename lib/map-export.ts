// Map export: resolution presets, the download's file name, and composing
// the exported image from a snapshot of the map canvas plus what the map
// screen draws in HTML on top of it (point names, the legend, attribution).

import type { LegendSection } from "./point-style";
import { SHAPE_POLYGONS } from "./shapes";

export type ExportFormat = "png" | "jpeg";
export const EXPORT_FORMATS: ExportFormat[] = ["png", "jpeg"];
const MIME: Record<ExportFormat, string> = { png: "image/png", jpeg: "image/jpeg" };
const EXTENSION: Record<ExportFormat, string> = { png: "png", jpeg: "jpg" };
const JPEG_QUALITY = 0.92;

export type ResolutionId = "view" | "fhd" | "4k";

export interface ExportResolution {
  id: ResolutionId;
  /** Output size in pixels. */
  width: number;
  height: number;
  /** Output pixels per CSS pixel of the map view. */
  scale: number;
}

// Full HD and 4K are widths; the height follows the map view's shape, so the
// export shows exactly what's on screen, only sharper. Sizes past what the
// GPU can render (`maxScale`) are reduced, so the listed size is what you get.
const PRESET_WIDTHS: [ResolutionId, number][] = [["fhd", 1920], ["4k", 3840]];

/** Export sizes for a map view of `viewWidth` × `viewHeight` CSS px on a `pixelRatio` screen. */
export function exportResolutions(
  viewWidth: number,
  viewHeight: number,
  pixelRatio = 1,
  maxScale = Infinity
): ExportResolution[] {
  const sized = (id: ResolutionId, wanted: number): ExportResolution => {
    const scale = Math.min(wanted, maxScale);
    return { id, scale, width: Math.round(viewWidth * scale), height: Math.round(viewHeight * scale) };
  };
  return [
    sized("view", Math.max(1, pixelRatio)),
    ...PRESET_WIDTHS.map(([id, width]) => sized(id, width / Math.max(1, viewWidth))),
  ];
}

/** "flows_hourly.csv" → "flows_hourly-map-2026-11-15.png" (local date). */
export function exportFileName(sourceName: string, format: ExportFormat, date = new Date()) {
  const stem = sourceName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-").replace(/^[\s-]+|[\s-]+$/g, "") || "geonavi";
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  return `${stem}-map-${day}.${EXTENSION[format]}`;
}

// ---------- Composing the image ----------

/** A point's name pill, in CSS px from the map view's top-left corner. */
export interface ExportLabel {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Outside the filter or isolation: drawn dimmed, as on screen. */
  faded: boolean;
}

/** The map canvas at `scale`, and the point names on top of it. */
export interface MapSnapshot {
  canvas: HTMLCanvasElement;
  /** Map view size in CSS px. */
  width: number;
  height: number;
  scale: number;
  labels: ExportLabel[];
}

export interface ExportText {
  /** Legend section titles, e.g. "Color" or "Flow width". */
  title: (section: LegendSection) => string;
  formatValue: (n: number) => string;
  /** "+{n} more", for long category lists. */
  more: (n: number) => string;
  attribution: string;
}

// Mirrors the colour tokens in app/globals.css.
const INK = "#fafafa";
const INK_MUTED = "#a1a1aa";
const SURFACE = "rgba(24, 24, 27, 0.94)";
const LINE = "#27272a";
const LABEL_BG = "rgba(24, 24, 27, 0.9)";
const FADED_OPACITY = 0.35;
const RAINBOW = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];
// Long category lists scroll on screen; the export lists this many, then "+N more".
const MAX_LEGEND_ROWS = 16;

function fonts() {
  const root = getComputedStyle(document.documentElement);
  const sans = root.getPropertyValue("--font-geist-sans").trim() || "system-ui, sans-serif";
  const mono = root.getPropertyValue("--font-geist-mono").trim() || "ui-monospace, monospace";
  return { sans, mono };
}

/**
 * The exported image: the map snapshot with its point names, the legend
 * (unless left out) at the bottom left, and the map data attribution.
 */
export async function composeExport(
  snapshot: MapSnapshot,
  { format, legend, text }: { format: ExportFormat; legend: LegendSection[]; text: ExportText }
): Promise<Blob> {
  const { canvas: map, scale } = snapshot;
  const out = document.createElement("canvas");
  out.width = map.width;
  out.height = map.height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available.");
  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(map, 0, 0);

  // Everything else is laid out in CSS px, like the screen, then scaled.
  ctx.scale(scale, scale);
  const font = fonts();
  drawLabels(ctx, snapshot.labels, font.sans);
  if (legend.length) drawLegend(ctx, legend, snapshot.height, text, font);
  drawAttribution(ctx, text.attribution, snapshot.width, snapshot.height, font.sans);

  return new Promise((resolve, reject) =>
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be encoded."))),
      MIME[format],
      format === "jpeg" ? JPEG_QUALITY : undefined
    )
  );
}

/** Save `blob` as a download named `fileName`. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

type Ctx = CanvasRenderingContext2D;

function pill(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Text cut to `maxWidth` with an ellipsis. */
function fit(ctx: Ctx, s: string, maxWidth: number) {
  if (ctx.measureText(s).width <= maxWidth) return s;
  let end = s.length;
  while (end > 0 && ctx.measureText(`${s.slice(0, end)}…`).width > maxWidth) end--;
  return `${s.slice(0, end)}…`;
}

// Point names, styled like .gn-node-label in globals.css.
function drawLabels(ctx: Ctx, labels: ExportLabel[], sans: string) {
  ctx.font = `500 12px ${sans}`;
  ctx.textBaseline = "middle";
  // Dimmed names first, so full-strength ones sit on top, as on screen.
  for (const label of [...labels].sort((a, b) => Number(b.faded) - Number(a.faded))) {
    ctx.globalAlpha = label.faded ? FADED_OPACITY : 1;
    pill(ctx, label.x, label.y, label.width, label.height, 4);
    ctx.fillStyle = LABEL_BG;
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(label.text, label.x + 6, label.y + label.height / 2);
  }
  ctx.globalAlpha = 1;
}

function drawAttribution(ctx: Ctx, attribution: string, width: number, height: number, sans: string) {
  ctx.font = `400 11px ${sans}`;
  ctx.textBaseline = "middle";
  const w = ctx.measureText(attribution).width + 16;
  const x = width - 10 - w, y = height - 10 - 22;
  pill(ctx, x, y, w, 22, 11);
  ctx.fillStyle = "#18181b";
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(attribution, x + 8, y + 11);
}

// ---------- Legend, laid out like MapLegend ----------

const LEGEND = { width: 212, padX: 14, padY: 12, gap: 14, margin: 16, headerHeight: 16, bodyGap: 8 };

type Fonts = { sans: string; mono: string };

function legendBodyHeight(section: LegendSection) {
  switch (section.channel) {
    case "color":
      if (section.kind === "ramp") return 8 + 8 + 14;
      return rowsHeight(Math.min(section.items.length, MAX_LEGEND_ROWS) + (section.items.length > MAX_LEGEND_ROWS ? 1 : 0), 14, 6);
    case "size": {
      const max = Math.max(...section.items.map((i) => i.radius));
      return max * 2 + 4 + 14;
    }
    case "shape":
      return rowsHeight(Math.ceil(section.items.length / 2), 14, 6);
    case "width":
      return rowsHeight(section.items.length, 14, 6);
  }
}

const rowsHeight = (rows: number, row: number, gap: number) => (rows ? rows * row + (rows - 1) * gap : 0);

function drawLegend(ctx: Ctx, sections: LegendSection[], viewHeight: number, text: ExportText, font: Fonts) {
  const inner = LEGEND.width - LEGEND.padX * 2;
  const heights = sections.map((s) => LEGEND.headerHeight + LEGEND.bodyGap + legendBodyHeight(s));
  const height = LEGEND.padY * 2 + heights.reduce((a, b) => a + b, 0) + LEGEND.gap * (sections.length - 1);
  const x0 = LEGEND.margin;
  const y0 = viewHeight - LEGEND.margin - height;

  pill(ctx, x0, y0, LEGEND.width, height, 12);
  ctx.fillStyle = SURFACE;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();

  let y = y0 + LEGEND.padY;
  const x = x0 + LEGEND.padX;
  sections.forEach((section, i) => {
    // Header: icon, title, column name.
    drawSectionIcon(ctx, section, x, y + 1);
    ctx.textBaseline = "middle";
    ctx.font = `600 11px ${font.sans}`;
    ctx.fillStyle = INK;
    const title = text.title(section);
    ctx.fillText(title, x + 26, y + 8);
    const titleWidth = ctx.measureText(title).width;
    ctx.font = `400 11px ${font.mono}`;
    ctx.fillStyle = INK_MUTED;
    ctx.fillText(fit(ctx, section.column, inner - 26 - titleWidth - 6), x + 26 + titleWidth + 6, y + 8);
    drawSectionBody(ctx, section, x, y + LEGEND.headerHeight + LEGEND.bodyGap, inner, text, font);
    y += heights[i] + LEGEND.gap;
  });
}

function drawSectionIcon(ctx: Ctx, section: LegendSection, x: number, y: number) {
  ctx.fillStyle = INK;
  if (section.channel === "color") {
    const stops = section.kind === "ramp" ? section.stops : RAINBOW;
    const g = ctx.createLinearGradient(x, 0, x + 20, 0);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    pill(ctx, x, y + 2, 20, 10, 3);
    ctx.fillStyle = g;
    ctx.fill();
  } else if (section.channel === "size") {
    for (const [cx, r] of [[3, 2], [9, 3], [16, 4]]) {
      ctx.beginPath();
      ctx.arc(x + cx, y + 7, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (section.channel === "shape") {
    polygon(ctx, "circle", x + 4, y + 7, 3);
    polygon(ctx, "square", x + 10, y + 7, 3);
    polygon(ctx, "triangle", x + 16, y + 7, 3.5);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 6.25);
    ctx.lineTo(x + 19, y + 3);
    ctx.lineTo(x + 19, y + 11);
    ctx.lineTo(x + 1, y + 7.75);
    ctx.closePath();
    ctx.fill();
  }
}

function polygon(ctx: Ctx, shape: keyof typeof SHAPE_POLYGONS, cx: number, cy: number, r: number) {
  ctx.beginPath();
  SHAPE_POLYGONS[shape].forEach(([px, py], i) => (i ? ctx.lineTo(cx + px * r, cy + py * r) : ctx.moveTo(cx + px * r, cy + py * r)));
  ctx.closePath();
  ctx.fill();
}

function drawSectionBody(ctx: Ctx, section: LegendSection, x: number, y: number, width: number, text: ExportText, font: Fonts) {
  ctx.font = `400 11px ${font.sans}`;
  ctx.textBaseline = "middle";
  if (section.channel === "color" && section.kind === "ramp") {
    const { stops } = section;
    const g = ctx.createLinearGradient(x, 0, x + width, 0);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    pill(ctx, x, y, width, 8, 4);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = INK_MUTED;
    ctx.textAlign = "left";
    ctx.fillText(text.formatValue(section.min), x, y + 16 + 7);
    ctx.textAlign = "right";
    ctx.fillText(text.formatValue(section.max), x + width, y + 16 + 7);
    ctx.textAlign = "left";
    return;
  }
  if (section.channel === "color") {
    const shown = section.items.slice(0, MAX_LEGEND_ROWS);
    shown.forEach((item, i) => {
      const cy = y + i * 20 + 7;
      ctx.beginPath();
      ctx.arc(x + 5, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.fillStyle = INK_MUTED;
      ctx.fillText(fit(ctx, item.label, width - 16), x + 16, cy);
    });
    const hidden = section.items.length - shown.length;
    if (hidden > 0) {
      ctx.fillStyle = INK_MUTED;
      ctx.fillText(text.more(hidden), x + 16, y + shown.length * 20 + 7);
    }
    return;
  }
  if (section.channel === "size") {
    const max = Math.max(...section.items.map((i) => i.radius));
    let cx = x;
    for (const item of section.items) {
      const label = text.formatValue(item.value);
      const column = Math.max(item.radius * 2, ctx.measureText(label).width);
      ctx.beginPath();
      ctx.arc(cx + column / 2, y + max * 2 - item.radius, item.radius - 0.75, 0, Math.PI * 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = INK_MUTED;
      ctx.textAlign = "center";
      ctx.fillText(label, cx + column / 2, y + max * 2 + 4 + 7);
      ctx.textAlign = "left";
      cx += column + 14;
    }
    return;
  }
  if (section.channel === "shape") {
    section.items.forEach((item, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const ix = x + col * (width / 2), cy = y + row * 20 + 7;
      ctx.fillStyle = INK;
      polygon(ctx, item.shape, ix + 5, cy, 5 / 1.2);
      ctx.fillStyle = INK_MUTED;
      ctx.fillText(fit(ctx, item.label, width / 2 - 18), ix + 16, cy);
    });
    return;
  }
  section.items.forEach((item, i) => {
    const cy = y + i * 20 + 7;
    pill(ctx, x, cy - item.width / 2, 36, item.width, item.width / 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.fillStyle = INK_MUTED;
    ctx.fillText(text.formatValue(item.value), x + 44, cy);
  });
}

"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// OpenStreetMap base map with the selected dataset drawn on top, styled to
// the Figma "Map view". Browser-only: load it through next/dynamic with ssr: false.

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type FilterSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_POINT_COLOR, RADIUS, type PointStyles } from "@/lib/point-style";
import { ICON_UNIT_RADIUS_CSS, SHAPES, shapeImageName, shapeSdf } from "@/lib/shapes";
import type { FilterTarget } from "@/lib/filter-axis";
import { toGeoJson } from "@/lib/to-geojson";
import type { DatasetResponse } from "@/lib/types";

// Copied into public/ by scripts/copy-maplibre-worker.mjs.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// OSM's public tiles are fine for development but have a strict usage policy:
// https://operations.osmfoundation.org/policies/tiles/
// Swap in a dedicated tile provider before any real traffic.
// Attribution is rendered by the pill in the bottom-right corner.
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

// Line width in pixels, scaled by weight relative to the dataset's max.
const EDGE_WIDTH: ExpressionSpecification = [
  "interpolate", ["linear"], ["get", "norm"],
  0, 2,
  1, 10,
];
// Offset each line to the right of its direction, so A→B and B→A sit side by
// side with a 4px gap instead of on top of each other.
const EDGE_OFFSET: ExpressionSpecification = ["+", ["/", EDGE_WIDTH, 2], 2];

// Node name pills are DOM markers; past this many they would slow the map down.
const MAX_LABELS = 200;

// The Figma "Map view" keeps 80px around the data. Uploaded bounding boxes hug
// the outermost nodes, so also leave room for name pills on the right; screens
// with overlays at the bottom (the filter bar) pass `bottomInset`.
const FIT_PADDING = { top: 80, right: 160, bottom: 80, left: 80 };

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

type MapViewProps = {
  dataset: DatasetResponse | null;
  /**
   * The filter bar: show only the points or flows whose step is in `steps`
   * (`stepOf` maps their ids to steps). Null shows everything.
   */
  filter?: PointFlowFilter | null;
  /** Space covered at the bottom of the map, kept clear when fitting the data. */
  bottomInset?: number;
  /** Column-driven point colours, sizes and shapes; null or empty keeps the default look. */
  pointStyles?: PointStyles | null;
  /**
   * Isolated points: only flows starting or ending at one of these are shown,
   * and points not connected to them are faded. Null shows every flow.
   */
  isolated?: string[] | null;
  /**
   * A point was double-clicked (`additive` when Ctrl/⌘ was held). Return true
   * when it was handled to skip the map's double-click zoom.
   */
  onPointDoubleClick?: (id: string, options: { additive: boolean }) => boolean;
};

// Points are SDF shape icons so colour, size, shape and outline can vary per point.
const NODE_RADIUS: ExpressionSpecification = ["coalesce", ["get", "radius"], RADIUS.default];
// Big points first, so small ones stay visible on top.
const NODE_SORT: ExpressionSpecification = ["-", 0, NODE_RADIUS];
// Points outside the filter's selected steps stay on the map, faded, so they can
// still be double-clicked to jump the filter to their value.
const FADED_OPACITY = 0.35;
// How far (px) from a point a double-click still counts as on it.
const DOUBLE_CLICK_SLOP = 10;
// Distance from a point's centre to its name pill.
const labelOffset = (radius: number): [number, number] => [radius + 6, 0];

export type PointFlowFilter = { target: FilterTarget; stepOf: Map<string, number>; steps: number[] };

export default function MapView({
  dataset,
  pointStyles = null,
  filter = null,
  bottomInset = FIT_PADDING.bottom,
  isolated = null,
  onPointDoubleClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const labelsRef = useRef<Map<string, Marker>>(new Map());
  const i18n = useI18n();
  const i18nRef = useRef(i18n); // for click handlers
  const onPointDoubleClickRef = useRef(onPointDoubleClick);
  useEffect(() => {
    i18nRef.current = i18n;
    onPointDoubleClickRef.current = onPointDoubleClick;
  }, [i18n, onPointDoubleClick]);
  const [ready, setReady] = useState(false);
  const pointSteps = filter?.target === "points" ? filter.stepOf : null;
  const flowSteps = filter?.target === "flows" ? filter.stepOf : null;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [-82.35, 29.65],
      zoom: 11,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("edges", { type: "geojson", data: EMPTY });
      map.addSource("nodes", { type: "geojson", data: EMPTY });

      map.addLayer({
        id: "edges",
        type: "line",
        source: "edges",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": [
            "interpolate", ["linear"], ["get", "norm"],
            0, "#60a5fa",
            1, "#1d4ed8",
          ],
          "line-width": EDGE_WIDTH,
          "line-offset": EDGE_OFFSET,
          "line-opacity": 0.85,
        },
      });

      // Invisible, wider copy of the edges so thin lines are easy to click.
      map.addLayer({
        id: "edges-hit",
        type: "line",
        source: "edges",
        paint: {
          "line-width": ["+", EDGE_WIDTH, 10],
          "line-offset": EDGE_OFFSET,
          "line-opacity": 0,
        },
      });

      for (const shape of SHAPES) {
        map.addImage(shapeImageName(shape), shapeSdf(shape), { sdf: true, pixelRatio: 2 });
      }
      map.addLayer({
        id: "nodes",
        type: "symbol",
        source: "nodes",
        layout: {
          "icon-image": ["coalesce", ["get", "icon"], shapeImageName("circle")],
          "icon-size": ["/", NODE_RADIUS, ICON_UNIT_RADIUS_CSS],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "symbol-sort-key": NODE_SORT,
        },
        paint: {
          "icon-color": ["coalesce", ["get", "color"], DEFAULT_POINT_COLOR],
          "icon-halo-color": "#ffffff",
          "icon-halo-width": 2.5,
        },
      });

      const popup = (e: MapLayerMouseEvent, title: string, body: string) =>
        new Popup({ closeButton: false, className: "gn-popup", offset: 8, maxWidth: "none" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="gn-popup-title">${escapeHtml(title)}</div>` +
              `<div class="gn-popup-body">${escapeHtml(body)}</div>`
          )
          .addTo(map);

      map.on("click", "nodes", (e: MapLayerMouseEvent) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        popup(e, String(p.name), String(p.id));
      });

      // Double-click a point (or its name pill) to hand it to onPointDoubleClick.
      // A full-strength name under the cursor wins, since it's drawn on top
      // (the last one in DOM order, where names overlap).
      // Otherwise points are small, so anything within DOUBLE_CLICK_SLOP px of
      // a point's visible edge counts and the nearest wins; distance is measured
      // from the centre because icon hit boxes are much larger than the drawn
      // shape. A dimmed name comes last. Name pills let clicks through, so
      // they're hit-tested here.
      map.on("dblclick", (e: MapMouseEvent) => {
        const handle = onPointDoubleClickRef.current;
        if (!handle) return;
        let id: string | null = null;
        let dimmed: string | null = null;
        const { clientX, clientY } = e.originalEvent;
        for (const [nodeId, marker] of labelsRef.current) {
          const el = marker.getElement();
          const r = el.getBoundingClientRect();
          if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
          if (el.dataset.faded !== "true") id = nodeId;
          else dimmed = nodeId;
        }
        if (id === null) {
          const { x, y } = e.point;
          let best = Infinity;
          const reach = RADIUS.max + DOUBLE_CLICK_SLOP;
          const near = map.queryRenderedFeatures([[x - reach, y - reach], [x + reach, y + reach]], { layers: ["nodes"] });
          for (const feature of near) {
            if (feature.geometry.type !== "Point") continue;
            const at = map.project(feature.geometry.coordinates as [number, number]);
            const distance = Math.hypot(at.x - x, at.y - y);
            const radius = Number(feature.properties.radius ?? RADIUS.default);
            if (distance <= radius + DOUBLE_CLICK_SLOP && distance < best) {
              best = distance;
              id = String(feature.properties.id);
            }
          }
        }
        id ??= dimmed;
        // Ctrl/⌘ adds the point to (or removes it from) the isolated points.
        const additive = e.originalEvent.ctrlKey || e.originalEvent.metaKey;
        if (id !== null && handle(id, { additive })) e.preventDefault();
      });

      map.on("click", "edges-hit", (e: MapLayerMouseEvent) => {
        // A node sits on top of its edges; let the node popup win.
        if (map.queryRenderedFeatures(e.point, { layers: ["nodes"] }).length) return;
        const p = e.features?.[0]?.properties;
        if (!p) return;
        const { t, formatNumber } = i18nRef.current;
        popup(e, `${p.sourceName} → ${p.targetName}`, `${t("map.weight")}: ${formatNumber(Number(p.weight))}`);
      });

      for (const layer of ["nodes", "edges-hit"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Push the dataset into the map whenever it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    for (const marker of labelsRef.current.values()) marker.remove();
    labelsRef.current = new Map();
    if (dataset && dataset.nodes.length <= MAX_LABELS) {
      for (const node of dataset.nodes) {
        const el = document.createElement("div");
        el.className = "gn-node-label";
        el.textContent = node.name ?? node.id;
        const marker = new Marker({ element: el, anchor: "left", offset: labelOffset(RADIUS.default) })
          .setLngLat(node.coords)
          .addTo(map);
        labelsRef.current.set(node.id, marker);
      }
    }

    if (dataset) {
      const [minLon, minLat, maxLon, maxLat] = dataset.meta.bbox;
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        {
          padding: { ...FIT_PADDING, bottom: bottomInset },
          duration: 600,
          maxZoom: 15,
        }
      );
    }
    // Refit only when the data changes, not on every filter step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, ready]);

  // Flows, tagged with their filter step when the filter is on a flow column.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const edges = dataset ? toGeoJson(dataset).edges : EMPTY;
    if (flowSteps) {
      for (const feature of edges.features) {
        Object.assign(feature.properties!, { step: flowSteps.get(String(feature.properties?.id)) ?? -1 });
      }
    }
    map.getSource<GeoJSONSource>("edges")?.setData(edges);
  }, [dataset, flowSteps, ready]);

  // Points, with their column-driven styles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const nodes = dataset ? toGeoJson(dataset).nodes : EMPTY;
    for (const feature of nodes.features) {
      const id = String(feature.properties?.id);
      const style = pointStyles?.byNode.get(id);
      labelsRef.current.get(id)?.setOffset(labelOffset(style?.radius ?? RADIUS.default));
      if (pointSteps) Object.assign(feature.properties!, { step: pointSteps.get(id) ?? -1 });
      if (!style) continue;
      Object.assign(feature.properties!, {
        color: style.color,
        radius: style.radius,
        icon: style.shape ? shapeImageName(style.shape) : undefined,
      });
    }
    map.getSource<GeoJSONSource>("nodes")?.setData(nodes);
    // Styled points get the Figma's dark outline so pale colours stay visible.
    const styled = pointStyles?.active ?? false;
    map.setPaintProperty("nodes", "icon-halo-color", styled ? "rgba(24, 24, 27, 0.85)" : "#ffffff");
    map.setPaintProperty("nodes", "icon-halo-width", styled ? 1.5 : 2.5);
  }, [dataset, pointStyles, pointSteps, ready]);

  // Isolation: the isolated points plus every point sharing a flow with them.
  const isolatedKey = isolated?.join(",") ?? null;
  const connected = useMemo(() => {
    if (!isolated || !dataset) return null;
    const ids = new Set(isolated);
    for (const edge of dataset.edges) {
      if (isolated.includes(edge.source)) ids.add(edge.target);
      if (isolated.includes(edge.target)) ids.add(edge.source);
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `isolated` is tracked by isolatedKey
  }, [isolatedKey, dataset]);

  // Filter bar and isolation: flows that fail either are hidden; points that
  // fail either are faded (drawn underneath the others) and lose their label.
  const steps = filter?.steps ?? null;
  // Effects re-run on content, not on a new array with the same steps.
  const stepsKey = steps?.join(",") ?? null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const selected = new Set(steps ?? []);
    const atStep: ExpressionSpecification = ["in", ["get", "step"], ["literal", [...selected]]];

    const flowTests: ExpressionSpecification[] = [];
    if (flowSteps && steps !== null) flowTests.push(atStep);
    if (isolated) {
      const ids: ExpressionSpecification = ["literal", isolated];
      flowTests.push(["any", ["in", ["get", "source"], ids], ["in", ["get", "target"], ids]]);
    }
    const flowFilter: FilterSpecification | null = flowTests.length ? ["all", ...flowTests] : null;
    map.setFilter("edges", flowFilter);
    map.setFilter("edges-hit", flowFilter);

    const pointTests: ExpressionSpecification[] = [];
    if (pointSteps) pointTests.push(atStep);
    if (connected) pointTests.push(["in", ["get", "id"], ["literal", [...connected]]]);
    const shown: ExpressionSpecification = ["all", ...pointTests];
    map.setPaintProperty("nodes", "icon-opacity", pointTests.length ? ["case", shown, 1, FADED_OPACITY] : 1);
    map.setLayoutProperty("nodes", "symbol-sort-key", pointTests.length ? ["+", NODE_SORT, ["case", shown, 1000, 0]] : NODE_SORT);
    for (const [id, marker] of labelsRef.current) {
      const passesFilter = !pointSteps || selected.has(pointSteps.get(id) ?? -1);
      const passesIsolation = !connected || connected.has(id);
      // Faded points keep a dimmed name, so it can still be double-clicked.
      const faded = !(passesFilter && passesIsolation);
      marker.setOpacity(String(faded ? FADED_OPACITY : 1));
      const el = marker.getElement();
      el.dataset.faded = String(faded);
      el.style.zIndex = faded ? "0" : "1";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `steps`/`isolated` are tracked by their keys
  }, [stepsKey, flowSteps, pointSteps, isolatedKey, connected, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute top-[16px] right-[16px] flex flex-col overflow-hidden rounded-[6px] bg-surface shadow-[0px_2px_10px_0px_rgba(0,0,0,0.3)]">
        <button
          type="button"
          aria-label={i18n.t("map.zoomIn")}
          onClick={() => mapRef.current?.zoomIn()}
          className="flex size-[34px] cursor-pointer items-center justify-center border-b border-line hover:bg-line"
        >
          <img src="/figma/icon-plus.svg" width={16} height={16} alt="" />
        </button>
        <button
          type="button"
          aria-label={i18n.t("map.zoomOut")}
          onClick={() => mapRef.current?.zoomOut()}
          className="flex size-[34px] cursor-pointer items-center justify-center hover:bg-line"
        >
          <img src="/figma/icon-minus.svg" width={16} height={16} alt="" />
        </button>
      </div>

      <p className="absolute right-[10px] bottom-[10px] rounded-full bg-surface px-[8px] py-[3px] text-[11px] leading-[16px] whitespace-nowrap text-ink">
        <a href="https://maplibre.org" target="_blank" rel="noopener noreferrer" className="hover:underline">
          MapLibre
        </a>{" "}
        | ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          OpenStreetMap
        </a>{" "}
        {i18n.t("map.contributors")}
      </p>
    </div>
  );
}

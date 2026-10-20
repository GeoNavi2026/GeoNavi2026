"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// OpenStreetMap base map with the selected dataset drawn on top, styled to
// the Figma "Map view". Browser-only: load it through next/dynamic with ssr: false.

import { useEffect, useRef, useState } from "react";
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
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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
// the outermost nodes, so also leave room for name pills on the right and, when
// shown, for the time slider (98px tall, 42px from the bottom).
const FIT_PADDING = { top: 80, right: 160, bottom: 80, left: 80 };
const TIME_SLIDER_PADDING = 200;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

type MapViewProps = {
  dataset: DatasetResponse | null;
  /** Show only edges from this hour of day; null shows every edge and means no time slider. */
  hour: number | null;
};

export default function MapView({ dataset, hour }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const labelsRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const hasTimeSlider = hour !== null;

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

      map.addLayer({
        id: "nodes",
        type: "circle",
        source: "nodes",
        paint: {
          "circle-radius": 8,
          "circle-color": "#f97316",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
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

      map.on("click", "edges-hit", (e: MapLayerMouseEvent) => {
        // A node sits on top of its edges; let the node popup win.
        if (map.queryRenderedFeatures(e.point, { layers: ["nodes"] }).length) return;
        const p = e.features?.[0]?.properties;
        if (!p) return;
        popup(e, `${p.sourceName} → ${p.targetName}`, `Weight: ${Number(p.weight).toLocaleString()}`);
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

    const { nodes, edges } = dataset ? toGeoJson(dataset) : { nodes: EMPTY, edges: EMPTY };
    map.getSource<GeoJSONSource>("nodes")?.setData(nodes);
    map.getSource<GeoJSONSource>("edges")?.setData(edges);

    for (const marker of labelsRef.current) marker.remove();
    labelsRef.current = [];
    if (dataset && dataset.nodes.length <= MAX_LABELS) {
      labelsRef.current = dataset.nodes.map((node) => {
        const el = document.createElement("div");
        el.className = "gn-node-label";
        el.textContent = node.name ?? node.id;
        return new Marker({ element: el, anchor: "left", offset: [14, 0] })
          .setLngLat(node.coords)
          .addTo(map);
      });
    }

    if (dataset) {
      const [minLon, minLat, maxLon, maxLat] = dataset.meta.bbox;
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        {
          padding: { ...FIT_PADDING, bottom: hasTimeSlider ? TIME_SLIDER_PADDING : FIT_PADDING.bottom },
          duration: 600,
          maxZoom: 15,
        }
      );
    }
    // Refit only when the data changes, not on every hour step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, ready]);

  // Time filter.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const filter: FilterSpecification | null = hour === null ? null : ["==", ["get", "hour"], hour];
    map.setFilter("edges", filter);
    map.setFilter("edges-hit", filter);
  }, [hour, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute top-[16px] right-[16px] flex flex-col overflow-hidden rounded-[6px] bg-surface shadow-[0px_2px_10px_0px_rgba(0,0,0,0.3)]">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
          className="flex size-[34px] cursor-pointer items-center justify-center border-b border-line hover:bg-line"
        >
          <img src="/figma/icon-plus.svg" width={16} height={16} alt="" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
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
        contributors
      </p>
    </div>
  );
}

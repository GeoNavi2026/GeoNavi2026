"use client";

// OpenStreetMap base map with the selected dataset drawn on top.
// Browser-only: load it through next/dynamic with ssr: false.

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
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
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export default function MapView({ dataset }: { dataset: DatasetResponse | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [-82.35, 29.65],
      zoom: 11,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

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
          // Offset each line to the right of its direction, so A→B and B→A
          // sit side by side instead of on top of each other.
          "line-offset": ["/", EDGE_WIDTH, 2],
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
          "line-offset": ["/", EDGE_WIDTH, 2],
          "line-opacity": 0,
        },
      });

      map.addLayer({
        id: "nodes",
        type: "circle",
        source: "nodes",
        paint: {
          "circle-radius": 7,
          "circle-color": "#f97316",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      const popup = (e: MapLayerMouseEvent, html: string) =>
        new Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);

      map.on("click", "nodes", (e: MapLayerMouseEvent) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        popup(e, `<strong>${escapeHtml(String(p.name))}</strong><br/>${escapeHtml(String(p.id))}`);
      });

      map.on("click", "edges-hit", (e: MapLayerMouseEvent) => {
        // A node sits on top of its edges; let the node popup win.
        if (map.queryRenderedFeatures(e.point, { layers: ["nodes"] }).length) return;
        const p = e.features?.[0]?.properties;
        if (!p) return;
        popup(
          e,
          `<strong>${escapeHtml(String(p.sourceName))} → ${escapeHtml(String(p.targetName))}</strong>` +
            `<br/>Weight: ${Number(p.weight).toLocaleString()}`
        );
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

    if (dataset) {
      const [minLon, minLat, maxLon, maxLat] = dataset.meta.bbox;
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 40, duration: 600 }
      );
    }
  }, [dataset, ready]);

  return <div ref={containerRef} className="h-full w-full" />;
}

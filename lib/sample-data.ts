import type { DatasetResponse, DatasetMeta } from "./types";

const gnvCommute: DatasetResponse = {
  meta: {
    id: "gnv-commute",
    name: "Gainesville Commute Flows",
    description: "Sample home-to-work flows between census tracts.",
    source: "Sample data (not real)",
    region: "Gainesville, FL",
    temporal: false,
    nodeCount: 4,
    edgeCount: 4,
    bbox: [-82.42, 29.61, -82.30, 29.69],
  },
  nodes: [
    { id: "n1", coords: [-82.3248, 29.6516], name: "Downtown" },
    { id: "n2", coords: [-82.4102, 29.6789], name: "Northwest" },
    { id: "n3", coords: [-82.3510, 29.6420], name: "Campus" },
    { id: "n4", coords: [-82.3700, 29.6200], name: "South" },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n3", weight: 412 },
    { id: "e2", source: "n2", target: "n3", weight: 287 },
    { id: "e3", source: "n4", target: "n1", weight: 155 },
    { id: "e4", source: "n3", target: "n1", weight: 390 },
  ],
};

export const datasets: Record<string, DatasetResponse> = {
  "gnv-commute": gnvCommute,
};

export const catalog: DatasetMeta[] = Object.values(datasets).map((d) => d.meta);
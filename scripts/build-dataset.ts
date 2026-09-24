import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {parse} from "csv-parse/sync"
import { toGeoJson } from "@/lib/to-geojson";
import type { DatasetResponse } from "@/lib/types";

type CsvRow = {
    Otract : string;
    Dtract : string;
    EST : string;
};

const rows = parse(readFileSync("data/test/flow_demo.csv"),{
    columns: true,
    skip_empty_lines: true,
    trim: true

})as CsvRow [];

const coords = JSON.parse(
    readFileSync("data/test/tract_centroids.json", "utf8")
) as Record<string, [number, number]>;

const ids = new Set(rows.flatMap(({Otract, Dtract}) => [Otract, Dtract]));

const nodes = [...ids].map((id) => {
  if (!coords[id]) throw new Error(`Missing coordinates for ${id}`);
  return { id, coords: coords[id], name: id };
});

const edges = rows.map(({ Otract, Dtract, EST }, index) => {
  const weight = Number(EST);
  if (!Number.isFinite(weight)) throw new Error(`Invalid EST on row ${index + 2}`);

  return {
    id: `${Otract}->${Dtract}-${index}`,
    source: Otract,
    target: Dtract,
    weight,
  };
});

const points = nodes.map(({ coords }) => coords);

const dataset: DatasetResponse = {
  meta: {
    id: "csv-test",
    name: "CSV Test",
    description: "Generated from OD flow data.",
    source: "data/test/flows.csv",
    region: "Test region",
    temporal: false,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    bbox: [
      Math.min(...points.map(([lon]) => lon)),
      Math.min(...points.map(([, lat]) => lat)),
      Math.max(...points.map(([lon]) => lon)),
      Math.max(...points.map(([, lat]) => lat)),
    ],
  },
  nodes,
  edges,
};

mkdirSync("data/test/output", { recursive: true });
writeFileSync(
  "data/test/output/test_geojson.json",
  JSON.stringify(toGeoJson(dataset), null, 2)
);

console.log(`Built ${edges.length} flows for ${nodes.length} tracts`);
import * as duckdb from "@duckdb/duckdb-wasm";
import type { DatasetResponse, Edge, Node } from "./types";

type CsvRow = {
  origin: string | null;
  destination: string | null;
  weight: number | null;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
};

function coordinates(
  longitude: number | null,
  latitude: number | null,
  tractId: string,
  rowNumber: number
): [number, number] {
  if (
    longitude === null || latitude === null ||
    !Number.isFinite(longitude) || !Number.isFinite(latitude) ||
    longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90
  ) {
    throw new Error(`Invalid coordinates for tract ${tractId} on CSV row ${rowNumber}.`);
  }
  return [longitude, latitude];
}

export async function processUpload(file: File): Promise<DatasetResponse> {
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: "text/javascript",
    })
  );
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);

  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const connection = await db.connect();

    try {
      await db.registerFileBuffer(
        "flows.csv",
        new Uint8Array(await file.arrayBuffer())
      );

      const result = await connection.query(`
        SELECT
          trim(Otract) AS origin,
          trim(Dtract) AS destination,
          try_cast(nullif(trim(EST), '') AS DOUBLE) AS weight,
          try_cast(nullif(trim(O_lat), '') AS DOUBLE) AS originLatitude,
          try_cast(nullif(trim(O_lon), '') AS DOUBLE) AS originLongitude,
          try_cast(nullif(trim(D_lat), '') AS DOUBLE) AS destinationLatitude,
          try_cast(nullif(trim(D_lon), '') AS DOUBLE) AS destinationLongitude
        FROM read_csv_auto('flows.csv', all_varchar = true)
      `);

      const rows = result.toArray().map(
        (row) => row.toJSON() as unknown as CsvRow
      );
      if (!rows.length) throw new Error("The CSV has no flow rows.");

      const coordinatesByTract = new Map<string, [number, number]>();
      const edges: Edge[] = rows.map((row, index) => {
        const { origin, destination, weight } = row;
        if (!origin || !destination || weight === null || !Number.isFinite(weight)) {
          throw new Error(`Invalid CSV row ${index + 2}`);
        }

        const originCoords = coordinates(
          row.originLongitude,
          row.originLatitude,
          origin,
          index + 2
        );
        const destinationCoords = coordinates(
          row.destinationLongitude,
          row.destinationLatitude,
          destination,
          index + 2
        );

        for (const [tractId, point] of [
          [origin, originCoords],
          [destination, destinationCoords],
        ] as [string, [number, number]][]) {
          const existing = coordinatesByTract.get(tractId);
          if (existing && (existing[0] !== point[0] || existing[1] !== point[1])) {
            throw new Error(`Inconsistent coordinates for tract ${tractId}.`);
          }
          coordinatesByTract.set(tractId, point);
        }

        return {
          id: `${origin}->${destination}-${index}`,
          source: origin,
          target: destination,
          weight,
        };
      });

      const nodes: Node[] = [...coordinatesByTract].map(([id, coords]) => ({
        id,
        coords,
        name: id,
      }));
      const points = nodes.map(({ coords }) => coords);

      return {
        meta: {
          id: `upload-${crypto.randomUUID()}`,
          name: file.name,
          description: "Flow data loaded from a CSV upload.",
          source: file.name,
          region: "Uploaded dataset",
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
    } finally {
      await connection.close();
    }
  } finally {
    URL.revokeObjectURL(workerUrl);
    await db.terminate();
    worker.terminate();
  }
}
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getCatalog, getDataset } from "@/lib/api";
import type { CatalogResponse, DatasetResponse } from "@/lib/types";

// MapLibre needs `window`, so never render the map on the server.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-zinc-100 dark:bg-zinc-900" />,
});

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export default function Explorer() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dataset, setDataset] = useState<DatasetResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  // Tagged with the dataset id, so a stale error never shows for a new selection.
  const [datasetError, setDatasetError] = useState<{ id: string; message: string } | null>(
    null
  );
  const [uploadedDataset, setUploadedDataset] = useState<DatasetResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load the catalog once and select the first dataset.
  useEffect(() => {
    const controller = new AbortController();
    getCatalog(controller.signal)
      .then((list) => {
        setCatalog(list);
        setSelectedId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setCatalogError(errorMessage(err));
      });
    return () => controller.abort();
  }, []);

  // Load the selected dataset.
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    getDataset(selectedId, controller.signal)
      .then(setDataset)
      .catch((err) => {
        if (!controller.signal.aborted) {
          setDatasetError({ id: selectedId, message: errorMessage(err) });
        }
      });
    return () => controller.abort();
  }, [selectedId]);

  const error =
    uploadError ?? catalogError ?? (datasetError?.id === selectedId ? datasetError.message : null);
  const loading = selectedId !== null && dataset?.meta.id !== selectedId && !error;
  const activeDataset = uploadedDataset ?? dataset;
  const meta = activeDataset?.meta;

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <aside className="flex max-h-[40dvh] shrink-0 flex-col gap-4 overflow-y-auto border-b border-zinc-200 p-4 md:max-h-none md:w-80 md:border-r md:border-b-0 dark:border-zinc-800">
        <h1 className="text-xl font-semibold tracking-tight">GeoNavi</h1>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Upload data</span>
          <input
            type="file"
            accept=".csv,.json,.geojson,text/csv,application/json,application/geo+json"
            disabled={uploading}
            onChange={async (event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (!file) return;

              setUploading(true);
              setUploadError(null);
              try {
                const { processUpload } = await import("@/lib/process-upload");
                setUploadedDataset(await processUpload(file));
              } catch (uploadFailure) {
                setUploadError(errorMessage(uploadFailure));
              } finally {
                setUploading(false);
                input.value = "";
              }
            }}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Dataset</span>
          <select
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            value={selectedId ?? ""}
            onChange={(e) => {
              setUploadedDataset(null);
              setUploadError(null);
              setSelectedId(e.target.value);
            }}
            disabled={!catalog?.length}
          >
            {!catalog && <option value="">Loading…</option>}
            {catalog?.length === 0 && <option value="">No datasets available</option>}
            {catalog?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {loading && <p className="text-sm text-zinc-500">Loading dataset…</p>}

        {meta && (
          <section className="flex flex-col gap-3 text-sm">
            <div>
              <h2 className="text-base font-semibold">{meta.name}</h2>
              <p className="text-zinc-600 dark:text-zinc-400">{meta.description}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-zinc-500">Region</dt>
              <dd>{meta.region}</dd>
              <dt className="text-zinc-500">Source</dt>
              <dd>{meta.source}</dd>
              <dt className="text-zinc-500">Nodes</dt>
              <dd>{meta.nodeCount.toLocaleString()}</dd>
              <dt className="text-zinc-500">Edges</dt>
              <dd>{meta.edgeCount.toLocaleString()}</dd>
            </dl>
            <p className="text-xs text-zinc-500">
              Line width and colour show edge weight. Click a node or edge for details.
            </p>
          </section>
        )}
      </aside>

      <main className="relative min-h-0 flex-1">
        <MapView dataset={activeDataset} />
      </main>
    </div>
  );
}

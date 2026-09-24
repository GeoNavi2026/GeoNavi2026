// Typed client for the dataset endpoints. See docs/data-contract.md.

import type { CatalogResponse, DatasetResponse } from "./types";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed: ${res.status} ${url}`);
  }
  return res.json() as Promise<T>;
}

export function getCatalog(signal?: AbortSignal) {
  return getJson<CatalogResponse>("/api/datasets", signal);
}

export function getDataset(id: string, signal?: AbortSignal) {
  return getJson<DatasetResponse>(
    `/api/datasets/${encodeURIComponent(id)}`,
    signal
  );
}

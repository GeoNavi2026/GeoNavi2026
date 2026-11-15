import { describe, expect, it, vi } from "vitest";
import { catalog, datasets } from "../lib/sample-data";
import { getCatalog, getDatasetById } from "../lib/datasets";
import { getCatalog as fetchCatalog, getDataset } from "../lib/api";

describe("built-in datasets and API clients", () => {
  it("exports the built-in sample catalog and dataset", () => {
    expect(catalog).toHaveLength(1);
    expect(catalog[0].id).toBe("gnv-commute");
    expect(datasets["gnv-commute"].edges).toHaveLength(4);
  });

  it("loads the built-in dataset through the local catalog helpers", () => {
    expect(getCatalog()).toHaveLength(1);
    expect(getDatasetById("gnv-commute")?.meta.name).toContain("Gainesville");
    expect(getDatasetById("unknown")).toBeNull();
  });

  it("requests catalog and datasets with encoded URLs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => catalog })
      .mockResolvedValueOnce({ ok: true, json: async () => datasets["gnv-commute"] });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCatalog()).resolves.toEqual(catalog);
    await expect(getDataset("a/b")).resolves.toEqual(datasets["gnv-commute"]);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/datasets", { signal: undefined });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/datasets/a%2Fb", { signal: undefined });
  });

  it("turns unsuccessful API responses into useful errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Dataset not found" }),
    }));
    await expect(fetchCatalog()).rejects.toThrow("Dataset not found");
  });
});

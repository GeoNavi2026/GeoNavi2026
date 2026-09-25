import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const dataDir = join(process.cwd(), "data/test/output");

const datasetFiles = ["test_dataset.json"];

export function GET() {
  const catalog = datasetFiles
    .map((file) => {
      const filepath = join(dataDir, file);
      if (!existsSync(filepath)) return null;
      const dataset = JSON.parse(readFileSync(filepath, "utf-8"));
      return dataset.meta;
    })
    .filter(Boolean);

  return NextResponse.json(catalog);
}
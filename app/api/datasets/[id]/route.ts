import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ensureDataset } from "@/lib/dataset-selection";

const dataDir = join(process.cwd(), "data/test/output");

const idToFile: Record<string, string> = {
  "csv-test": "test_dataset.json",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureDataset();
  const { id } = await params;
  const filename = idToFile[id];

  if (!filename) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  const filepath = join(dataDir, filename);

  if (!existsSync(filepath)) {
    return NextResponse.json({ error: "Dataset file missing" }, { status: 404 });
  }

  const data = JSON.parse(readFileSync(filepath, "utf-8"));
  return NextResponse.json(data);
}
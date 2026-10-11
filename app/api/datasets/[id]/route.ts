import { NextResponse } from "next/server";
import { getDatasetById } from "@/lib/datasets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dataset = getDatasetById(id);

  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  return NextResponse.json(dataset);
}

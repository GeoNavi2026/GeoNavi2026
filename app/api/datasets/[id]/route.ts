import { NextResponse } from "next/server";
import { datasets } from "@/lib/sample-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dataset = datasets[id];

  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  return NextResponse.json(dataset);
}
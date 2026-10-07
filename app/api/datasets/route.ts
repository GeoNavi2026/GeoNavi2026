import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/datasets";

export function GET() {
  return NextResponse.json(getCatalog());
}

import { NextResponse } from "next/server";
import { catalog } from "@/lib/sample-data";

export function GET() {
  return NextResponse.json(catalog);
}
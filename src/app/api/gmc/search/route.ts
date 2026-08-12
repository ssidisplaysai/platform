import { NextResponse } from "next/server";
import { handleSearch } from "@/lib/gmc/mission-control-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleSearch(request);
}

import { NextResponse } from "next/server";
import { handleApplications, handleFilters } from "@/lib/gmc/mission-control-api";

export async function GET(request: Request): Promise<NextResponse> {
  const mode = new URL(request.url, "http://localhost").searchParams.get("mode");
  if (mode === "filters") {
    return handleFilters();
  }

  return handleApplications(request);
}

import { NextResponse } from "next/server";
import { getPageGenerationDashboard } from "@/lib/glw/page-generation-api";

export async function GET(request: Request): Promise<NextResponse> {
  return getPageGenerationDashboard(request);
}

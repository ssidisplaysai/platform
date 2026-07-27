import { NextResponse } from "next/server";
import { handleListAnalyticsSnapshots } from "@/lib/gmp/analytics-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListAnalyticsSnapshots(request);
}

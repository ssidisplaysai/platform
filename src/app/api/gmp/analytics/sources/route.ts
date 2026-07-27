import { NextResponse } from "next/server";
import { handleCreateAnalyticsSource, handleListAnalyticsSources } from "@/lib/gmp/analytics-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListAnalyticsSources(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleCreateAnalyticsSource(request);
}

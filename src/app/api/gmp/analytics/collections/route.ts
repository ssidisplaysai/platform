import { NextResponse } from "next/server";
import { handleCreateAnalyticsCollection, handleListAnalyticsCollections } from "@/lib/gmp/analytics-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListAnalyticsCollections(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleCreateAnalyticsCollection(request);
}

import { NextResponse } from "next/server";
import { handleGenerateGlwDailyPublishPlan, handleGetGlwDailyPublishPlan } from "@/lib/glw/publishing-plan-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleGetGlwDailyPublishPlan(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleGenerateGlwDailyPublishPlan(request);
}
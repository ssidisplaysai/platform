import { NextResponse } from "next/server";
import { handleApproveGlwDailyPublishPlan } from "@/lib/glw/publishing-plan-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleApproveGlwDailyPublishPlan(request);
}
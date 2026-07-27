import { NextResponse } from "next/server";
import { handleListContentPlanVersions } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ planId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { planId } = await context.params;
  return handleListContentPlanVersions(request, planId);
}

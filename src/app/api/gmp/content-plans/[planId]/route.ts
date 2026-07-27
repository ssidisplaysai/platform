import { NextResponse } from "next/server";
import { handleGetContentPlan, handleUpdateContentPlan } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ planId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { planId } = await context.params;
  return handleGetContentPlan(request, planId);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { planId } = await context.params;
  return handleUpdateContentPlan(request, planId);
}

import { NextResponse } from "next/server";
import { handleCreateSection, handleGetContentPlanSections } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ planId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { planId } = await context.params;
  return handleGetContentPlanSections(request, planId);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { planId } = await context.params;
  return handleCreateSection(request, planId);
}

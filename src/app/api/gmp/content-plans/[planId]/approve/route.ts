import { NextResponse } from "next/server";
import { handleApproveContentPlan } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ planId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { planId } = await context.params;
  return handleApproveContentPlan(request, planId);
}

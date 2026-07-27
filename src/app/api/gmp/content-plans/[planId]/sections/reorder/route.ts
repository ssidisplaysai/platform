import { NextResponse } from "next/server";
import { handleReorderSections } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ planId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { planId } = await context.params;
  return handleReorderSections(request, planId);
}

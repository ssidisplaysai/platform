import { NextResponse } from "next/server";
import { handleGeneratePagePlan } from "@/lib/gmp/page-api";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleGeneratePagePlan(request, pageId);
}

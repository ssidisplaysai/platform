import { NextResponse } from "next/server";
import { handleCreatePageBrief, handleListPageBriefs } from "@/lib/gmp/page-api";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleListPageBriefs(request, pageId);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleCreatePageBrief(request, pageId);
}

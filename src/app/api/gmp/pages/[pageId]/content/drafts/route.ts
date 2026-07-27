import { NextResponse } from "next/server";
import { handleCreateContentDraft, handleListContentDrafts } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ pageId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleListContentDrafts(request, pageId);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleCreateContentDraft(request, pageId);
}

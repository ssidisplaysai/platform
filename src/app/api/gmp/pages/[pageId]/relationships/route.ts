import { NextResponse } from "next/server";
import { handleListPageRelationships, handleUpsertPageRelationship } from "@/lib/gmp/page-api";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleListPageRelationships(request, pageId);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleUpsertPageRelationship(request, pageId);
}

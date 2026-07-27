import { NextResponse } from "next/server";
import { handleRunRelationshipScan } from "@/lib/gmp/page-api";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleRunRelationshipScan(request, pageId);
}

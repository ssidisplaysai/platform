import { NextResponse } from "next/server";
import { handleGetRelationshipHealth } from "@/lib/gmp/page-api";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleGetRelationshipHealth(request, pageId);
}

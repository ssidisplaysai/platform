import { NextResponse } from "next/server";
import { handleGetInternalLinkHealth } from "@/lib/gmp/page-api";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleGetInternalLinkHealth(request, pageId);
}

import { NextResponse } from "next/server";
import { handleGetTimeline } from "@/lib/bge/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const tenantId = new URL(request.url).searchParams.get("tenant_id") ?? "tenant_demo";
  return handleGetTimeline(request, id, tenantId);
}

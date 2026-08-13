import { NextResponse } from "next/server";
import { handleGetRelationship } from "@/lib/bge/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const tenantId = new URL(_request.url).searchParams.get("tenant_id") ?? undefined;
  return handleGetRelationship(_request, id, tenantId);
}

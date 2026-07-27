import { NextResponse } from "next/server";
import { handleDeleteRelationship } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ relationshipId: string }> };

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const { relationshipId } = await context.params;
  return handleDeleteRelationship(request, relationshipId);
}

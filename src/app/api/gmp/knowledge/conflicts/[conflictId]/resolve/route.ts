import { NextResponse } from "next/server";
import { handleResolveKnowledgeConflict } from "@/lib/gmp/knowledge-api";

type RouteContext = {
  params: Promise<{ conflictId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { conflictId } = await context.params;
  return handleResolveKnowledgeConflict(request, conflictId);
}

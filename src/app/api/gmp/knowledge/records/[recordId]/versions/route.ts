import { NextResponse } from "next/server";
import { handleGetKnowledgeRecordVersions } from "@/lib/gmp/knowledge-api";

type RouteContext = {
  params: Promise<{ recordId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { recordId } = await context.params;
  return handleGetKnowledgeRecordVersions(request, recordId);
}

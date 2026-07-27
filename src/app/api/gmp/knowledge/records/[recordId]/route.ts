import { NextResponse } from "next/server";
import { handleDeleteKnowledgeRecord, handleGetKnowledgeRecord, handleUpdateKnowledgeRecord } from "@/lib/gmp/knowledge-api";

type RouteContext = {
  params: Promise<{ recordId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { recordId } = await context.params;
  return handleGetKnowledgeRecord(request, recordId);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { recordId } = await context.params;
  return handleUpdateKnowledgeRecord(request, recordId);
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const { recordId } = await context.params;
  return handleDeleteKnowledgeRecord(request, recordId);
}

import { NextResponse } from "next/server";
import { handleCreateKnowledgeRecord, handleListKnowledgeRecords } from "@/lib/gmp/knowledge-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleListKnowledgeRecords(request, id);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleCreateKnowledgeRecord(request, id);
}

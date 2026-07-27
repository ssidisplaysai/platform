import { NextResponse } from "next/server";
import { handleRejectRecord } from "@/lib/gmp/knowledge-api";

type RouteContext = {
  params: Promise<{ recordId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { recordId } = await context.params;
  return handleRejectRecord(request, recordId);
}

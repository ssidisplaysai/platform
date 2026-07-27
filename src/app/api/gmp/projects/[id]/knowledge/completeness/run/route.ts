import { NextResponse } from "next/server";
import { handleRunCompleteness } from "@/lib/gmp/knowledge-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleRunCompleteness(request, id);
}

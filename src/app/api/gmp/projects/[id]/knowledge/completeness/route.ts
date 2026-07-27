import { NextResponse } from "next/server";
import { handleGetCompleteness } from "@/lib/gmp/knowledge-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetCompleteness(request, id);
}

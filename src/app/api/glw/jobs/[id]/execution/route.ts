import { NextResponse } from "next/server";
import { handleGetN8nExecutionDiagnostics } from "@/lib/glw/page-generation-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetN8nExecutionDiagnostics(request, id);
}

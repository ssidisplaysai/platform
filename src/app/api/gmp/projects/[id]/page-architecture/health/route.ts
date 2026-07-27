import { NextResponse } from "next/server";
import { handleGetProjectPageArchitectureHealth } from "@/lib/gmp/page-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetProjectPageArchitectureHealth(request, id);
}

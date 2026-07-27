import { NextResponse } from "next/server";
import { handleRunProjectPageArchitectureScan } from "@/lib/gmp/page-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleRunProjectPageArchitectureScan(request, id);
}

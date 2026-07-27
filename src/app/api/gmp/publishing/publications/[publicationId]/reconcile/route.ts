import { NextResponse } from "next/server";
import { handleGetReconciliation, handleReconcilePublication } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ publicationId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { publicationId } = await context.params;
  return handleGetReconciliation(request, publicationId);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { publicationId } = await context.params;
  return handleReconcilePublication(request, publicationId);
}

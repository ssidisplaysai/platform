import { NextResponse } from "next/server";
import { handleGetEvidenceSnapshot } from "@/lib/gmp/evidence-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetEvidenceSnapshot(request, id);
}

import { NextResponse } from "next/server";
import { handleGetPublication } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ publicationId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { publicationId } = await context.params;
  return handleGetPublication(request, publicationId);
}

import { NextResponse } from "next/server";
import { handleRetryPublication } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ publicationId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { publicationId } = await context.params;
  return handleRetryPublication(request, publicationId);
}

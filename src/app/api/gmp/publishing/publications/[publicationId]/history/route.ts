import { NextResponse } from "next/server";
import { handleGetPublicationHistory } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ publicationId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { publicationId } = await context.params;
  return handleGetPublicationHistory(request, publicationId);
}

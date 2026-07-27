import { NextResponse } from "next/server";
import { handleVerifyPublication } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ publicationId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { publicationId } = await context.params;
  return handleVerifyPublication(request, publicationId);
}

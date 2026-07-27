import { NextResponse } from "next/server";
import { handleInvalidateDestinationCredentialCache } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ destinationId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { destinationId } = await context.params;
  return handleInvalidateDestinationCredentialCache(request, destinationId);
}

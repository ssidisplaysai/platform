import { NextResponse } from "next/server";
import { handleGetDestinationCapabilities } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ destinationId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { destinationId } = await context.params;
  return handleGetDestinationCapabilities(request, destinationId);
}

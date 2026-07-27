import { NextResponse } from "next/server";
import { handleGetDestinationHealth } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ destinationId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { destinationId } = await context.params;
  return handleGetDestinationHealth(request, destinationId);
}

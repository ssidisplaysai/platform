import { NextResponse } from "next/server";
import { handleGetDestination, handlePatchDestination } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ destinationId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { destinationId } = await context.params;
  return handleGetDestination(request, destinationId);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { destinationId } = await context.params;
  return handlePatchDestination(request, destinationId);
}

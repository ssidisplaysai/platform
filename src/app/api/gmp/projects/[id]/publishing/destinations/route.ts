import { NextResponse } from "next/server";
import { handleCreateDestination, handleListDestinations } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleListDestinations(request, id);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleCreateDestination(request, id);
}

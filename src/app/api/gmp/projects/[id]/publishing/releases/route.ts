import { NextResponse } from "next/server";
import { handleCreateRelease, handleListReleases } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleListReleases(request, id);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleCreateRelease(request, id);
}

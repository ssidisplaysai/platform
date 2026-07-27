import { NextResponse } from "next/server";
import { handleGetBrandProfile, handleUpsertBrandProfile } from "@/lib/gmp/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetBrandProfile(request, id);
}

export async function PUT(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleUpsertBrandProfile(request, id);
}

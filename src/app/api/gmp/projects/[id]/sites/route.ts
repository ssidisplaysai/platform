import { NextResponse } from "next/server";
import { handleCreateSite, handleListSites } from "@/lib/gmp/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleListSites(request, id);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleCreateSite(request, id);
}

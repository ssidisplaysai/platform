import { NextResponse } from "next/server";
import { handleCreateConnection, handleListConnections } from "@/lib/gmp/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleListConnections(request, id);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleCreateConnection(request, id);
}

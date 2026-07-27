import { NextResponse } from "next/server";
import { handleArchiveConnection, handleUpdateConnection } from "@/lib/gmp/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleUpdateConnection(request, id);
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleArchiveConnection(request, id);
}

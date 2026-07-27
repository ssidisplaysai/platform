import { NextResponse } from "next/server";
import { handleArchiveProject, handleGetProject, handleUpdateProject } from "@/lib/gmp/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetProject(request, id);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleUpdateProject(request, id);
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleArchiveProject(request, id);
}

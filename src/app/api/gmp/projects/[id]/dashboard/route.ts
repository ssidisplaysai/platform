import { NextResponse } from "next/server";
import { handleProjectDashboard } from "@/lib/gmp/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleProjectDashboard(request, id);
}

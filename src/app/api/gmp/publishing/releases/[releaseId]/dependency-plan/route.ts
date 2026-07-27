import { NextResponse } from "next/server";
import { handleGetReleaseDependencyPlan } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ releaseId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { releaseId } = await context.params;
  return handleGetReleaseDependencyPlan(request, releaseId);
}

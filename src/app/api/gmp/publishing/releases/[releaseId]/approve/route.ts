import { NextResponse } from "next/server";
import { handleApproveRelease } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ releaseId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { releaseId } = await context.params;
  return handleApproveRelease(request, releaseId);
}

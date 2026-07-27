import { NextResponse } from "next/server";
import { handleValidateRelease } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ releaseId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { releaseId } = await context.params;
  return handleValidateRelease(request, releaseId);
}

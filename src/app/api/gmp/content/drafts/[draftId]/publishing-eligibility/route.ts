import { NextResponse } from "next/server";
import { handleGetPublishingEligibility } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { draftId } = await context.params;
  return handleGetPublishingEligibility(request, draftId);
}

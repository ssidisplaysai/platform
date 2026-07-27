import { NextResponse } from "next/server";
import { handleGetPublishingManifest } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ packageId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { packageId } = await context.params;
  return handleGetPublishingManifest(request, packageId);
}

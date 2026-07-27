import { NextResponse } from "next/server";
import { handleRejectPublishingPackage } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ packageId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { packageId } = await context.params;
  return handleRejectPublishingPackage(request, packageId);
}

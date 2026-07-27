import { NextResponse } from "next/server";
import { handleGetPublishingPackage, handlePatchPublishingPackage } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ packageId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { packageId } = await context.params;
  return handleGetPublishingPackage(request, packageId);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { packageId } = await context.params;
  return handlePatchPublishingPackage(request, packageId);
}

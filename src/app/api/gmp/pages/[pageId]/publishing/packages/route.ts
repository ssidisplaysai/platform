import { NextResponse } from "next/server";
import { handleCreatePublishingPackage, handleListPublishingPackages } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleListPublishingPackages(request, pageId);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleCreatePublishingPackage(request, pageId);
}

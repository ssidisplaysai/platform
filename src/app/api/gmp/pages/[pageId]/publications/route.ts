import { NextResponse } from "next/server";
import { handleListPublications } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleListPublications(request, pageId);
}

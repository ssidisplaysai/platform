import { NextResponse } from "next/server";
import { handleGetAnalyticsSourceCapabilities } from "@/lib/gmp/analytics-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetAnalyticsSourceCapabilities(request, id);
}

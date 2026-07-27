import { NextResponse } from "next/server";
import { handleValidateAnalyticsSource } from "@/lib/gmp/analytics-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleValidateAnalyticsSource(request, id);
}

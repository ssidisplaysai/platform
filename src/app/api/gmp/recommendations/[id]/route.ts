import { NextResponse } from "next/server";
import { handleGetRecommendation } from "@/lib/gmp/recommendation-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetRecommendation(request, id);
}

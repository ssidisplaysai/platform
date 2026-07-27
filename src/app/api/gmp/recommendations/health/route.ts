import { NextResponse } from "next/server";
import { handleRecommendationHealth } from "@/lib/gmp/recommendation-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleRecommendationHealth(request);
}

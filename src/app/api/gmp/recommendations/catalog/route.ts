import { NextResponse } from "next/server";
import { handleListRecommendationCatalog } from "@/lib/gmp/recommendation-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListRecommendationCatalog(request);
}

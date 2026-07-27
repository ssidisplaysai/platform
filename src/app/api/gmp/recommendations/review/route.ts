import { NextResponse } from "next/server";
import { handleReviewRecommendation } from "@/lib/gmp/recommendation-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleReviewRecommendation(request);
}

import { NextResponse } from "next/server";
import { handleDismissRecommendation } from "@/lib/gmp/recommendation-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleDismissRecommendation(request);
}

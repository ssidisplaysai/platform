import { NextResponse } from "next/server";
import { handleListRecommendations } from "@/lib/gmp/recommendation-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListRecommendations(request);
}

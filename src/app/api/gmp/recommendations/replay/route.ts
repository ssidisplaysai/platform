import { NextResponse } from "next/server";
import { handleReplayRecommendations } from "@/lib/gmp/recommendation-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleReplayRecommendations(request);
}

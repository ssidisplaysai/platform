import { NextResponse } from "next/server";
import { handleDecisionSupport } from "@/lib/gmp/recommendation-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleDecisionSupport(request);
}

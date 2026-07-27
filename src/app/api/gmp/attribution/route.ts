import { NextResponse } from "next/server";
import { handleListAttribution } from "@/lib/gmp/recommendation-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListAttribution(request);
}

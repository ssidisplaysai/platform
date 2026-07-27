import { NextResponse } from "next/server";
import { handleRetryCallback } from "@/lib/glw/page-generation-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleRetryCallback(request);
}

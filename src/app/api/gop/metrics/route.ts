import { NextResponse } from "next/server";
import { handleGetGopMetrics } from "@/lib/gop/events-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleGetGopMetrics(request);
}

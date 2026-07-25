import { NextResponse } from "next/server";
import { handleJobCallback } from "@/lib/glw/page-generation-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleJobCallback(request);
}

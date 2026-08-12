import { NextResponse } from "next/server";
import { handlePauseGlwPublishing, handleResumeGlwPublishing } from "@/lib/glw/publishing-plan-api";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "resume") {
    return handleResumeGlwPublishing(request);
  }

  return handlePauseGlwPublishing(request);
}
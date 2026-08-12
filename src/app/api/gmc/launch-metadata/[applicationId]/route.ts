import { NextResponse } from "next/server";
import { handleLaunchMetadata } from "@/lib/gmc/mission-control-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleLaunchMetadata(applicationId);
}

import { NextResponse } from "next/server";
import { handleCapabilityStatus } from "@/lib/ehc/health-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleCapabilityStatus(applicationId);
}

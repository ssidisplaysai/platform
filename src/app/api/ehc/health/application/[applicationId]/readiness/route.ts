import { NextResponse } from "next/server";
import { handleReadiness } from "@/lib/ehc/health-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleReadiness(applicationId);
}

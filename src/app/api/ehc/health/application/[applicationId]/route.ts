import { NextResponse } from "next/server";
import { handleApplicationHealth, handleEvaluateApplicationHealth } from "@/lib/ehc/health-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleApplicationHealth(applicationId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleEvaluateApplicationHealth(request, applicationId);
}

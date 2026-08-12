import { NextResponse } from "next/server";
import { handleCompatibilityEvaluation } from "@/lib/ehc/health-api";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleCompatibilityEvaluation(request, applicationId);
}

import { NextResponse } from "next/server";
import { handleApplicationHealthHistory } from "@/lib/ehc/health-api";

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleApplicationHealthHistory(request, applicationId);
}

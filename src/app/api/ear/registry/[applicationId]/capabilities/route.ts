import { NextResponse } from "next/server";
import { handleLookupCapabilities } from "@/lib/ear/registry-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleLookupCapabilities(applicationId);
}

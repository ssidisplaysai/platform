import { NextResponse } from "next/server";
import { handleGlwCapabilityStatus } from "@/lib/glw/runtime-health-api";

export async function GET(): Promise<NextResponse> {
  return handleGlwCapabilityStatus();
}

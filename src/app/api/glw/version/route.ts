import { NextResponse } from "next/server";
import { handleGlwRuntimeVersion } from "@/lib/glw/runtime-health-api";

export async function GET(): Promise<NextResponse> {
  return handleGlwRuntimeVersion();
}

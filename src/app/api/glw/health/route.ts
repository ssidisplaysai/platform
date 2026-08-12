import { NextResponse } from "next/server";
import { handleGlwRuntimeHealth } from "@/lib/glw/runtime-health-api";

export async function GET(): Promise<NextResponse> {
  return handleGlwRuntimeHealth();
}

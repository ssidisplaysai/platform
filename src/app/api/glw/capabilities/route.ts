import { NextResponse } from "next/server";
import { handleCapabilityStatus } from "@/lib/ehc/health-api";

export async function GET(): Promise<NextResponse> {
  return handleCapabilityStatus("glw");
}

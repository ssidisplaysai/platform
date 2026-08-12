import { NextResponse } from "next/server";
import { handleHealthSummary } from "@/lib/gmc/mission-control-api";

export async function GET(): Promise<NextResponse> {
  return handleHealthSummary();
}

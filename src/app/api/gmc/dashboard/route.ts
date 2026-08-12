import { NextResponse } from "next/server";
import { handleDashboard } from "@/lib/gmc/mission-control-api";

export async function GET(): Promise<NextResponse> {
  return handleDashboard();
}

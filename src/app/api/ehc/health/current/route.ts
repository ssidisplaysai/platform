import { NextResponse } from "next/server";
import { handleCurrentHealth } from "@/lib/ehc/health-api";

export async function GET(): Promise<NextResponse> {
  return handleCurrentHealth();
}

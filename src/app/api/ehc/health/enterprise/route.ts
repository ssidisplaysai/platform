import { NextResponse } from "next/server";
import { handleEnterpriseHealth } from "@/lib/ehc/health-api";

export async function GET(): Promise<NextResponse> {
  return handleEnterpriseHealth();
}

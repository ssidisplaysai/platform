import { NextResponse } from "next/server";
import { handleNavigation } from "@/lib/gmc/mission-control-api";

export async function GET(): Promise<NextResponse> {
  return handleNavigation();
}

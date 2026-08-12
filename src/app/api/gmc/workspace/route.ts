import { NextResponse } from "next/server";
import { handleWorkspace } from "@/lib/gmc/mission-control-api";

export async function GET(): Promise<NextResponse> {
  return handleWorkspace();
}

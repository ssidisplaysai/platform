import { NextResponse } from "next/server";
import { handleHealth } from "@/lib/gea/agent-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleHealth(request);
}

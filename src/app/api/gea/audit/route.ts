import { NextResponse } from "next/server";
import { handleAudit } from "@/lib/gea/agent-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleAudit(request);
}

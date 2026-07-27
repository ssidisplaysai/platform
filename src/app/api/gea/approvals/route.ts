import { NextResponse } from "next/server";
import { handleApprovals } from "@/lib/gea/agent-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleApprovals(request);
}

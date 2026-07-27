import { NextResponse } from "next/server";
import { handleReplayExecution } from "@/lib/gea/agent-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleReplayExecution(request);
}

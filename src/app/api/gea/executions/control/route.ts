import { NextResponse } from "next/server";
import { handleExecutionControl } from "@/lib/gea/agent-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleExecutionControl(request);
}

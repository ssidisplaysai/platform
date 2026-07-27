import { NextResponse } from "next/server";
import { handleCreateExecution, handleListExecutions } from "@/lib/gea/agent-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListExecutions(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleCreateExecution(request);
}

import { NextResponse } from "next/server";
import { handleCreateAgent, handleListAgents } from "@/lib/gea/agent-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListAgents(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleCreateAgent(request);
}

import { NextResponse } from "next/server";
import { handleMemoryReferences } from "@/lib/gea/agent-api";
import { handleMemory } from "@/lib/gea/memory-api";

export async function GET(request: Request): Promise<NextResponse> {
  const hasAgentId = new URL(request.url).searchParams.has("agentId");
  return hasAgentId ? handleMemoryReferences(request) : handleMemory(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleMemory(request);
}

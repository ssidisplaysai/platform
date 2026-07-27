import { NextResponse } from "next/server";
import { handleCreatePlan } from "@/lib/gea/agent-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleCreatePlan(request);
}

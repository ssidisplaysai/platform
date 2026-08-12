import { NextResponse } from "next/server";
import { handleJobCallback } from "@/lib/glw/page-generation-api";

export async function POST(request: Request): Promise<NextResponse> {
  const webhookSecret = process.env.GLW_N8N_WEBHOOK_SECRET ?? "";
  return handleJobCallback(request, { webhookSecret });
}

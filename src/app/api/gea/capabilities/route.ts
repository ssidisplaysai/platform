import { NextResponse } from "next/server";
import { handleCapabilities } from "@/lib/gea/agent-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleCapabilities(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleCapabilities(request);
}

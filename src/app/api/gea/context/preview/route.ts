import { NextResponse } from "next/server";
import { handleContextPreview } from "@/lib/gea/agent-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleContextPreview(request);
}

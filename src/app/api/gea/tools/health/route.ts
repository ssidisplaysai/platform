import { NextResponse } from "next/server";
import { handleToolHealth } from "@/lib/gea/tool-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleToolHealth(request);
}

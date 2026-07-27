import { NextResponse } from "next/server";
import { handleToolExecutions } from "@/lib/gea/tool-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleToolExecutions(request);
}

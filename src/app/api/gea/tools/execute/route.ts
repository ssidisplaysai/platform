import { NextResponse } from "next/server";
import { handleToolExecute } from "@/lib/gea/tool-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleToolExecute(request);
}

import { NextResponse } from "next/server";
import { handleToolReplay } from "@/lib/gea/tool-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleToolReplay(request);
}

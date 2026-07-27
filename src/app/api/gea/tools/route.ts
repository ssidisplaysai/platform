import { NextResponse } from "next/server";
import { handleListTools } from "@/lib/gea/tool-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListTools(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleListTools(request);
}

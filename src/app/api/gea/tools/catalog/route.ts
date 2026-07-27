import { NextResponse } from "next/server";
import { handleToolCatalog } from "@/lib/gea/tool-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleToolCatalog(request);
}

import { NextResponse } from "next/server";
import { handleToolCategories } from "@/lib/gea/tool-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleToolCategories(request);
}

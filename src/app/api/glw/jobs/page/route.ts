import { NextResponse } from "next/server";
import { handleCreatePageGenerationJob } from "@/lib/glw/page-generation-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleCreatePageGenerationJob(request);
}

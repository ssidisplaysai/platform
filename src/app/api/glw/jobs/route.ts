import { NextResponse } from "next/server";
import { listPageGenerationJobs } from "@/lib/glw/page-generation-api";

export async function GET(request: Request): Promise<NextResponse> {
  return listPageGenerationJobs(request);
}

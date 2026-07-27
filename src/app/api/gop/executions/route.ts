import { NextResponse } from "next/server";
import { handleListExecutions } from "@/lib/gop/executions-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListExecutions(request);
}

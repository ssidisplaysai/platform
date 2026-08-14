import { NextResponse } from "next/server";
import { handleRunTimeoutReconciliation } from "@/lib/glw/page-generation-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleRunTimeoutReconciliation(request);
}

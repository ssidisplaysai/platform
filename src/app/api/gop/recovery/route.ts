import { NextResponse } from "next/server";
import { handleExecuteRecovery, handleGetRecoveryAudit } from "@/lib/gop/recovery-api";

export async function GET(): Promise<NextResponse> {
  return handleGetRecoveryAudit();
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleExecuteRecovery(request);
}

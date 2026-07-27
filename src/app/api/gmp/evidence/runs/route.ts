import { NextResponse } from "next/server";
import { handleListEvidenceCompilerRuns } from "@/lib/gmp/evidence-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListEvidenceCompilerRuns(request);
}

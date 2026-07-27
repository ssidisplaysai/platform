import { NextResponse } from "next/server";
import { handleListEvidenceMetrics } from "@/lib/gmp/evidence-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListEvidenceMetrics(request);
}

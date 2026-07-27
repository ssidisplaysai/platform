import { NextResponse } from "next/server";
import { handleListEvidenceMetricCatalog } from "@/lib/gmp/evidence-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListEvidenceMetricCatalog(request);
}

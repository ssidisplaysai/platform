import { NextResponse } from "next/server";
import { handleListEvidenceSnapshots } from "@/lib/gmp/evidence-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListEvidenceSnapshots(request);
}

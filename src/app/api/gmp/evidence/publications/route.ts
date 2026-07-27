import { NextResponse } from "next/server";
import { handleListEvidencePublications } from "@/lib/gmp/evidence-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListEvidencePublications(request);
}

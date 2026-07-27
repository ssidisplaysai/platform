import { NextResponse } from "next/server";
import { handleRecompileEvidence } from "@/lib/gmp/evidence-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleRecompileEvidence(request);
}

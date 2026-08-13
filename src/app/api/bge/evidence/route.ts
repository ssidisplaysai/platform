import { NextResponse } from "next/server";
import { handlePostEvidence } from "@/lib/bge/api";

export async function POST(request: Request): Promise<NextResponse> {
  return handlePostEvidence(request);
}

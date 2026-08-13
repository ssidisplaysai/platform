import { NextResponse } from "next/server";
import { handlePostProposal } from "@/lib/bge/api";

export async function POST(request: Request): Promise<NextResponse> {
  return handlePostProposal(request);
}

import { NextResponse } from "next/server";
import { handlePostApproval } from "@/lib/bge/api";

export async function POST(request: Request): Promise<NextResponse> {
  return handlePostApproval(request);
}

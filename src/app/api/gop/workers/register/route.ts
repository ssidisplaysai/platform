import { NextResponse } from "next/server";
import { handleRegisterWorker } from "@/lib/gop/workers-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleRegisterWorker(request);
}

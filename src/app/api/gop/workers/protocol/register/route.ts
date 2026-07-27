import { NextResponse } from "next/server";
import { handleProtocolWorkerRegister } from "@/lib/gop/workers-api";

export async function POST(request: Request): Promise<NextResponse> {
  return handleProtocolWorkerRegister(request);
}

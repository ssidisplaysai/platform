import { NextResponse } from "next/server";
import { handleGetOperationsSnapshot } from "@/lib/gop/operations-api";

export async function GET(): Promise<NextResponse> {
  return handleGetOperationsSnapshot();
}

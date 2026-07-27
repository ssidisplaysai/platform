import { NextResponse } from "next/server";
import { handleListDeadLetters } from "@/lib/gop/fabric-api";

export async function GET(): Promise<NextResponse> {
  return handleListDeadLetters();
}

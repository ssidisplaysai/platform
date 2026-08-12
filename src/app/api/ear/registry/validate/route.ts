import { NextResponse } from "next/server";
import { handleValidateCompatibility, handleValidateRegistration } from "@/lib/ear/registry-api";

export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url, "http://localhost");
  const mode = url.searchParams.get("mode") ?? "registration";

  if (mode === "compatibility") {
    return handleValidateCompatibility(request);
  }

  return handleValidateRegistration(request);
}

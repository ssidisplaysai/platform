import { NextResponse } from "next/server";
import { handleListApplications, handleRegisterApplication } from "@/lib/ear/registry-api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListApplications(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleRegisterApplication(request);
}

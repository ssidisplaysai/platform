import { NextResponse } from "next/server";
import { handleCreateProject, handleListProjects } from "@/lib/gmp/api";

export async function GET(request: Request): Promise<NextResponse> {
  return handleListProjects(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleCreateProject(request);
}

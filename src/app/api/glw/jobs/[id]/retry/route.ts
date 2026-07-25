import { NextResponse } from "next/server";
import { handleRetryJob } from "@/lib/glw/page-generation-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleRetryJob(request, id);
}

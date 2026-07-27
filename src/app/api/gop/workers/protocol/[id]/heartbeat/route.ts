import { NextResponse } from "next/server";
import { handleProtocolWorkerHeartbeat } from "@/lib/gop/workers-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleProtocolWorkerHeartbeat(request, id);
}

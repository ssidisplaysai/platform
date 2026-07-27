import { NextResponse } from "next/server";
import { handleWorkerHeartbeat } from "@/lib/gop/workers-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleWorkerHeartbeat(id);
}

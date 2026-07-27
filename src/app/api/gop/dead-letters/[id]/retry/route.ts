import { NextResponse } from "next/server";
import { handleRetryDeadLetter } from "@/lib/gop/fabric-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleRetryDeadLetter(id);
}

import { NextResponse } from "next/server";
import { handleListProjectPublications } from "@/lib/gmp/publishing-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleListProjectPublications(request, id);
}

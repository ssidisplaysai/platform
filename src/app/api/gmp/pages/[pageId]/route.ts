import { NextResponse } from "next/server";
import { handleArchivePage, handleGetPage, handleUpdatePage } from "@/lib/gmp/page-api";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleGetPage(request, pageId);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleUpdatePage(request, pageId);
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleArchivePage(request, pageId);
}

import { NextResponse } from "next/server";
import {
  handleDeactivateApplication,
  handleLookupApplication,
  handleUpdateApplication,
  handleValidateLifecycleTransition,
} from "@/lib/ear/registry-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleLookupApplication(applicationId);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleUpdateApplication(request, applicationId);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleDeactivateApplication(request, applicationId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse> {
  const { applicationId } = await context.params;
  return handleValidateLifecycleTransition(request, applicationId);
}

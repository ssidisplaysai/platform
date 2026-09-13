import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getLocalThemeVisualCertification } from "@/modules/foundation/local-theme-visual-certification-repository";
import { captureHoustonReferencePreview } from "@/modules/glw/houston-reference-preview-capture-service";
import { HOUSTON_BUNDLE_ID, HOUSTON_RENDERER_VERSION } from "@/modules/glw/houston-reference-preview";
import { createHoustonReferencePreview, getHoustonReferencePreview } from "@/modules/glw/houston-reference-preview-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const scoped = (request: NextRequest, permission: "sites:read" | "sites:update") => {
  const auth = authorizeRequest(request, permission);
  const scope = resolveRequestScope(request);
  return { auth, valid: auth.ok && scope.organizationId === "ssi" && scope.siteId === "site-ssi-projectorenclosure" && (permission === "sites:read" || auth.roles.includes("platform_admin")) };
};

export async function GET(request: NextRequest) {
  const access = scoped(request, "sites:read");
  if (!access.valid) return NextResponse.json({ error: access.auth.error ?? "Exact Houston scope required." }, { status: access.auth.ok ? 403 : access.auth.status });
  const preview = getHoustonReferencePreview();
  const certification = getLocalThemeVisualCertification(HOUSTON_BUNDLE_ID, HOUSTON_RENDERER_VERSION);
  return NextResponse.json({ preview, certification, wordpressMutationPerformed: false, wordpressCreated: false, campaignMutationPerformed: false, jobCreated: false, executionCreated: false, dispatchPerformed: false, publicationPerformed: false });
}

export async function POST(request: NextRequest) {
  const access = scoped(request, "sites:update");
  if (!access.valid) return NextResponse.json({ error: "Platform-admin exact Houston scope required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { operation?: string } | null;
  if (!body || Object.keys(body).length !== 1 || !["CREATE_HOUSTON_REFERENCE_PREVIEW", "CAPTURE_HOUSTON_REFERENCE_PREVIEW"].includes(body.operation ?? "")) return NextResponse.json({ error: "Exact Houston preview operation required." }, { status: 400 });
  try {
    const existing = getHoustonReferencePreview();
    const result = body.operation === "CREATE_HOUSTON_REFERENCE_PREVIEW" ? { preview: existing ?? await createHoustonReferencePreview(), reused: Boolean(existing) } : await captureHoustonReferencePreview();
    return NextResponse.json({ ...result, wordpressMutationPerformed: false, wordpressCreated: false, campaignMutationPerformed: false, jobCreated: false, executionCreated: false, dispatchPerformed: false, publicationPerformed: false }, { status: result.reused ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "HOUSTON_REFERENCE_PREVIEW_FAILED", wordpressMutationPerformed: false, wordpressCreated: false, campaignMutationPerformed: false, jobCreated: false, executionCreated: false, dispatchPerformed: false, publicationPerformed: false }, { status: 422 });
  }
}

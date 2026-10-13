import { NextRequest, NextResponse } from "next/server";

import { readHoustonDraftCapture } from "@/modules/glw/houston-approved-draft-capture-service";
import { getHoustonDraftState } from "@/modules/glw/houston-approved-preview-draft-repository";
import { getHoustonPublicationState } from "@/modules/glw/houston-reference-page-publication-repository";
import { readHoustonPublicCapture } from "@/modules/glw/houston-reference-page-publication-service";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ captureId: string }> }) { const { captureId } = await context.params; if (request.nextUrl.searchParams.get("organizationId") !== "ssi" || request.nextUrl.searchParams.get("siteId") !== "site-ssi-projectorenclosure") return new NextResponse("Not found", { status: 404 }); const draftCapture = getHoustonDraftState().certifications.flatMap((item) => item.captures).find((item) => item.captureId === captureId); const publicCapture = getHoustonPublicationState().visualCertifications.flatMap((item) => item.captures).find((item) => item.captureId === captureId); const capture = draftCapture ?? publicCapture; if (!capture) return new NextResponse("Not found", { status: 404 }); const bytes = draftCapture ? readHoustonDraftCapture(capture.artifact.reference) : readHoustonPublicCapture(capture.artifact.reference); return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": "image/png", "content-length": String(bytes.length), "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" } }); }

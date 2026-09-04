import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { executePublishedContextualMediaUpdate, PUBLISHED_CONTEXTUAL_MEDIA_UPDATE, type PublishedContextualMediaInput } from "@/modules/foundation/published-contextual-media-authority";
import { createPublishedContextualMediaWordPressTransport } from "@/modules/foundation/published-contextual-media-wordpress-transport";
import { getSiteById } from "@/modules/foundation/site-repository";

const MAX_GENERATED_MEDIA_BYTES = 12 * 1024 * 1024;

type RequestBody = Omit<PublishedContextualMediaInput, "operation" | "media"> & {
  operation?: string;
  media?:
    | PublishedContextualMediaInput["media"]
    | (Omit<Extract<PublishedContextualMediaInput["media"], { type: "GENERATED_CONTEXTUAL" }>, "bytes"> & { bytesBase64: string });
};

export async function POST(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId);
  if (!site || siteId !== "site-ssi-projectorenclosure" || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return NextResponse.json({ error: "ProjectorEnclosure site scope is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body || body.operation !== PUBLISHED_CONTEXTUAL_MEDIA_UPDATE || !body.media) return NextResponse.json({ error: "Explicit published contextual-media authority is required." }, { status: 400 });

  let media: PublishedContextualMediaInput["media"];
  if (body.media.type === "GENERATED_CONTEXTUAL") {
    if (!("bytesBase64" in body.media) || typeof body.media.bytesBase64 !== "string") return NextResponse.json({ error: "Generated media bytes are required." }, { status: 400 });
    const bytes = Buffer.from(body.media.bytesBase64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_GENERATED_MEDIA_BYTES || bytes.toString("base64") !== body.media.bytesBase64) return NextResponse.json({ error: "Generated media payload is invalid, non-canonical, or too large." }, { status: 400 });
    const { bytesBase64: _, ...metadata } = body.media;
    void _;
    media = { ...metadata, bytes };
  } else {
    media = body.media;
  }
  const transport = createPublishedContextualMediaWordPressTransport(site);
  if (!transport) return NextResponse.json({ error: "Published contextual-media WordPress transport is unavailable." }, { status: 409 });
  const result = await executePublishedContextualMediaUpdate({ ...body, operation: PUBLISHED_CONTEXTUAL_MEDIA_UPDATE, siteId, media } as PublishedContextualMediaInput, transport);
  return NextResponse.json(result, { status: result.ok ? 200 : result.evidence.state === "FAILED_PRECONDITION" ? 409 : 422 });
}

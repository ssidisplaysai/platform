import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { replacePageImageWithOwnerAsset } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";

const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export async function POST(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:manage_integrations"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status }); const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId);
  if (!hasOrganizationScope(scope) || !site || site.organizationId !== scope.organizationId || (scope.siteId && scope.siteId !== site.siteId)) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  try { const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File) || !MIME_TYPES.has(file.type) || file.size < 1 || file.size > 20_000_000) throw new Error("OWNER_IMAGE_INVALID"); const candidate = replacePageImageWithOwnerAsset(site, "site-owner", { pageId: String(form.get("pageId") ?? ""), slotId: String(form.get("slotId") ?? ""), mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", bytes: Buffer.from(await file.arrayBuffer()), instructions: String(form.get("instructions") ?? "") }); return NextResponse.json({ candidate, wordpressMutation: false, publicationMutation: false }); } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "OWNER_IMAGE_REPLACEMENT_FAILED" }, { status: 422 }); }
}
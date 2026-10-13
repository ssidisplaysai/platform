import { notFound } from "next/navigation";

import { getLocalThemeVisualCertification } from "@/modules/foundation/local-theme-visual-certification-repository";
import { GlwHoustonReferencePreviewReview } from "@/modules/glw/GlwHoustonReferencePreviewReview";
import { GlwMarketInformedReferencePreview } from "@/modules/glw/GlwMarketInformedReferencePreview";
import { HOUSTON_BUNDLE_ID, HOUSTON_RENDERER_VERSION } from "@/modules/glw/houston-reference-preview";
import { getHoustonReferencePreview } from "@/modules/glw/houston-reference-preview-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<{ organizationId?: string | string[]; siteId?: string | string[]; capture?: string | string[] }> };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0] ?? null;

export default async function HoustonReferencePreviewPage({ searchParams }: Props) {
  const query = await searchParams;
  if (first(query.organizationId) !== "ssi" || first(query.siteId) !== "site-ssi-projectorenclosure") notFound();
  const preview = getHoustonReferencePreview();
  if (!preview) notFound();
  if (first(query.capture) === "1") return <main><GlwMarketInformedReferencePreview bundle={preview.bundle} market={preview.market} narrative={preview.narrative} /></main>;
  const certification = getLocalThemeVisualCertification(HOUSTON_BUNDLE_ID, HOUSTON_RENDERER_VERSION);
  return <GlwHoustonReferencePreviewReview preview={preview} certification={certification} />;
}

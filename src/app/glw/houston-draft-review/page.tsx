import { notFound } from "next/navigation";

import { GlwHoustonDraftComparison } from "@/modules/glw/GlwHoustonDraftComparison";
import { GlwHoustonReferencePage } from "@/modules/glw/GlwHoustonReferencePage";
import { getHoustonDraftState } from "@/modules/glw/houston-approved-preview-draft-repository";
import { inspectHoustonWordPressAuthority } from "@/modules/glw/houston-approved-preview-draft-service";
import { getHoustonPublicationState } from "@/modules/glw/houston-reference-page-publication-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { searchParams: Promise<{ organizationId?: string | string[]; siteId?: string | string[] }> };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0] ?? null;
export default async function HoustonDraftReviewPage({ searchParams }: Props) { const query = await searchParams; if (first(query.organizationId) !== "ssi" || first(query.siteId) !== "site-ssi-projectorenclosure") notFound(); const publication = getHoustonPublicationState(); if (publication.referenceCertifications.length) return <GlwHoustonReferencePage state={publication} />; const state = getHoustonDraftState(); const receipt = state.receipts.at(-1); const certification = state.certifications.at(-1); const comparison = state.comparisons.at(-1); const approval = receipt ? state.approvals.find((item) => item.decisionId === receipt.decisionId) : null; if (!approval || !receipt || !certification || !comparison) notFound(); const readback = await inspectHoustonWordPressAuthority(receipt.wordpressObjectId); return <GlwHoustonDraftComparison approval={approval} receipt={receipt} certification={certification} comparison={comparison} readback={readback} />; }

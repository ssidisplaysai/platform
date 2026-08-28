import type { GlwCanonicalTargetIdentity } from "../glw/target-preflight";
import { createCanonicalContentHash } from "./canonical-content-hash";

export type LiveCertificationTargetAuthorization = {
  targetId: string;
  siteId: string;
  applicationPath: string;
  canonicalPath: string;
  slug: string;
  parentId: string;
  productId: string;
  productFamilyId: string;
  state: string;
  city: string;
  pageBlueprintId: string;
  pageBlueprintVersion: number;
  operation: "CREATE";
  authenticatedExactResultCount: 0;
  authenticatedAbsenceCheckedAt: string;
  preflightPolicyVersion: string;
  publicationIntent: "draft";
  readAuthorityReference: string;
  authorizationFingerprint: string;
};

export function createLiveCertificationTargetAuthorization(input: {
  targetId: string;
  siteId: string;
  identity: GlwCanonicalTargetIdentity;
  productId: string;
  productFamilyId: string;
  state: string;
  city: string;
  pageBlueprintId: string;
  pageBlueprintVersion: number;
  authenticatedExactResultCount: 0;
  authenticatedAbsenceCheckedAt: string;
  preflightPolicyVersion: string;
  readAuthorityReference: string;
}): LiveCertificationTargetAuthorization {
  if (!input.identity.canonicalParentId) throw new Error("Certification target requires an exact canonical parent ID.");
  const semantic = {
    targetId: input.targetId,
    siteId: input.siteId,
    applicationPath: input.identity.applicationPath,
    canonicalPath: input.identity.canonicalPath,
    slug: input.identity.canonicalSlug,
    parentId: input.identity.canonicalParentId,
    productId: input.productId,
    productFamilyId: input.productFamilyId,
    state: input.state,
    city: input.city,
    pageBlueprintId: input.pageBlueprintId,
    pageBlueprintVersion: input.pageBlueprintVersion,
    operation: "CREATE" as const,
    authenticatedExactResultCount: input.authenticatedExactResultCount,
    preflightPolicyVersion: input.preflightPolicyVersion,
    publicationIntent: "draft",
    readAuthorityReference: input.readAuthorityReference,
  };
  return {
    ...semantic,
    authenticatedAbsenceCheckedAt: input.authenticatedAbsenceCheckedAt,
    publicationIntent: "draft",
    authorizationFingerprint: createCanonicalContentHash(semantic),
  };
}
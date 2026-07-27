import {
  GMP_PUBLISHING_MANIFEST_SCHEMA_VERSION,
  GMP_PUBLISHING_PACKAGE_SCHEMA_VERSION,
  type GmpPublishingManifest,
  type GmpPublishingPackage,
  type GmpPublishingDestinationType,
} from "./publishing-models";

export const gmpPublishingPackageSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "gmp-publishing-package.schema.json",
  type: "object",
  required: [
    "publishingPackageId",
    "projectId",
    "siteId",
    "pageId",
    "contentDraftId",
    "destinationId",
    "destinationType",
    "packageStatus",
    "releaseStatus",
    "packageVersion",
    "packageSchemaVersion",
    "publishingPolicyVersion",
    "sourceFingerprint",
    "packageFingerprint",
    "canonicalUrl",
    "targetSlug",
    "language",
    "locale",
    "createdBy",
  ],
  properties: {
    packageSchemaVersion: { const: GMP_PUBLISHING_PACKAGE_SCHEMA_VERSION },
    destinationType: { type: "string" },
    metadata: { type: "object" },
  },
  additionalProperties: true,
} as const;

export const gmpPublishingManifestSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "gmp-publishing-manifest.schema.json",
  type: "object",
  required: [
    "packageId",
    "packageVersion",
    "projectIdentity",
    "siteIdentity",
    "pageIdentity",
    "sourceDraftIdentity",
    "approvedRevisionReferences",
    "destinationIdentity",
    "destinationType",
    "contentPayloadReference",
    "seoPayload",
    "metadataPayload",
    "structuredDataPayload",
    "mediaManifest",
    "internalLinkManifest",
    "externalLinkManifest",
    "canonicalInstructions",
    "openGraphData",
    "socialMetadata",
    "publicationMode",
    "validationSummary",
    "lineageSummary",
    "packageFingerprint",
    "createdAt",
    "manifestSchemaVersion",
  ],
  properties: {
    manifestSchemaVersion: { const: GMP_PUBLISHING_MANIFEST_SCHEMA_VERSION },
  },
  additionalProperties: true,
} as const;

export const gmpDestinationCapabilitySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "gmp-destination-capability.schema.json",
  type: "object",
  required: ["destinationType", "capabilities"],
  properties: {
    destinationType: { type: "string" },
    capabilities: { type: "object", additionalProperties: { type: "boolean" } },
  },
  additionalProperties: false,
} as const;

export function validatePublishingPackage(input: GmpPublishingPackage): { ok: true } | { ok: false; error: string } {
  if (input.packageSchemaVersion !== GMP_PUBLISHING_PACKAGE_SCHEMA_VERSION) {
    return { ok: false, error: "Unsupported publishing package schema version." };
  }
  if (!input.destinationId || !input.publishingPackageId) {
    return { ok: false, error: "Publishing package identity is incomplete." };
  }
  return { ok: true };
}

export function validatePublishingManifest(input: GmpPublishingManifest): { ok: true } | { ok: false; error: string } {
  if (input.manifestSchemaVersion !== GMP_PUBLISHING_MANIFEST_SCHEMA_VERSION) {
    return { ok: false, error: "Unsupported publishing manifest schema version." };
  }
  if (!input.packageId || !input.packageFingerprint) {
    return { ok: false, error: "Publishing manifest identity is incomplete." };
  }
  return { ok: true };
}

export function defaultCapabilitiesByDestination(type: GmpPublishingDestinationType): Record<string, boolean> {
  const baseline = {
    createPage: true,
    updatePage: true,
    createPost: true,
    updatePost: true,
    uploadMedia: true,
    setFeaturedMedia: true,
    setSeoMetadata: true,
    setCanonicalUrl: true,
    setOpenGraphMetadata: true,
    setStructuredData: true,
    assignCategories: true,
    assignTags: true,
    assignAuthor: true,
    schedulePublication: true,
    publishImmediately: true,
    saveDraft: true,
    archive: true,
    delete: true,
    rollback: false,
    readBackPublishedContent: true,
    verifyPublishedState: true,
    supportCustomFields: true,
    supportRevisions: true,
  };

  if (type === "STATIC_EXPORT") {
    return {
      ...baseline,
      uploadMedia: false,
      setFeaturedMedia: false,
      assignCategories: false,
      assignTags: false,
      assignAuthor: false,
      schedulePublication: false,
      supportRevisions: false,
    };
  }

  return baseline;
}

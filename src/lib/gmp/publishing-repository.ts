/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  GmpApprovedRevisionSet,
  GmpPublicationAttempt,
  GmpPublicationRecord,
  GmpPublicationReconciliation,
  GmpPublicationVerification,
  GmpPublishingDestination,
  GmpPublishingIdempotencyRecord,
  GmpPublishingManifest,
  GmpPublishingPackage,
  GmpPublishingPackageValidation,
  GmpRelease,
  GmpReleaseItem,
} from "./publishing-models";

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function asJson(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function mapDestination(row: any): GmpPublishingDestination {
  return {
    destinationId: row.destinationId,
    projectId: row.projectId,
    siteId: row.siteId,
    destinationType: row.destinationType,
    name: row.name,
    baseUrl: row.baseUrl,
    environment: row.environment,
    connectionStatus: row.connectionStatus,
    credentialReference: row.credentialReference ?? undefined,
    capabilityProfile: asJson(row.capabilityProfile) ?? {},
    configuration: asJson(row.configuration),
    defaultAuthor: row.defaultAuthor ?? undefined,
    defaultStatus: row.defaultStatus ?? undefined,
    defaultTaxonomyMapping: asJson(row.defaultTaxonomyMapping),
    defaultMediaPolicy: asJson(row.defaultMediaPolicy),
    defaultSeoPolicy: asJson(row.defaultSeoPolicy),
    webhookConfiguration: asJson(row.webhookConfiguration),
    metadata: asJson(row.metadata),
    lastValidatedAt: iso(row.lastValidatedAt),
    lastSuccessfulPublishAt: iso(row.lastSuccessfulPublishAt),
    lastFailureAt: iso(row.lastFailureAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapApprovedSet(row: any): GmpApprovedRevisionSet {
  return {
    approvedRevisionSetId: row.approvedRevisionSetId,
    projectId: row.projectId,
    siteId: row.siteId,
    pageId: row.pageId,
    contentDraftId: row.contentDraftId,
    contentDraftVersion: row.contentDraftVersion,
    sourceFingerprint: row.sourceFingerprint,
    sections: asArray(row.sections),
    seoMetadata: asJson(row.seoMetadata) ?? {},
    structuredDataInputs: asJson(row.structuredDataInputs) ?? {},
    approvalRecords: asArray(row.approvalRecords),
    validationRecords: asArray(row.validationRecords),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPackage(row: any): GmpPublishingPackage {
  return {
    publishingPackageId: row.publishingPackageId,
    projectId: row.projectId,
    siteId: row.siteId,
    pageId: row.pageId,
    contentDraftId: row.contentDraftId,
    contentDraftVersion: row.contentDraftVersion,
    approvedRevisionSetId: row.approvedRevisionSetId ?? undefined,
    destinationId: row.destinationId,
    destinationType: row.destinationType,
    packageStatus: row.packageStatus,
    releaseStatus: row.releaseStatus,
    packageVersion: row.packageVersion,
    packageSchemaVersion: row.packageSchemaVersion,
    publishingPolicyVersion: row.publishingPolicyVersion,
    sourceFingerprint: row.sourceFingerprint,
    packageFingerprint: row.packageFingerprint,
    canonicalUrl: row.canonicalUrl,
    targetSlug: row.targetSlug,
    language: row.language,
    locale: row.locale,
    createdBy: row.createdBy,
    validatedAt: iso(row.validatedAt),
    approvedAt: iso(row.approvedAt),
    approvedBy: row.approvedBy ?? undefined,
    rejectedAt: iso(row.rejectedAt),
    rejectedBy: row.rejectedBy ?? undefined,
    supersededAt: iso(row.supersededAt),
    archivedAt: iso(row.archivedAt),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapManifest(row: any): GmpPublishingManifest {
  return {
    packageId: row.publishingPackageId,
    packageVersion: row.packageVersion,
    projectIdentity: asJson(row.projectIdentity) ?? {},
    siteIdentity: asJson(row.siteIdentity) ?? {},
    pageIdentity: asJson(row.pageIdentity) ?? {},
    sourceDraftIdentity: asJson(row.sourceDraftIdentity) ?? {},
    approvedRevisionReferences: asArray(row.approvedRevisionReferences),
    destinationIdentity: asJson(row.destinationIdentity) ?? {},
    destinationType: row.destinationType,
    contentPayloadReference: asJson(row.contentPayloadReference) ?? {},
    seoPayload: asJson(row.seoPayload) ?? {},
    metadataPayload: asJson(row.metadataPayload) ?? {},
    structuredDataPayload: asJson(row.structuredDataPayload) ?? {},
    mediaManifest: asJson(row.mediaManifest) ?? {},
    internalLinkManifest: asJson(row.internalLinkManifest) ?? {},
    externalLinkManifest: asJson(row.externalLinkManifest) ?? {},
    redirectInstructions: asArray(row.redirectInstructions),
    canonicalInstructions: asJson(row.canonicalInstructions) ?? {},
    openGraphData: asJson(row.openGraphData) ?? {},
    socialMetadata: asJson(row.socialMetadata) ?? {},
    publicationMode: row.publicationMode,
    schedule: asJson(row.schedule),
    validationSummary: asJson(row.validationSummary) ?? {},
    lineageSummary: asJson(row.lineageSummary) ?? {},
    packageFingerprint: row.packageFingerprint,
    createdAt: row.createdAt.toISOString(),
    manifestSchemaVersion: row.manifestSchemaVersion,
  };
}

function mapValidation(row: any): GmpPublishingPackageValidation {
  return {
    packageValidationId: row.packageValidationId,
    publishingPackageId: row.publishingPackageId,
    valid: Boolean(row.valid),
    blockingIssues: asStringArray(row.blockingIssues),
    warnings: asStringArray(row.warnings),
    recommendations: asStringArray(row.recommendations),
    capabilityGaps: asStringArray(row.capabilityGaps),
    validationModelVersion: row.validationModelVersion,
    validatedAt: row.validatedAt.toISOString(),
    metadata: asJson(row.metadata),
  };
}

function mapRelease(row: any): GmpRelease {
  return {
    releaseId: row.releaseId,
    projectId: row.projectId,
    siteId: row.siteId,
    releaseName: row.releaseName,
    releaseType: row.releaseType,
    releaseStatus: row.releaseStatus,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy ?? undefined,
    scheduledAt: iso(row.scheduledAt),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    failedAt: iso(row.failedAt),
    cancelledAt: iso(row.cancelledAt),
    rollbackReleaseId: row.rollbackReleaseId ?? undefined,
    gopExecutionId: row.gopExecutionId ?? undefined,
    policyVersion: row.policyVersion,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapReleaseItem(row: any): GmpReleaseItem {
  return {
    releaseItemId: row.releaseItemId,
    releaseId: row.releaseId,
    publishingPackageId: row.publishingPackageId,
    destinationId: row.destinationId,
    sequence: row.sequence,
    dependencyReferences: asStringArray(row.dependencyReferences),
    status: row.status,
    publicationAttemptCount: row.publicationAttemptCount,
    currentPublicationRecordId: row.currentPublicationRecordId ?? undefined,
    failureReason: row.failureReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAttempt(row: any): GmpPublicationAttempt {
  return {
    publicationAttemptId: row.publicationAttemptId,
    releaseId: row.releaseId,
    releaseItemId: row.releaseItemId,
    publishingPackageId: row.publishingPackageId,
    destinationId: row.destinationId,
    operationType: row.operationType,
    attemptNumber: row.attemptNumber,
    status: row.status,
    gopExecutionId: row.gopExecutionId ?? undefined,
    requestFingerprint: row.requestFingerprint,
    startedAt: row.startedAt.toISOString(),
    completedAt: iso(row.completedAt),
    failedAt: iso(row.failedAt),
    failureCategory: row.failureCategory ?? undefined,
    failureCode: row.failureCode ?? undefined,
    failureMessage: row.failureMessage ?? undefined,
    retryable: Boolean(row.retryable),
    remoteResponseReference: asJson(row.remoteResponseReference),
    metadata: asJson(row.metadata),
  };
}

function mapRecord(row: any): GmpPublicationRecord {
  return {
    publicationRecordId: row.publicationRecordId,
    projectId: row.projectId,
    siteId: row.siteId,
    pageId: row.pageId,
    publishingPackageId: row.publishingPackageId,
    releaseId: row.releaseId,
    destinationId: row.destinationId,
    externalObjectType: row.externalObjectType,
    externalObjectId: row.externalObjectId,
    externalRevisionId: row.externalRevisionId ?? undefined,
    externalUrl: row.externalUrl,
    publishedStatus: row.publishedStatus,
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    verifiedAt: iso(row.verifiedAt),
    remoteContentFingerprint: row.remoteContentFingerprint ?? undefined,
    expectedContentFingerprint: row.expectedContentFingerprint,
    verificationStatus: row.verificationStatus,
    supersedesPublicationRecordId: row.supersedesPublicationRecordId ?? undefined,
    rolledBackFromRecordId: row.rolledBackFromRecordId ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapVerification(row: any): GmpPublicationVerification {
  return {
    publicationVerificationId: row.publicationVerificationId,
    publicationRecordId: row.publicationRecordId,
    verificationStatus: row.verificationStatus,
    expectedState: asJson(row.expectedState) ?? {},
    remoteState: asJson(row.remoteState) ?? {},
    differences: asArray(row.differences),
    blockingDifferences: asArray(row.blockingDifferences),
    warnings: asStringArray(row.warnings),
    verificationModelVersion: row.verificationModelVersion,
    verifiedAt: row.verifiedAt.toISOString(),
    metadata: asJson(row.metadata),
  };
}

function mapReconciliation(row: any): GmpPublicationReconciliation {
  return {
    publicationReconciliationId: row.publicationReconciliationId,
    publicationRecordId: row.publicationRecordId,
    reconciliationStatus: row.reconciliationStatus,
    driftDetected: Boolean(row.driftDetected),
    driftReasons: asStringArray(row.driftReasons),
    expectedState: asJson(row.expectedState) ?? {},
    remoteState: asJson(row.remoteState) ?? {},
    detectedAt: row.detectedAt.toISOString(),
    metadata: asJson(row.metadata),
  };
}

function mapIdempotency(row: any): GmpPublishingIdempotencyRecord {
  return {
    publishingIdempotencyRecordId: row.publishingIdempotencyRecordId,
    destinationId: row.destinationId,
    publishingPackageId: row.publishingPackageId,
    packageVersion: row.packageVersion,
    operationType: row.operationType,
    releaseItemId: row.releaseItemId,
    requestFingerprint: row.requestFingerprint,
    resultFingerprint: row.resultFingerprint,
    status: row.status,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type GmpPublishingRepository = {
  createDestination: (input: Omit<GmpPublishingDestination, "destinationId" | "createdAt" | "updatedAt">) => Promise<GmpPublishingDestination>;
  updateDestination: (destinationId: string, changes: Partial<GmpPublishingDestination>) => Promise<GmpPublishingDestination | null>;
  getDestinationById: (destinationId: string) => Promise<GmpPublishingDestination | null>;
  listDestinationsForProject: (projectId: string) => Promise<GmpPublishingDestination[]>;

  createApprovedRevisionSet: (input: Omit<GmpApprovedRevisionSet, "approvedRevisionSetId" | "createdAt">) => Promise<GmpApprovedRevisionSet>;
  getApprovedRevisionSetById: (approvedRevisionSetId: string) => Promise<GmpApprovedRevisionSet | null>;

  createPackage: (input: Omit<GmpPublishingPackage, "publishingPackageId" | "createdAt" | "updatedAt">) => Promise<GmpPublishingPackage>;
  updatePackage: (publishingPackageId: string, changes: Partial<GmpPublishingPackage>) => Promise<GmpPublishingPackage | null>;
  getPackageById: (publishingPackageId: string) => Promise<GmpPublishingPackage | null>;
  listPackagesForPage: (pageId: string) => Promise<GmpPublishingPackage[]>;

  upsertManifest: (input: GmpPublishingManifest) => Promise<GmpPublishingManifest>;
  getManifestByPackageId: (publishingPackageId: string) => Promise<GmpPublishingManifest | null>;

  createValidation: (input: Omit<GmpPublishingPackageValidation, "packageValidationId">) => Promise<GmpPublishingPackageValidation>;
  getLatestValidation: (publishingPackageId: string) => Promise<GmpPublishingPackageValidation | null>;

  createRelease: (input: Omit<GmpRelease, "releaseId" | "createdAt" | "updatedAt">) => Promise<GmpRelease>;
  updateRelease: (releaseId: string, changes: Partial<GmpRelease>) => Promise<GmpRelease | null>;
  getReleaseById: (releaseId: string) => Promise<GmpRelease | null>;
  listReleasesForProject: (projectId: string) => Promise<GmpRelease[]>;

  createReleaseItem: (input: Omit<GmpReleaseItem, "releaseItemId" | "createdAt" | "updatedAt">) => Promise<GmpReleaseItem>;
  updateReleaseItem: (releaseItemId: string, changes: Partial<GmpReleaseItem>) => Promise<GmpReleaseItem | null>;
  deleteReleaseItem: (releaseItemId: string) => Promise<void>;
  listReleaseItems: (releaseId: string) => Promise<GmpReleaseItem[]>;

  createPublicationAttempt: (input: Omit<GmpPublicationAttempt, "publicationAttemptId">) => Promise<GmpPublicationAttempt>;
  listPublicationAttemptsForReleaseItem: (releaseItemId: string) => Promise<GmpPublicationAttempt[]>;
  listPublicationAttemptsForDestination: (destinationId: string, limit?: number) => Promise<GmpPublicationAttempt[]>;

  createPublicationRecord: (input: Omit<GmpPublicationRecord, "publicationRecordId" | "createdAt">) => Promise<GmpPublicationRecord>;
  getPublicationRecordById: (publicationRecordId: string) => Promise<GmpPublicationRecord | null>;
  listPublicationRecordsForProject: (projectId: string, limit?: number) => Promise<GmpPublicationRecord[]>;
  listPublicationRecordsForPage: (pageId: string) => Promise<GmpPublicationRecord[]>;
  listPublicationRecordsForDestination: (destinationId: string, limit?: number) => Promise<GmpPublicationRecord[]>;

  createVerification: (input: Omit<GmpPublicationVerification, "publicationVerificationId">) => Promise<GmpPublicationVerification>;
  getLatestVerification: (publicationRecordId: string) => Promise<GmpPublicationVerification | null>;

  createReconciliation: (input: Omit<GmpPublicationReconciliation, "publicationReconciliationId">) => Promise<GmpPublicationReconciliation>;
  getLatestReconciliation: (publicationRecordId: string) => Promise<GmpPublicationReconciliation | null>;

  upsertIdempotencyRecord: (input: Omit<GmpPublishingIdempotencyRecord, "publishingIdempotencyRecordId" | "createdAt" | "updatedAt">) => Promise<GmpPublishingIdempotencyRecord>;
  getIdempotencyRecordByRequest: (input: { destinationId: string; publishingPackageId: string; packageVersion: number; operationType: string; releaseItemId: string; requestFingerprint: string }) => Promise<GmpPublishingIdempotencyRecord | null>;
};

export function createPrismaGmpPublishingRepository(prisma: PrismaClient = getPrismaClient()): GmpPublishingRepository {
  const db = prisma as unknown as Record<string, any>;

  return {
    async createDestination(input) {
      const row = await db.gmpPublishingDestination.create({ data: { destinationId: `gmpdest_${randomUUID()}`, ...input } });
      return mapDestination(row);
    },
    async updateDestination(destinationId, changes) {
      const existing = await db.gmpPublishingDestination.findUnique({ where: { destinationId } });
      if (!existing) return null;
      const row = await db.gmpPublishingDestination.update({ where: { destinationId }, data: changes });
      return mapDestination(row);
    },
    async getDestinationById(destinationId) {
      const row = await db.gmpPublishingDestination.findUnique({ where: { destinationId } });
      return row ? mapDestination(row) : null;
    },
    async listDestinationsForProject(projectId) {
      const rows = await db.gmpPublishingDestination.findMany({ where: { projectId }, orderBy: [{ updatedAt: "desc" }] });
      return rows.map(mapDestination);
    },

    async createApprovedRevisionSet(input) {
      const row = await db.gmpApprovedRevisionSet.create({ data: { approvedRevisionSetId: `gmpars_${randomUUID()}`, ...input } });
      return mapApprovedSet(row);
    },
    async getApprovedRevisionSetById(approvedRevisionSetId) {
      const row = await db.gmpApprovedRevisionSet.findUnique({ where: { approvedRevisionSetId } });
      return row ? mapApprovedSet(row) : null;
    },

    async createPackage(input) {
      const row = await db.gmpPublishingPackage.create({ data: { publishingPackageId: `gmppkg_${randomUUID()}`, ...input } });
      return mapPackage(row);
    },
    async updatePackage(publishingPackageId, changes) {
      const existing = await db.gmpPublishingPackage.findUnique({ where: { publishingPackageId } });
      if (!existing) return null;
      const row = await db.gmpPublishingPackage.update({ where: { publishingPackageId }, data: changes });
      return mapPackage(row);
    },
    async getPackageById(publishingPackageId) {
      const row = await db.gmpPublishingPackage.findUnique({ where: { publishingPackageId } });
      return row ? mapPackage(row) : null;
    },
    async listPackagesForPage(pageId) {
      const rows = await db.gmpPublishingPackage.findMany({ where: { pageId }, orderBy: [{ updatedAt: "desc" }] });
      return rows.map(mapPackage);
    },

    async upsertManifest(input) {
      const row = await db.gmpPublishingManifest.upsert({
        where: { publishingPackageId: input.packageId },
        create: {
          publishingManifestId: `gmpman_${randomUUID()}`,
          publishingPackageId: input.packageId,
          packageVersion: input.packageVersion,
          projectIdentity: input.projectIdentity,
          siteIdentity: input.siteIdentity,
          pageIdentity: input.pageIdentity,
          sourceDraftIdentity: input.sourceDraftIdentity,
          approvedRevisionReferences: input.approvedRevisionReferences,
          destinationIdentity: input.destinationIdentity,
          destinationType: input.destinationType,
          contentPayloadReference: input.contentPayloadReference,
          seoPayload: input.seoPayload,
          metadataPayload: input.metadataPayload,
          structuredDataPayload: input.structuredDataPayload,
          mediaManifest: input.mediaManifest,
          internalLinkManifest: input.internalLinkManifest,
          externalLinkManifest: input.externalLinkManifest,
          redirectInstructions: input.redirectInstructions,
          canonicalInstructions: input.canonicalInstructions,
          openGraphData: input.openGraphData,
          socialMetadata: input.socialMetadata,
          publicationMode: input.publicationMode,
          schedule: input.schedule ?? null,
          validationSummary: input.validationSummary,
          lineageSummary: input.lineageSummary,
          packageFingerprint: input.packageFingerprint,
          manifestSchemaVersion: input.manifestSchemaVersion,
        },
        update: {
          packageVersion: input.packageVersion,
          projectIdentity: input.projectIdentity,
          siteIdentity: input.siteIdentity,
          pageIdentity: input.pageIdentity,
          sourceDraftIdentity: input.sourceDraftIdentity,
          approvedRevisionReferences: input.approvedRevisionReferences,
          destinationIdentity: input.destinationIdentity,
          destinationType: input.destinationType,
          contentPayloadReference: input.contentPayloadReference,
          seoPayload: input.seoPayload,
          metadataPayload: input.metadataPayload,
          structuredDataPayload: input.structuredDataPayload,
          mediaManifest: input.mediaManifest,
          internalLinkManifest: input.internalLinkManifest,
          externalLinkManifest: input.externalLinkManifest,
          redirectInstructions: input.redirectInstructions,
          canonicalInstructions: input.canonicalInstructions,
          openGraphData: input.openGraphData,
          socialMetadata: input.socialMetadata,
          publicationMode: input.publicationMode,
          schedule: input.schedule ?? null,
          validationSummary: input.validationSummary,
          lineageSummary: input.lineageSummary,
          packageFingerprint: input.packageFingerprint,
          manifestSchemaVersion: input.manifestSchemaVersion,
        },
      });
      return mapManifest(row);
    },
    async getManifestByPackageId(publishingPackageId) {
      const row = await db.gmpPublishingManifest.findUnique({ where: { publishingPackageId } });
      return row ? mapManifest(row) : null;
    },

    async createValidation(input) {
      const row = await db.gmpPublishingPackageValidation.create({ data: { packageValidationId: `gmpval_${randomUUID()}`, ...input, validatedAt: new Date(input.validatedAt) } });
      return mapValidation(row);
    },
    async getLatestValidation(publishingPackageId) {
      const row = await db.gmpPublishingPackageValidation.findFirst({ where: { publishingPackageId }, orderBy: [{ validatedAt: "desc" }] });
      return row ? mapValidation(row) : null;
    },

    async createRelease(input) {
      const row = await db.gmpRelease.create({
        data: {
          releaseId: `gmprel_${randomUUID()}`,
          ...input,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          startedAt: input.startedAt ? new Date(input.startedAt) : null,
          completedAt: input.completedAt ? new Date(input.completedAt) : null,
          failedAt: input.failedAt ? new Date(input.failedAt) : null,
          cancelledAt: input.cancelledAt ? new Date(input.cancelledAt) : null,
        },
      });
      return mapRelease(row);
    },
    async updateRelease(releaseId, changes) {
      const existing = await db.gmpRelease.findUnique({ where: { releaseId } });
      if (!existing) return null;
      const row = await db.gmpRelease.update({
        where: { releaseId },
        data: {
          ...changes,
          scheduledAt: changes.scheduledAt === undefined ? undefined : changes.scheduledAt ? new Date(changes.scheduledAt) : null,
          startedAt: changes.startedAt === undefined ? undefined : changes.startedAt ? new Date(changes.startedAt) : null,
          completedAt: changes.completedAt === undefined ? undefined : changes.completedAt ? new Date(changes.completedAt) : null,
          failedAt: changes.failedAt === undefined ? undefined : changes.failedAt ? new Date(changes.failedAt) : null,
          cancelledAt: changes.cancelledAt === undefined ? undefined : changes.cancelledAt ? new Date(changes.cancelledAt) : null,
        },
      });
      return mapRelease(row);
    },
    async getReleaseById(releaseId) {
      const row = await db.gmpRelease.findUnique({ where: { releaseId } });
      return row ? mapRelease(row) : null;
    },
    async listReleasesForProject(projectId) {
      const rows = await db.gmpRelease.findMany({ where: { projectId }, orderBy: [{ updatedAt: "desc" }] });
      return rows.map(mapRelease);
    },

    async createReleaseItem(input) {
      const row = await db.gmpReleaseItem.create({ data: { releaseItemId: `gmpitem_${randomUUID()}`, ...input } });
      return mapReleaseItem(row);
    },
    async updateReleaseItem(releaseItemId, changes) {
      const existing = await db.gmpReleaseItem.findUnique({ where: { releaseItemId } });
      if (!existing) return null;
      const row = await db.gmpReleaseItem.update({ where: { releaseItemId }, data: changes });
      return mapReleaseItem(row);
    },
    async deleteReleaseItem(releaseItemId) {
      await db.gmpReleaseItem.delete({ where: { releaseItemId } }).catch(() => null);
    },
    async listReleaseItems(releaseId) {
      const rows = await db.gmpReleaseItem.findMany({ where: { releaseId }, orderBy: [{ sequence: "asc" }] });
      return rows.map(mapReleaseItem);
    },

    async createPublicationAttempt(input) {
      const row = await db.gmpPublicationAttempt.create({
        data: {
          publicationAttemptId: `gmpatt_${randomUUID()}`,
          ...input,
          startedAt: new Date(input.startedAt),
          completedAt: input.completedAt ? new Date(input.completedAt) : null,
          failedAt: input.failedAt ? new Date(input.failedAt) : null,
        },
      });
      return mapAttempt(row);
    },
    async listPublicationAttemptsForReleaseItem(releaseItemId) {
      const rows = await db.gmpPublicationAttempt.findMany({ where: { releaseItemId }, orderBy: [{ attemptNumber: "desc" }] });
      return rows.map(mapAttempt);
    },
    async listPublicationAttemptsForDestination(destinationId, limit = 10) {
      const rows = await db.gmpPublicationAttempt.findMany({
        where: { destinationId },
        orderBy: [{ startedAt: "desc" }],
        take: limit,
      });
      return rows.map(mapAttempt);
    },

    async createPublicationRecord(input) {
      const row = await db.gmpPublicationRecord.create({
        data: {
          publicationRecordId: `gmprec_${randomUUID()}`,
          ...input,
          publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
          updatedAt: new Date(input.updatedAt),
          verifiedAt: input.verifiedAt ? new Date(input.verifiedAt) : null,
        },
      });
      return mapRecord(row);
    },
    async getPublicationRecordById(publicationRecordId) {
      const row = await db.gmpPublicationRecord.findUnique({ where: { publicationRecordId } });
      return row ? mapRecord(row) : null;
    },
    async listPublicationRecordsForProject(projectId, limit = 50) {
      const rows = await db.gmpPublicationRecord.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      });
      return rows.map(mapRecord);
    },
    async listPublicationRecordsForPage(pageId) {
      const rows = await db.gmpPublicationRecord.findMany({ where: { pageId }, orderBy: [{ createdAt: "desc" }] });
      return rows.map(mapRecord);
    },
    async listPublicationRecordsForDestination(destinationId, limit = 20) {
      const rows = await db.gmpPublicationRecord.findMany({
        where: { destinationId },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      });
      return rows.map(mapRecord);
    },

    async createVerification(input) {
      const row = await db.gmpPublicationVerification.create({ data: { publicationVerificationId: `gmpver_${randomUUID()}`, ...input, verifiedAt: new Date(input.verifiedAt) } });
      return mapVerification(row);
    },
    async getLatestVerification(publicationRecordId) {
      const row = await db.gmpPublicationVerification.findFirst({ where: { publicationRecordId }, orderBy: [{ verifiedAt: "desc" }] });
      return row ? mapVerification(row) : null;
    },

    async createReconciliation(input) {
      const row = await db.gmpPublicationReconciliation.create({ data: { publicationReconciliationId: `gmprecon_${randomUUID()}`, ...input, detectedAt: new Date(input.detectedAt) } });
      return mapReconciliation(row);
    },
    async getLatestReconciliation(publicationRecordId) {
      const row = await db.gmpPublicationReconciliation.findFirst({ where: { publicationRecordId }, orderBy: [{ detectedAt: "desc" }] });
      return row ? mapReconciliation(row) : null;
    },

    async upsertIdempotencyRecord(input) {
      const existing = await db.gmpPublishingIdempotencyRecord.findFirst({
        where: {
          destinationId: input.destinationId,
          publishingPackageId: input.publishingPackageId,
          packageVersion: input.packageVersion,
          operationType: input.operationType,
          releaseItemId: input.releaseItemId,
          requestFingerprint: input.requestFingerprint,
        },
      });
      if (existing) {
        const row = await db.gmpPublishingIdempotencyRecord.update({ where: { publishingIdempotencyRecordId: existing.publishingIdempotencyRecordId }, data: input });
        return mapIdempotency(row);
      }
      const row = await db.gmpPublishingIdempotencyRecord.create({ data: { publishingIdempotencyRecordId: `gmpidem_${randomUUID()}`, ...input } });
      return mapIdempotency(row);
    },
    async getIdempotencyRecordByRequest(input) {
      const row = await db.gmpPublishingIdempotencyRecord.findFirst({ where: input });
      return row ? mapIdempotency(row) : null;
    },
  };
}

export function createInMemoryGmpPublishingRepository(seed?: {
  destinations?: GmpPublishingDestination[];
  approvedSets?: GmpApprovedRevisionSet[];
  packages?: GmpPublishingPackage[];
  manifests?: GmpPublishingManifest[];
  validations?: GmpPublishingPackageValidation[];
  releases?: GmpRelease[];
  releaseItems?: GmpReleaseItem[];
  attempts?: GmpPublicationAttempt[];
  records?: GmpPublicationRecord[];
  verifications?: GmpPublicationVerification[];
  reconciliations?: GmpPublicationReconciliation[];
  idempotency?: GmpPublishingIdempotencyRecord[];
}): GmpPublishingRepository {
  const destinations = new Map((seed?.destinations ?? []).map((entry) => [entry.destinationId, entry]));
  const approvedSets = new Map((seed?.approvedSets ?? []).map((entry) => [entry.approvedRevisionSetId, entry]));
  const packages = new Map((seed?.packages ?? []).map((entry) => [entry.publishingPackageId, entry]));
  const manifests = new Map((seed?.manifests ?? []).map((entry) => [entry.packageId, entry]));
  const validations = new Map<string, GmpPublishingPackageValidation[]>();
  for (const item of seed?.validations ?? []) {
    const bucket = validations.get(item.publishingPackageId) ?? [];
    bucket.push(item);
    validations.set(item.publishingPackageId, bucket);
  }
  const releases = new Map((seed?.releases ?? []).map((entry) => [entry.releaseId, entry]));
  const releaseItems = new Map((seed?.releaseItems ?? []).map((entry) => [entry.releaseItemId, entry]));
  const attempts = new Map<string, GmpPublicationAttempt[]>();
  for (const item of seed?.attempts ?? []) {
    const bucket = attempts.get(item.releaseItemId) ?? [];
    bucket.push(item);
    attempts.set(item.releaseItemId, bucket);
  }
  const records = new Map((seed?.records ?? []).map((entry) => [entry.publicationRecordId, entry]));
  const verifications = new Map<string, GmpPublicationVerification[]>();
  for (const item of seed?.verifications ?? []) {
    const bucket = verifications.get(item.publicationRecordId) ?? [];
    bucket.push(item);
    verifications.set(item.publicationRecordId, bucket);
  }
  const reconciliations = new Map<string, GmpPublicationReconciliation[]>();
  for (const item of seed?.reconciliations ?? []) {
    const bucket = reconciliations.get(item.publicationRecordId) ?? [];
    bucket.push(item);
    reconciliations.set(item.publicationRecordId, bucket);
  }
  const idempotency = new Map((seed?.idempotency ?? []).map((entry) => [entry.publishingIdempotencyRecordId, entry]));

  return {
    async createDestination(input) {
      const timestamp = new Date().toISOString();
      const entry: GmpPublishingDestination = { destinationId: `gmpdest_${randomUUID()}`, createdAt: timestamp, updatedAt: timestamp, ...input };
      destinations.set(entry.destinationId, entry);
      return entry;
    },
    async updateDestination(destinationId, changes) {
      const current = destinations.get(destinationId);
      if (!current) return null;
      const entry = { ...current, ...changes, updatedAt: new Date().toISOString() };
      destinations.set(destinationId, entry);
      return entry;
    },
    async getDestinationById(destinationId) {
      return destinations.get(destinationId) ?? null;
    },
    async listDestinationsForProject(projectId) {
      return [...destinations.values()].filter((entry) => entry.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async createApprovedRevisionSet(input) {
      const entry: GmpApprovedRevisionSet = { approvedRevisionSetId: `gmpars_${randomUUID()}`, createdAt: new Date().toISOString(), ...input };
      approvedSets.set(entry.approvedRevisionSetId, entry);
      return entry;
    },
    async getApprovedRevisionSetById(approvedRevisionSetId) {
      return approvedSets.get(approvedRevisionSetId) ?? null;
    },

    async createPackage(input) {
      const timestamp = new Date().toISOString();
      const entry: GmpPublishingPackage = { publishingPackageId: `gmppkg_${randomUUID()}`, createdAt: timestamp, updatedAt: timestamp, ...input };
      packages.set(entry.publishingPackageId, entry);
      return entry;
    },
    async updatePackage(publishingPackageId, changes) {
      const current = packages.get(publishingPackageId);
      if (!current) return null;
      const entry = { ...current, ...changes, updatedAt: new Date().toISOString() };
      packages.set(publishingPackageId, entry);
      return entry;
    },
    async getPackageById(publishingPackageId) {
      return packages.get(publishingPackageId) ?? null;
    },
    async listPackagesForPage(pageId) {
      return [...packages.values()].filter((entry) => entry.pageId === pageId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async upsertManifest(input) {
      manifests.set(input.packageId, input);
      return input;
    },
    async getManifestByPackageId(publishingPackageId) {
      return manifests.get(publishingPackageId) ?? null;
    },

    async createValidation(input) {
      const entry: GmpPublishingPackageValidation = { packageValidationId: `gmpval_${randomUUID()}`, ...input };
      const bucket = validations.get(input.publishingPackageId) ?? [];
      bucket.push(entry);
      validations.set(input.publishingPackageId, bucket);
      return entry;
    },
    async getLatestValidation(publishingPackageId) {
      const bucket = validations.get(publishingPackageId) ?? [];
      return bucket.sort((a, b) => b.validatedAt.localeCompare(a.validatedAt))[0] ?? null;
    },

    async createRelease(input) {
      const timestamp = new Date().toISOString();
      const entry: GmpRelease = { releaseId: `gmprel_${randomUUID()}`, createdAt: timestamp, updatedAt: timestamp, ...input };
      releases.set(entry.releaseId, entry);
      return entry;
    },
    async updateRelease(releaseId, changes) {
      const current = releases.get(releaseId);
      if (!current) return null;
      const entry = { ...current, ...changes, updatedAt: new Date().toISOString() };
      releases.set(releaseId, entry);
      return entry;
    },
    async getReleaseById(releaseId) {
      return releases.get(releaseId) ?? null;
    },
    async listReleasesForProject(projectId) {
      return [...releases.values()].filter((entry) => entry.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async createReleaseItem(input) {
      const timestamp = new Date().toISOString();
      const entry: GmpReleaseItem = { releaseItemId: `gmpitem_${randomUUID()}`, createdAt: timestamp, updatedAt: timestamp, ...input };
      releaseItems.set(entry.releaseItemId, entry);
      return entry;
    },
    async updateReleaseItem(releaseItemId, changes) {
      const current = releaseItems.get(releaseItemId);
      if (!current) return null;
      const entry = { ...current, ...changes, updatedAt: new Date().toISOString() };
      releaseItems.set(releaseItemId, entry);
      return entry;
    },
    async deleteReleaseItem(releaseItemId) {
      releaseItems.delete(releaseItemId);
    },
    async listReleaseItems(releaseId) {
      return [...releaseItems.values()].filter((entry) => entry.releaseId === releaseId).sort((a, b) => a.sequence - b.sequence);
    },

    async createPublicationAttempt(input) {
      const entry: GmpPublicationAttempt = { publicationAttemptId: `gmpatt_${randomUUID()}`, ...input };
      const bucket = attempts.get(input.releaseItemId) ?? [];
      bucket.push(entry);
      attempts.set(input.releaseItemId, bucket);
      return entry;
    },
    async listPublicationAttemptsForReleaseItem(releaseItemId) {
      return (attempts.get(releaseItemId) ?? []).sort((a, b) => b.attemptNumber - a.attemptNumber);
    },
    async listPublicationAttemptsForDestination(destinationId, limit = 10) {
      const flattened = [...attempts.values()].flat();
      return flattened
        .filter((entry) => entry.destinationId === destinationId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, limit);
    },

    async createPublicationRecord(input) {
      const entry: GmpPublicationRecord = { publicationRecordId: `gmprec_${randomUUID()}`, createdAt: new Date().toISOString(), ...input };
      records.set(entry.publicationRecordId, entry);
      return entry;
    },
    async getPublicationRecordById(publicationRecordId) {
      return records.get(publicationRecordId) ?? null;
    },
    async listPublicationRecordsForProject(projectId, limit = 50) {
      return [...records.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
    async listPublicationRecordsForPage(pageId) {
      return [...records.values()].filter((entry) => entry.pageId === pageId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async listPublicationRecordsForDestination(destinationId, limit = 20) {
      return [...records.values()]
        .filter((entry) => entry.destinationId === destinationId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async createVerification(input) {
      const entry: GmpPublicationVerification = { publicationVerificationId: `gmpver_${randomUUID()}`, ...input };
      const bucket = verifications.get(input.publicationRecordId) ?? [];
      bucket.push(entry);
      verifications.set(input.publicationRecordId, bucket);
      return entry;
    },
    async getLatestVerification(publicationRecordId) {
      const bucket = verifications.get(publicationRecordId) ?? [];
      return bucket.sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))[0] ?? null;
    },

    async createReconciliation(input) {
      const entry: GmpPublicationReconciliation = { publicationReconciliationId: `gmprecon_${randomUUID()}`, ...input };
      const bucket = reconciliations.get(input.publicationRecordId) ?? [];
      bucket.push(entry);
      reconciliations.set(input.publicationRecordId, bucket);
      return entry;
    },
    async getLatestReconciliation(publicationRecordId) {
      const bucket = reconciliations.get(publicationRecordId) ?? [];
      return bucket.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))[0] ?? null;
    },

    async upsertIdempotencyRecord(input) {
      const existing = [...idempotency.values()].find((entry) =>
        entry.destinationId === input.destinationId
        && entry.publishingPackageId === input.publishingPackageId
        && entry.packageVersion === input.packageVersion
        && entry.operationType === input.operationType
        && entry.releaseItemId === input.releaseItemId
        && entry.requestFingerprint === input.requestFingerprint,
      );
      if (existing) {
        const updated: GmpPublishingIdempotencyRecord = { ...existing, ...input, updatedAt: new Date().toISOString() };
        idempotency.set(existing.publishingIdempotencyRecordId, updated);
        return updated;
      }
      const timestamp = new Date().toISOString();
      const entry: GmpPublishingIdempotencyRecord = {
        publishingIdempotencyRecordId: `gmpidem_${randomUUID()}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...input,
      };
      idempotency.set(entry.publishingIdempotencyRecordId, entry);
      return entry;
    },
    async getIdempotencyRecordByRequest(input) {
      return [...idempotency.values()].find((entry) =>
        entry.destinationId === input.destinationId
        && entry.publishingPackageId === input.publishingPackageId
        && entry.packageVersion === input.packageVersion
        && entry.operationType === input.operationType
        && entry.releaseItemId === input.releaseItemId
        && entry.requestFingerprint === input.requestFingerprint,
      ) ?? null;
    },
  };
}

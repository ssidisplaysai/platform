import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import {
  enterpriseId,
  type EnterpriseAuditLineageRecord,
  type EnterpriseDomainCatalog,
  type EnterpriseEntityDefinition,
  type EnterpriseEntityKey,
  type EnterpriseEntityVersionRecord,
  type EnterpriseHealthSnapshot,
  type EnterpriseRelationshipDefinition,
  type EnterpriseRelationshipKey,
  type EnterpriseValidationResult,
  buildEnterpriseCatalog,
} from "./enterprise-domain-models";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapEntityDefinition(row: any): EnterpriseEntityDefinition {
  return {
    enterpriseEntityId: row.enterpriseEntityId,
    entityKey: row.entityKey,
    entityCode: row.entityCode,
    displayName: row.displayName,
    pluralName: row.pluralName,
    description: row.description,
    stewardshipArea: row.stewardshipArea,
    lifecyclePreset: row.lifecyclePreset,
    lifecycle: row.lifecycle as EnterpriseEntityDefinition["lifecycle"],
    authorizationBoundary: row.authorizationBoundary,
    consumerAgents: row.consumerAgents,
    relationshipKeys: row.relationshipKeys,
    version: row.version,
    checksum: row.checksum,
    immutableLineage: row.immutableLineage,
  };
}

function mapRelationshipDefinition(row: any): EnterpriseRelationshipDefinition {
  return {
    enterpriseRelationshipId: row.enterpriseRelationshipId,
    relationshipKey: row.relationshipKey,
    sourceEntityKey: row.sourceEntityKey,
    targetEntityKey: row.targetEntityKey,
    relationshipType: row.relationshipType,
    cardinality: row.cardinality,
    description: row.description,
    authorizationBoundary: row.authorizationBoundary,
    version: row.version,
    checksum: row.checksum,
    immutableLineage: row.immutableLineage,
  };
}

function mapVersionRecord(row: any): EnterpriseEntityVersionRecord {
  return {
    enterpriseEntityVersionId: row.enterpriseEntityVersionId,
    entityKey: row.entityKey,
    version: row.version,
    checksum: row.checksum,
    definitionSnapshot: row.definitionSnapshot as EnterpriseEntityDefinition,
    createdAt: row.createdAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapValidation(row: any): EnterpriseValidationResult {
  return {
    enterpriseValidationId: row.enterpriseValidationId,
    scope: row.scope,
    status: row.status,
    summary: row.summary,
    issues: row.issues ?? [],
    createdAt: row.createdAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapHealth(row: any): EnterpriseHealthSnapshot {
  return {
    enterpriseHealthId: row.enterpriseHealthId,
    status: row.status,
    totalEntities: row.totalEntities,
    totalRelationships: row.totalRelationships,
    validationIssueCount: row.validationIssueCount,
    duplicateOwnershipCount: row.duplicateOwnershipCount,
    generatedAt: row.generatedAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapAudit(row: any): EnterpriseAuditLineageRecord {
  return {
    enterpriseAuditLineageId: row.enterpriseAuditLineageId,
    entityKey: row.entityKey,
    actorId: row.actorId,
    eventType: row.eventType,
    summary: row.summary,
    relatedEntityKeys: row.relatedEntityKeys ?? [],
    occurredAt: row.occurredAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

export type EnterpriseDomainRepository = {
  upsertEntityDefinition: (definition: EnterpriseEntityDefinition) => Promise<EnterpriseEntityDefinition>;
  upsertRelationshipDefinition: (relationship: EnterpriseRelationshipDefinition) => Promise<EnterpriseRelationshipDefinition>;
  upsertEntityVersion: (version: EnterpriseEntityVersionRecord) => Promise<EnterpriseEntityVersionRecord>;
  upsertValidationResult: (validation: EnterpriseValidationResult) => Promise<EnterpriseValidationResult>;
  upsertHealthSnapshot: (snapshot: EnterpriseHealthSnapshot) => Promise<EnterpriseHealthSnapshot>;
  upsertAuditLineage: (record: EnterpriseAuditLineageRecord) => Promise<EnterpriseAuditLineageRecord>;
  listEntityDefinitions: () => Promise<EnterpriseEntityDefinition[]>;
  getEntityDefinition: (entityKey: EnterpriseEntityKey) => Promise<EnterpriseEntityDefinition | null>;
  listRelationshipDefinitions: (entityKey?: EnterpriseEntityKey) => Promise<EnterpriseRelationshipDefinition[]>;
  listEntityVersions: (entityKey?: EnterpriseEntityKey) => Promise<EnterpriseEntityVersionRecord[]>;
  listValidationResults: () => Promise<EnterpriseValidationResult[]>;
  listHealthSnapshots: () => Promise<EnterpriseHealthSnapshot[]>;
  listAuditLineage: (entityKey?: EnterpriseEntityKey) => Promise<EnterpriseAuditLineageRecord[]>;
};

export function createPrismaEnterpriseDomainRepository(prisma: PrismaClient = getPrismaClient()): EnterpriseDomainRepository {
  return {
    async upsertEntityDefinition(definition) {
      return mapEntityDefinition(await prisma.gedEntityDefinition.upsert({
        where: { entityKey: definition.entityKey },
        update: {
          entityCode: definition.entityCode,
          displayName: definition.displayName,
          pluralName: definition.pluralName,
          description: definition.description,
          stewardshipArea: definition.stewardshipArea,
          lifecyclePreset: definition.lifecyclePreset,
          lifecycle: toJsonValue(definition.lifecycle),
          authorizationBoundary: definition.authorizationBoundary,
          consumerAgents: toJsonValue(definition.consumerAgents),
          relationshipKeys: toJsonValue(definition.relationshipKeys),
          version: definition.version,
          checksum: definition.checksum,
          immutableLineage: definition.immutableLineage,
        },
        create: {
          enterpriseEntityId: definition.enterpriseEntityId,
          entityKey: definition.entityKey,
          entityCode: definition.entityCode,
          displayName: definition.displayName,
          pluralName: definition.pluralName,
          description: definition.description,
          stewardshipArea: definition.stewardshipArea,
          lifecyclePreset: definition.lifecyclePreset,
          lifecycle: toJsonValue(definition.lifecycle),
          authorizationBoundary: definition.authorizationBoundary,
          consumerAgents: toJsonValue(definition.consumerAgents),
          relationshipKeys: toJsonValue(definition.relationshipKeys),
          version: definition.version,
          checksum: definition.checksum,
          immutableLineage: definition.immutableLineage,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      }));
    },
    async upsertRelationshipDefinition(relationship) {
      return mapRelationshipDefinition(await prisma.gedRelationshipDefinition.upsert({
        where: { relationshipKey: relationship.relationshipKey },
        update: {
          sourceEntityKey: relationship.sourceEntityKey,
          targetEntityKey: relationship.targetEntityKey,
          relationshipType: relationship.relationshipType,
          cardinality: relationship.cardinality,
          description: relationship.description,
          authorizationBoundary: relationship.authorizationBoundary,
          version: relationship.version,
          checksum: relationship.checksum,
          immutableLineage: relationship.immutableLineage,
        },
        create: {
          enterpriseRelationshipId: relationship.enterpriseRelationshipId,
          relationshipKey: relationship.relationshipKey,
          sourceEntityKey: relationship.sourceEntityKey,
          targetEntityKey: relationship.targetEntityKey,
          relationshipType: relationship.relationshipType,
          cardinality: relationship.cardinality,
          description: relationship.description,
          authorizationBoundary: relationship.authorizationBoundary,
          version: relationship.version,
          checksum: relationship.checksum,
          immutableLineage: relationship.immutableLineage,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      }));
    },
    async upsertEntityVersion(version) {
      return mapVersionRecord(await prisma.gedEntityVersion.upsert({
        where: { enterpriseEntityVersionId: version.enterpriseEntityVersionId },
        update: {
          entityKey: version.entityKey,
          version: version.version,
          checksum: version.checksum,
          definitionSnapshot: toJsonValue(version.definitionSnapshot),
          immutableLineage: version.immutableLineage,
        },
        create: {
          enterpriseEntityVersionId: version.enterpriseEntityVersionId,
          entityKey: version.entityKey,
          version: version.version,
          checksum: version.checksum,
          definitionSnapshot: toJsonValue(version.definitionSnapshot),
          createdAt: new Date(version.createdAt),
          immutableLineage: version.immutableLineage,
        },
      }));
    },
    async upsertValidationResult(validation) {
      return mapValidation(await prisma.gedValidationResult.upsert({
        where: { enterpriseValidationId: validation.enterpriseValidationId },
        update: {
          scope: validation.scope,
          status: validation.status,
          summary: validation.summary,
          issues: toJsonValue(validation.issues),
          immutableLineage: validation.immutableLineage,
        },
        create: {
          enterpriseValidationId: validation.enterpriseValidationId,
          scope: validation.scope,
          status: validation.status,
          summary: validation.summary,
          issues: toJsonValue(validation.issues),
          createdAt: new Date(validation.createdAt),
          immutableLineage: validation.immutableLineage,
        },
      }));
    },
    async upsertHealthSnapshot(snapshot) {
      return mapHealth(await prisma.gedHealthSnapshot.upsert({
        where: { enterpriseHealthId: snapshot.enterpriseHealthId },
        update: {
          status: snapshot.status,
          totalEntities: snapshot.totalEntities,
          totalRelationships: snapshot.totalRelationships,
          validationIssueCount: snapshot.validationIssueCount,
          duplicateOwnershipCount: snapshot.duplicateOwnershipCount,
          immutableLineage: snapshot.immutableLineage,
        },
        create: {
          enterpriseHealthId: snapshot.enterpriseHealthId,
          status: snapshot.status,
          totalEntities: snapshot.totalEntities,
          totalRelationships: snapshot.totalRelationships,
          validationIssueCount: snapshot.validationIssueCount,
          duplicateOwnershipCount: snapshot.duplicateOwnershipCount,
          generatedAt: new Date(snapshot.generatedAt),
          immutableLineage: snapshot.immutableLineage,
        },
      }));
    },
    async upsertAuditLineage(record) {
      return mapAudit(await prisma.gedAuditLineage.upsert({
        where: { enterpriseAuditLineageId: record.enterpriseAuditLineageId },
        update: {
          entityKey: record.entityKey,
          actorId: record.actorId,
          eventType: record.eventType,
          summary: record.summary,
          relatedEntityKeys: toJsonValue(record.relatedEntityKeys),
          immutableLineage: record.immutableLineage,
        },
        create: {
          enterpriseAuditLineageId: record.enterpriseAuditLineageId,
          entityKey: record.entityKey,
          actorId: record.actorId,
          eventType: record.eventType,
          summary: record.summary,
          relatedEntityKeys: toJsonValue(record.relatedEntityKeys),
          occurredAt: new Date(record.occurredAt),
          immutableLineage: record.immutableLineage,
        },
      }));
    },
    async listEntityDefinitions() {
      return (await prisma.gedEntityDefinition.findMany({ orderBy: { entityKey: "asc" } })).map(mapEntityDefinition);
    },
    async getEntityDefinition(entityKey) {
      const row = await prisma.gedEntityDefinition.findUnique({ where: { entityKey } });
      return row ? mapEntityDefinition(row) : null;
    },
    async listRelationshipDefinitions(entityKey) {
      return (await prisma.gedRelationshipDefinition.findMany({
        where: entityKey ? { OR: [{ sourceEntityKey: entityKey }, { targetEntityKey: entityKey }] } : undefined,
        orderBy: { relationshipKey: "asc" },
      })).map(mapRelationshipDefinition);
    },
    async listEntityVersions(entityKey) {
      return (await prisma.gedEntityVersion.findMany({
        where: entityKey ? { entityKey } : undefined,
        orderBy: [{ entityKey: "asc" }, { createdAt: "asc" }],
      })).map(mapVersionRecord);
    },
    async listValidationResults() {
      return (await prisma.gedValidationResult.findMany({ orderBy: { createdAt: "desc" } })).map(mapValidation);
    },
    async listHealthSnapshots() {
      return (await prisma.gedHealthSnapshot.findMany({ orderBy: { generatedAt: "desc" } })).map(mapHealth);
    },
    async listAuditLineage(entityKey) {
      return (await prisma.gedAuditLineage.findMany({
        where: entityKey ? { entityKey } : undefined,
        orderBy: { occurredAt: "desc" },
      })).map(mapAudit);
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createInMemoryEnterpriseDomainRepository(): EnterpriseDomainRepository {
  const seed = buildEnterpriseCatalog();
  const entityDefinitions = new Map<EnterpriseEntityKey, EnterpriseEntityDefinition>(seed.entities.map((entry) => [entry.entityKey, clone(entry)]));
  const relationshipDefinitions = new Map(seed.relationships.map((entry) => [entry.relationshipKey, clone(entry)]));
  const entityVersions = new Map(seed.versions.map((entry) => [entry.enterpriseEntityVersionId, clone(entry)]));
  const validationResults = new Map([[seed.validation.enterpriseValidationId, clone(seed.validation)]]);
  const healthSnapshots = new Map([[seed.health.enterpriseHealthId, clone(seed.health)]]);
  const auditLineage = new Map(seed.auditLineage.map((entry) => [entry.enterpriseAuditLineageId, clone(entry)]));

  return {
    async upsertEntityDefinition(definition) {
      entityDefinitions.set(definition.entityKey, clone(definition));
      return clone(definition);
    },
    async upsertRelationshipDefinition(relationship) {
      relationshipDefinitions.set(relationship.relationshipKey, clone(relationship));
      return clone(relationship);
    },
    async upsertEntityVersion(version) {
      entityVersions.set(version.enterpriseEntityVersionId, clone(version));
      return clone(version);
    },
    async upsertValidationResult(validation) {
      validationResults.set(validation.enterpriseValidationId, clone(validation));
      return clone(validation);
    },
    async upsertHealthSnapshot(snapshot) {
      healthSnapshots.set(snapshot.enterpriseHealthId, clone(snapshot));
      return clone(snapshot);
    },
    async upsertAuditLineage(record) {
      auditLineage.set(record.enterpriseAuditLineageId, clone(record));
      return clone(record);
    },
    async listEntityDefinitions() {
      return [...entityDefinitions.values()].sort((left, right) => left.entityKey.localeCompare(right.entityKey)).map(clone);
    },
    async getEntityDefinition(entityKey) {
      return clone(entityDefinitions.get(entityKey) ?? null);
    },
    async listRelationshipDefinitions(entityKey) {
      return [...relationshipDefinitions.values()].filter((entry) => !entityKey || entry.sourceEntityKey === entityKey || entry.targetEntityKey === entityKey).sort((left, right) => left.relationshipKey.localeCompare(right.relationshipKey)).map(clone);
    },
    async listEntityVersions(entityKey) {
      return [...entityVersions.values()].filter((entry) => !entityKey || entry.entityKey === entityKey).sort((left, right) => left.entityKey.localeCompare(right.entityKey) || left.createdAt.localeCompare(right.createdAt)).map(clone);
    },
    async listValidationResults() {
      return [...validationResults.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(clone);
    },
    async listHealthSnapshots() {
      return [...healthSnapshots.values()].sort((left, right) => right.generatedAt.localeCompare(left.generatedAt)).map(clone);
    },
    async listAuditLineage(entityKey) {
      return [...auditLineage.values()].filter((entry) => !entityKey || entry.entityKey === entityKey).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).map(clone);
    },
  };
}

import {
  buildEnterpriseCatalog,
  createEnterpriseHealthSnapshot,
  type EnterpriseDomainCatalog,
  type EnterpriseEntityDefinition,
  type EnterpriseEntityKey,
  type EnterpriseHealthSnapshot,
  type EnterpriseRelationshipDefinition,
  type EnterpriseRelationshipKey,
  type EnterpriseValidationResult,
  type EnterpriseAuditLineageRecord,
} from "./enterprise-domain-models";
import type { EnterpriseDomainRepository } from "./enterprise-domain-repository";

async function seedCatalog(repository: EnterpriseDomainRepository, catalog: EnterpriseDomainCatalog): Promise<void> {
  for (const entity of catalog.entities) {
    await repository.upsertEntityDefinition(entity);
  }

  for (const relationship of catalog.relationships) {
    await repository.upsertRelationshipDefinition(relationship);
  }

  for (const version of catalog.versions) {
    await repository.upsertEntityVersion(version);
  }

  await repository.upsertValidationResult(catalog.validation);
  await repository.upsertHealthSnapshot(catalog.health);

  for (const lineage of catalog.auditLineage) {
    await repository.upsertAuditLineage(lineage);
  }
}

export type EnterpriseDomainRuntimeService = {
  listEntities: () => Promise<EnterpriseEntityDefinition[]>;
  getEntity: (entityKey: EnterpriseEntityKey) => Promise<EnterpriseEntityDefinition | null>;
  listRelationships: (entityKey?: EnterpriseEntityKey) => Promise<EnterpriseRelationshipDefinition[]>;
  listVersionHistory: (entityKey?: EnterpriseEntityKey) => ReturnType<EnterpriseDomainRepository["listEntityVersions"]>;
  validateDomain: () => Promise<EnterpriseValidationResult>;
  listHealth: () => Promise<EnterpriseHealthSnapshot>;
  listAuditLineage: (entityKey?: EnterpriseEntityKey) => Promise<EnterpriseAuditLineageRecord[]>;
  buildCatalog: () => EnterpriseDomainCatalog;
};

export function createEnterpriseDomainRuntimeService(repository: EnterpriseDomainRepository): EnterpriseDomainRuntimeService {
  const catalog = buildEnterpriseCatalog();

  return {
    async listEntities() {
      await seedCatalog(repository, catalog);
      return repository.listEntityDefinitions();
    },
    async getEntity(entityKey) {
      await seedCatalog(repository, catalog);
      return repository.getEntityDefinition(entityKey);
    },
    async listRelationships(entityKey) {
      await seedCatalog(repository, catalog);
      return repository.listRelationshipDefinitions(entityKey);
    },
    async listVersionHistory(entityKey) {
      await seedCatalog(repository, catalog);
      return repository.listEntityVersions(entityKey);
    },
    async validateDomain() {
      await seedCatalog(repository, catalog);
      return repository.upsertValidationResult(catalog.validation);
    },
    async listHealth() {
      await seedCatalog(repository, catalog);
      const validation = await repository.upsertValidationResult(catalog.validation);
      const entities = await repository.listEntityDefinitions();
      const relationships = await repository.listRelationshipDefinitions();
      const health = createEnterpriseHealthSnapshot(entities, relationships, validation);
      return repository.upsertHealthSnapshot(health);
    },
    async listAuditLineage(entityKey) {
      await seedCatalog(repository, catalog);
      return repository.listAuditLineage(entityKey);
    },
    buildCatalog() {
      return catalog;
    },
  };
}

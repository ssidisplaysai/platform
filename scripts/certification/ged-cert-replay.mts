import { buildEnterpriseCatalog, enterpriseId, stableEnterpriseChecksum } from "../../src/lib/ged/enterprise-domain-models";

function main() {
  const first = buildEnterpriseCatalog();
  const second = buildEnterpriseCatalog();

  const firstEntityIds = first.entities.map((entry) => entry.enterpriseEntityId);
  const secondEntityIds = second.entities.map((entry) => entry.enterpriseEntityId);
  const firstRelationshipIds = first.relationships.map((entry) => entry.enterpriseRelationshipId);
  const secondRelationshipIds = second.relationships.map((entry) => entry.enterpriseRelationshipId);

  const duplicateEntityKeys = first.entities.length - new Set(first.entities.map((entry) => entry.entityKey)).size;
  const duplicateEntityCodes = first.entities.length - new Set(first.entities.map((entry) => entry.entityCode)).size;
  const duplicateRelationshipKeys = first.relationships.length - new Set(first.relationships.map((entry) => entry.relationshipKey)).size;

  const checksumProbe = stableEnterpriseChecksum({ probe: "ged-certification" });
  const deterministicIdProbe = enterpriseId("ged-probe", { probe: "ged-certification" });

  console.log(JSON.stringify({
    replayDeterministic: JSON.stringify(first) === JSON.stringify(second),
    identityDeterministic: JSON.stringify(firstEntityIds) === JSON.stringify(secondEntityIds) && JSON.stringify(firstRelationshipIds) === JSON.stringify(secondRelationshipIds),
    validationDeterministic: JSON.stringify(first.validation) === JSON.stringify(second.validation),
    relationshipGraphDeterministic: JSON.stringify(first.relationships) === JSON.stringify(second.relationships),
    duplicateEntityKeys,
    duplicateEntityCodes,
    duplicateRelationshipKeys,
    checksumProbe,
    deterministicIdProbe,
    entityCount: first.entities.length,
    relationshipCount: first.relationships.length,
    validationStatus: first.validation.status,
    healthStatus: first.health.status,
  }, null, 2));
}

main();

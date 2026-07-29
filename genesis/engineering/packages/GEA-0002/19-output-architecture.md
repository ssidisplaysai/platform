# 19 Output Architecture

## Output Contract Fields
Each output contract explicitly defines:
1. outputId
2. fileName
3. purpose
4. constitutionalOwner
5. architecturalOwner
6. schemaOwner
7. producingCompilerStage
8. consumingCapability
9. schemaVersion
10. outputFormatVersion
11. compatibilityPolicy
12. requiredTopLevelFields
13. canonicalIdentifierPolicy
14. crossFileIdentityPolicy
15. orderingPolicy
16. hashingPolicy
17. provenanceRequirements
18. partialOutputPermissibility
19. emptyOutputBehavior
20. invalidOutputBehavior
21. failureBehavior
22. diagnosticLinkage
23. validationGate
24. certificationRelevance
25. freezeRelevance
26. retentionPolicy
27. supersessionPolicy

## Per-Output Governance Contracts

Owner and version defaults used by all outputs unless explicitly overridden:
1. constitutionalOwner: Genesis Constitutional Governance Authority.
2. architecturalOwner: Genesis Enterprise Architecture Authority.
3. schemaOwner: Atlas Compiler Schema Governance Authority.
4. schemaVersion: semantic versioned per output.
5. outputFormatVersion: semantic versioned per output payload.

Per-output owner and version assignments:
1. OUT-001 atlas-manifest.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Enterprise Architecture Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
2. OUT-002 entities.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Capability Architecture Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
3. OUT-003 relationships.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Enterprise Architecture Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
4. OUT-004 ownership-registry.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Ownership Governance Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
5. OUT-005 dependency-graph.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Runtime and Capability Dependency Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
6. OUT-006 lifecycle-graph.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Lifecycle Governance Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
7. OUT-007 validation-graph.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Validation Governance Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
8. OUT-008 certification-graph.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Certification Governance Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
9. OUT-009 traceability-graph.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Traceability Governance Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
10. OUT-010 navigation-index.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Navigation Architecture Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
11. OUT-011 query-index.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Query Architecture Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
12. OUT-012 impact-index.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Impact Governance Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
13. OUT-013 diagnostics.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Diagnostics Governance Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
14. OUT-014 compiler-metrics.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Metrics Governance Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.
15. OUT-015 repository-impact.json: constitutionalOwner=Genesis Constitutional Governance Authority, architecturalOwner=Genesis Repository Impact Governance Authority, schemaOwner=Atlas Compiler Schema Governance Authority, schemaVersion=1.x, outputFormatVersion=1.x.

OUT-001 atlas-manifest.json:
1. Stage: ATLAS_GENERATION.
2. Consumer: all compiler and governance stages.
3. Required fields: atlasId, graphVersion, outputSet, schemaSet, hashSet, generationMode.
4. Canonical ID policy: atlasId stable by normalized input set hash.
5. Partial: not permitted for authoritative publication.
6. Empty: invalid.
7. Invalid behavior: fail closed.
8. Gate: output contract completeness.
9. Certification/freeze: required.
10. Retention/supersession: retained as release lineage manifest.

OUT-002 entities.json:
1. Stage: EXTRACTION plus GRAPH_CONSTRUCTION.
2. Consumer: query, navigation, impact, validation.
3. Required fields: entities array, entitySchemaVersion, identityIndex.
4. Canonical ID policy: global uniqueness per graph version.
5. Partial: allowed only for diagnostic runs.
6. Empty: allowed only when discovery yields no admissible sources; must emit diagnostic.
7. Invalid behavior: fail closed for certification and freeze scopes.
8. Gate: entity completeness.
9. Certification/freeze: required.
10. Retention/supersession: version lineage retained.

OUT-003 relationships.json:
1. Stage: GRAPH_CONSTRUCTION.
2. Consumer: query, impact, validation.
3. Required fields: relationships array, relationshipSchemaVersion, relationshipIndex.
4. Canonical ID policy: relationshipId uniqueness and deterministic derivation.
5. Partial: diagnostic mode only.
6. Empty: permitted only if no relationships admissible and diagnostics justify.
7. Invalid behavior: blocks authoritative query publication.
8. Gate: relationship completeness.
9. Certification/freeze: required.
10. Retention/supersession: historical relationship snapshots retained.

OUT-004 ownership-registry.json:
1. Stage: EXTRACTION and OWNERSHIP_RESOLUTION.
2. Consumer: validation, certification, freeze assessment.
3. Required fields: ownershipRecords, unresolvedOwnership, ownershipPolicyVersion.
4. Canonical ID policy: one accountable owner per governed entity unless explicit policy exception.
5. Partial: allowed only with explicit unresolvedOwnership section.
6. Empty: invalid.
7. Invalid behavior: blocks certification and freeze.
8. Gate: ownership completeness.
9. Certification/freeze: required.
10. Retention/supersession: ownership history retained by version.

OUT-005 dependency-graph.json:
1. Stage: GRAPH_CONSTRUCTION.
2. Consumer: impact and drift detection.
3. Required fields: directEdges, transitiveEdges, cycleSet.
4. Canonical ID policy: dependency edge identity stable by source, target, type.
5. Partial: allowed with explicit degraded classification.
6. Empty: invalid for non-empty Atlas.
7. Invalid behavior: blocks impact completeness.
8. Gate: dependency integrity.
9. Certification/freeze: required for impact-sensitive scope.
10. Retention/supersession: lineage retained.

OUT-006 lifecycle-graph.json:
1. Stage: GRAPH_CONSTRUCTION.
2. Consumer: validation, certification, release.
3. Required fields: lifecycleNodes, lifecycleTransitions, supersessionMap.
4. Canonical ID policy: lifecycle record linked to governed canonicalId.
5. Partial: allowed with PARTIAL status.
6. Empty: invalid.
7. Invalid behavior: blocks lifecycle integrity.
8. Gate: lifecycle integrity.
9. Certification/freeze: required.
10. Retention/supersession: immutable transition history.

OUT-007 validation-graph.json:
1. Stage: ATLAS_VALIDATION.
2. Consumer: certification and freeze review.
3. Required fields: validationRules, validationResults, blockingOutcomes.
4. Canonical ID policy: ruleId and resultId stable.
5. Partial: allowed for in-progress diagnostic runs only.
6. Empty: invalid.
7. Invalid behavior: blocks certification/freeze.
8. Gate: validation integrity.
9. Certification/freeze: required.
10. Retention/supersession: validation snapshots retained.

OUT-008 certification-graph.json:
1. Stage: ATLAS_CERTIFICATION.
2. Consumer: freeze and release governance.
3. Required fields: certificationRules, certificationRecords, certifyingAuthority.
4. Canonical ID policy: certification record IDs stable.
5. Partial: not permitted for certification conclusion.
6. Empty: invalid when certification scope requested.
7. Invalid behavior: blocks certification and freeze.
8. Gate: certification integrity.
9. Certification/freeze: required.
10. Retention/supersession: certification lineage retained.

OUT-009 traceability-graph.json:
1. Stage: GRAPH_CONSTRUCTION and ATLAS_VALIDATION.
2. Consumer: query, audit, drift.
3. Required fields: nodeProvenance, edgeProvenance, lineagePaths.
4. Canonical ID policy: provenance links keyed by canonical node/edge IDs.
5. Partial: allowed with explicit traceability gap diagnostics.
6. Empty: invalid for generated Atlas outputs.
7. Invalid behavior: blocks authoritative publication.
8. Gate: traceability completeness.
9. Certification/freeze: required.
10. Retention/supersession: provenance snapshots retained.

OUT-010 navigation-index.json:
1. Stage: ATLAS_GENERATION.
2. Consumer: navigation capabilities.
3. Required fields: dimensions, indexEntries, orderingMetadata.
4. Canonical ID policy: indexEntryId stable by node and dimension.
5. Partial: allowed with affected dimensions flagged.
6. Empty: invalid for non-empty Atlas.
7. Invalid behavior: blocks navigation completeness.
8. Gate: navigation completeness.
9. Certification/freeze: required for navigation-dependent publication.
10. Retention/supersession: index versions retained.

OUT-011 query-index.json:
1. Stage: ATLAS_GENERATION.
2. Consumer: query publication.
3. Required fields: queryContracts, queryCoverage, queryStatePolicies.
4. Canonical ID policy: queryId stable and unique.
5. Partial: allowed with blockedFamilies list.
6. Empty: invalid.
7. Invalid behavior: blocks query publication.
8. Gate: query answerability.
9. Certification/freeze: required for query publication.
10. Retention/supersession: contract lineage retained.

OUT-012 impact-index.json:
1. Stage: ATLAS_GENERATION.
2. Consumer: impact analysis capabilities.
3. Required fields: impactNodes, impactEdges, propagationRulesApplied.
4. Canonical ID policy: impact record IDs deterministic.
5. Partial: allowed with explicit unknown impact segments.
6. Empty: invalid for non-empty dependency scope.
7. Invalid behavior: blocks impact-analysis completeness.
8. Gate: impact-analysis completeness.
9. Certification/freeze: required for change governance.
10. Retention/supersession: impact snapshots retained.

OUT-013 diagnostics.json:
1. Stage: all stages.
2. Consumer: operators, reviewers, governance.
3. Required fields: diagnostics, orderingMetadata, dedupPolicy, runScope.
4. Canonical ID policy: diagnosticIdentityKey deterministic.
5. Partial: always allowed.
6. Empty: permitted only if no diagnostics were produced.
7. Invalid behavior: warning in non-critical runs, error in certification/freeze runs.
8. Gate: diagnostic ordering completeness.
9. Certification/freeze: required supporting artifact.
10. Retention/supersession: retained for audit lineage.

OUT-014 compiler-metrics.json:
1. Stage: all stages.
2. Consumer: governance and quality monitoring.
3. Required fields: counts, stageMetrics, validationSummary, driftSummary.
4. Canonical ID policy: metrics snapshot ID tied to atlas-manifest ID.
5. Partial: allowed when blocked runs occur, must indicate stage cutpoint.
6. Empty: invalid.
7. Invalid behavior: warning for development, error for certification/freeze.
8. Gate: repository-impact and validation synchronization checks.
9. Certification/freeze: required supporting artifact.
10. Retention/supersession: trend lineage retained.

OUT-015 repository-impact.json:
1. Stage: ATLAS_VALIDATION and release preparation.
2. Consumer: governance and release controls.
3. Required fields: added, modified, deleted, runtimeImpact, releaseImpact.
4. Canonical ID policy: paths normalized and deduplicated.
5. Partial: not permitted for freeze scope.
6. Empty: invalid for any run with file effects.
7. Invalid behavior: blocks freeze decisioning.
8. Gate: repository-impact integrity.
9. Certification/freeze: required.
10. Retention/supersession: retained with release records.

## Human-Readable Output Definitions
1. Executive summary.
2. Domain coverage report.
3. Ownership gaps report.
4. Relationship gaps report.
5. Traceability gaps report.
6. Constitutional drift report.
7. Boundary violations report.
8. Validation results report.
9. Certification readiness report.
10. Freeze readiness report.

## Emission Policy Matrix
1. Must always be emitted in normal runs: atlas-manifest.json, entities.json, relationships.json, diagnostics.json, compiler-metrics.json.
2. May be emitted partially with degraded classification: entities.json, relationships.json, dependency-graph.json, lifecycle-graph.json, traceability-graph.json, navigation-index.json, query-index.json, impact-index.json, compiler-metrics.json.
3. Must not be emitted as authoritative outputs after FATAL failure: atlas-manifest.json, entities.json, relationships.json, ownership-registry.json, validation-graph.json, certification-graph.json.
4. May be emitted in diagnostic-only runs: diagnostics.json, compiler-metrics.json, repository-impact.json.
5. Required for validation: entities.json, relationships.json, ownership-registry.json, dependency-graph.json, lifecycle-graph.json, validation-graph.json, traceability-graph.json, diagnostics.json, compiler-metrics.json, repository-impact.json.
6. Required for certification: atlas-manifest.json, entities.json, relationships.json, ownership-registry.json, validation-graph.json, certification-graph.json, traceability-graph.json, diagnostics.json.
7. Required for freeze: atlas-manifest.json, validation-graph.json, certification-graph.json, repository-impact.json, diagnostics.json.
8. Publishable to applications: navigation-index.json, query-index.json, impact-index.json, and filtered entities/relationships projections when policy permits.
9. Internal-only compiler outputs: diagnostics.json raw form, compiler-metrics.json internal dimensions, repository-impact.json pre-publication form.

## Schema Governance
1. Semantic versioning policy applies to each schemaVersion.
2. Backward-compatible changes increment minor version.
3. Backward-incompatible changes increment major version and require migration plan.
4. Deprecation window is mandatory before removal of previously published fields.
5. Migration requirements must be declared for breaking changes.
6. Consumer compatibility declaration is required for publishable outputs.
7. Schema authority is governed by constitutional and architectural governance.
8. Approval authority is governance-designated architectural review.

## Cross-File Consistency Rules
1. No output may reference entity identifiers absent from authoritative identity index unless represented as UNKNOWN with diagnostic linkage.
2. No output may reference relationship identifiers absent from relationships index unless represented as UNKNOWN with diagnostic linkage.
3. Cross-file canonical IDs shall preserve one-to-one identity semantics across outputs.
4. Hashing and ordering policies shall be consistent with determinism model.

## Architecture-Only Constraint
1. This package defines output architecture and required schemas.
2. This package does not generate runtime Atlas outputs.

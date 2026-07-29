# 21 Query Index Model

## Deterministic Query Result States
1. COMPLETE: all required contract fields and traversals resolved.
2. PARTIAL: contract is satisfiable but one or more non-blocking required elements are missing and explicitly listed.
3. UNKNOWN: query is valid but required evidence is insufficient.
4. NOT_FOUND: input identifier does not resolve to an admissible source node.
5. BLOCKED: critical policy, authority, ownership, freshness, or stage rule blocks answer emission.
6. CONFLICTED: deterministic resolution failed due to unresolved equal-precedence conflict.

## Deterministic Output Contract By State
1. COMPLETE: return sorted results with full provenance and classification fields.
2. PARTIAL: return sorted partial result plus missingRequirements array and diagnostics.
3. UNKNOWN: return empty or limited result set with unknownReasons array and diagnostics.
4. NOT_FOUND: return no result nodes, include unresolvedInputId diagnostic.
5. BLOCKED: return no publishable result payload for affected scope, include blockingDiagnostics.
6. CONFLICTED: return no authoritative result for conflicted scope, include conflictSet and tiebreakContext.

## Shared Query Contract Fields
1. queryId
2. queryPurpose
3. requiredInputIdentifierType
4. requiredSourceNodeTypes
5. requiredTargetNodeTypes
6. requiredRelationshipTypes
7. requiredOwnershipFields
8. requiredEvidenceFields
9. requiredAuthorityClassifications
10. requiredLifecycleFields
11. requiredValidationState
12. requiredCertificationState
13. traversalDirection
14. traversalMode
15. versionSelectionBehavior
16. staleEvidenceBehavior
17. unknownDataBehavior
18. deterministicOrdering
19. completeAnswerCondition
20. partialAnswerCondition
21. noAnswerCondition
22. blockingFailureState
23. diagnosticRuleId

## Per-Query Contract Matrix

QRY-001:
1. Purpose: what directly depends on this capability.
2. Input type: Capability canonicalId.
3. Source nodes: Capability.
4. Target nodes: Capability, Package, Application, RuntimeSubsystem.
5. Relationships: Capability->Capability, Program->Capability, Application->PlatformCapability, RuntimeSubsystem->Capability.
6. Ownership fields: accountableOwnerId.
7. Evidence fields: sourceArtifact, sourcePath, sourceSection, authorityClassification.
8. Authority classes: AUTHORITATIVE, DERIVED.
9. Lifecycle fields: lifecycleState.
10. Validation state: required.
11. Certification state: optional.
12. Traversal: outbound, direct only.
13. Version behavior: current release only unless requested.
14. Stale behavior: STALE_BLOCKING on critical dependency edges yields BLOCKED.
15. Unknown behavior: unresolved required edge yields PARTIAL or UNKNOWN.
16. Ordering: targetNodeType, targetNodeId.
17. Complete: all direct required edges resolved.
18. Partial: at least one required direct edge unresolved.
19. No answer: NOT_FOUND when source capability missing.
20. Blocking: constitutional/ownership/freshness critical conflict.
21. Rule: QRY-001-RULE.

QRY-002:
1. Purpose: what transitively depends on this capability.
2. Input type: Capability canonicalId.
3. Source nodes: Capability.
4. Target nodes: all reachable dependency consumers.
5. Relationships: dependency-capable edge set with transitive expansion.
6. Ownership fields: accountableOwnerId.
7. Evidence fields: edge provenance chain.
8. Authority classes: AUTHORITATIVE, DERIVED, POTENTIAL, UNKNOWN.
9. Lifecycle fields: lifecycleState, supersession markers.
10. Validation state: required.
11. Certification state: optional.
12. Traversal: outbound, transitive.
13. Version behavior: current graph with optional version scope parameter.
14. Stale behavior: stale-critical edge truncates authoritative traversal and returns BLOCKED for critical scope.
15. Unknown behavior: unresolved transitive segment classified UNKNOWN.
16. Ordering: hopCount, targetNodeType, targetNodeId.
17. Complete: full transitive closure under selected scope.
18. Partial: closure truncated by non-critical unresolved paths.
19. No answer: NOT_FOUND when source missing.
20. Blocking: cycle or freshness critical blocker without permitted continuation.
21. Rule: QRY-002-RULE.

QRY-003:
1. Purpose: who owns this capability.
2. Input type: Capability canonicalId.
3. Source nodes: Capability.
4. Target nodes: Owner.
5. Relationships: Capability->Owner.
6. Ownership fields: accountableOwnerId, supportingOwnerIds, constitutionalHomeId.
7. Evidence fields: ownershipSource, sourcePath, sourceSection.
8. Authority classes: AUTHORITATIVE preferred, DERIVED fallback.
9. Lifecycle fields: ownership lifecycle.
10. Validation state: ownership validation required.
11. Certification state: required for certification/freeze contexts.
12. Traversal: outbound, direct.
13. Version behavior: current ownership unless version parameter provided.
14. Stale behavior: stale-blocking ownership evidence yields BLOCKED.
15. Unknown behavior: no admissible owner yields UNKNOWN.
16. Ordering: accountable owner first, then supporting owners by canonicalId.
17. Complete: single accountable owner resolved.
18. Partial: accountable owner resolved but supporting context incomplete.
19. No answer: NOT_FOUND if capability missing.
20. Blocking: conflicting accountable owners unresolved.
21. Rule: QRY-003-RULE.

QRY-004:
1. Purpose: which package defines this capability.
2. Input type: Capability canonicalId.
3. Source nodes: Capability.
4. Target nodes: Package.
5. Relationships: Capability->Package.
6. Ownership fields: package accountableOwnerId.
7. Evidence fields: package manifest reference.
8. Authority classes: AUTHORITATIVE, DERIVED.
9. Lifecycle fields: package lifecycleState.
10. Validation state: package identity validation required.
11. Certification state: optional.
12. Traversal: outbound, direct.
13. Version behavior: current preferred, superseded optional.
14. Stale behavior: stale-blocking package definition evidence blocks COMPLETE.
15. Unknown behavior: unresolved package mapping yields UNKNOWN.
16. Ordering: package lifecycle priority then packageId.
17. Complete: one or policy-valid definitive package mapping.
18. Partial: candidate set unresolved non-critical.
19. No answer: NOT_FOUND if capability missing.
20. Blocking: conflicting authoritative package definitions.
21. Rule: QRY-004-RULE.

QRY-005:
1. Purpose: which artifacts support this package.
2. Input type: Package canonicalId.
3. Source nodes: Package.
4. Target nodes: Artifact.
5. Relationships: Package->Artifact, Artifact->Package.
6. Ownership fields: package and artifact owner context.
7. Evidence fields: artifact path and manifest linkage.
8. Authority classes: AUTHORITATIVE, DERIVED.
9. Lifecycle fields: artifact lifecycleState.
10. Validation state: artifact integrity required.
11. Certification state: optional.
12. Traversal: outbound and inverse integrity check.
13. Version behavior: current package version with optional lineage.
14. Stale behavior: stale artifact support allowed only as lineage unless policy permits.
15. Unknown behavior: missing artifact references yield PARTIAL.
16. Ordering: artifactType then artifactId.
17. Complete: all required package artifacts resolved.
18. Partial: at least one required artifact unresolved.
19. No answer: NOT_FOUND when package missing.
20. Blocking: broken package-artifact lineage for critical artifacts.
21. Rule: QRY-005-RULE.

QRY-006:
1. Purpose: what constitutional authority governs this artifact.
2. Input type: Artifact canonicalId.
3. Source nodes: Artifact.
4. Target nodes: ConstitutionalClause, GovernanceAuthority, GovernanceDecision.
5. Relationships: Artifact->ConstitutionalDecision, Constitution->GovernanceAuthority.
6. Ownership fields: constitutionalHomeId.
7. Evidence fields: clause and decision provenance.
8. Authority classes: AUTHORITATIVE required for complete.
9. Lifecycle fields: authority lifecycle state.
10. Validation state: constitutional integrity required.
11. Certification state: required for certification/freeze context.
12. Traversal: upstream ancestry.
13. Version behavior: current governing authority.
14. Stale behavior: stale-blocking authority evidence blocks.
15. Unknown behavior: missing ancestry yields UNKNOWN.
16. Ordering: authority tier, then canonicalId.
17. Complete: full authority chain resolved.
18. Partial: partial authority chain with explicit gaps.
19. No answer: NOT_FOUND when artifact missing.
20. Blocking: invalid constitutional ancestry.
21. Rule: QRY-006-RULE.

QRY-007:
1. Purpose: which applications consume this capability.
2. Input type: Capability canonicalId.
3. Source nodes: Capability.
4. Target nodes: Application.
5. Relationships: Application->PlatformCapability.
6. Ownership fields: application owner and platform owner.
7. Evidence fields: application-package linkage evidence.
8. Authority classes: AUTHORITATIVE, DERIVED, POTENTIAL.
9. Lifecycle fields: application lifecycle state.
10. Validation state: boundary validation required.
11. Certification state: optional.
12. Traversal: inbound from Application.
13. Version behavior: current application bindings.
14. Stale behavior: stale consumption data returns PARTIAL or UNKNOWN by criticality.
15. Unknown behavior: unknown consumers explicitly listed.
16. Ordering: applicationId.
17. Complete: all known admissible consumers resolved.
18. Partial: incomplete consumer registry.
19. No answer: NOT_FOUND when capability missing.
20. Blocking: boundary conflict making ownership illegitimate.
21. Rule: QRY-007-RULE.

QRY-008:
1. Purpose: which validation rules and records apply.
2. Input type: Package or Capability canonicalId.
3. Source nodes: Package, Capability.
4. Target nodes: ValidationRule, ValidationRecord.
5. Relationships: Capability->Validation, Package->ValidationRecord.
6. Ownership fields: validation authority owner.
7. Evidence fields: validation artifact references.
8. Authority classes: AUTHORITATIVE preferred.
9. Lifecycle fields: validation lifecycle.
10. Validation state: required.
11. Certification state: optional.
12. Traversal: outbound.
13. Version behavior: current validation set.
14. Stale behavior: stale-blocking validation evidence blocks certification-scope answers.
15. Unknown behavior: unresolved validation returns UNKNOWN.
16. Ordering: validationRuleId, validationRecordId.
17. Complete: applicable rule and record sets resolved.
18. Partial: rules known, records incomplete or vice versa.
19. No answer: NOT_FOUND when input missing.
20. Blocking: required validation unavailable for authoritative publication.
21. Rule: QRY-008-RULE.

QRY-009:
1. Purpose: which certification rules and records apply.
2. Input type: Capability or Package canonicalId.
3. Source nodes: Capability, Package.
4. Target nodes: CertificationRule, CertificationRecord.
5. Relationships: Capability->Certification, Package->CertificationRecord.
6. Ownership fields: certification authority owner.
7. Evidence fields: certification record provenance.
8. Authority classes: AUTHORITATIVE required for complete in certification context.
9. Lifecycle fields: certification lifecycle.
10. Validation state: prerequisite validation state required.
11. Certification state: required.
12. Traversal: outbound.
13. Version behavior: current certification scope.
14. Stale behavior: stale certification evidence blocks complete answer.
15. Unknown behavior: unknown certification state returns UNKNOWN.
16. Ordering: certificationRuleId, certificationRecordId.
17. Complete: all applicable rules and records resolved.
18. Partial: incomplete certification package.
19. No answer: NOT_FOUND when input missing.
20. Blocking: missing or stale-blocking certification evidence.
21. Rule: QRY-009-RULE.

QRY-010:
1. Purpose: what changes if a package changes.
2. Input type: Package canonicalId.
3. Source nodes: Package.
4. Target nodes: dependent Package, Capability, Artifact, Application, ValidationRecord, CertificationRecord, ReleaseRecord.
5. Relationships: Package->Package, Package->Artifact, Program->Package, Package->ValidationRecord, Package->CertificationRecord, Package->ReleaseRecord.
6. Ownership fields: impacted owner set.
7. Evidence fields: dependency and impact provenance.
8. Authority classes: all four supported.
9. Lifecycle fields: supersession and active state.
10. Validation state: impact-validation required.
11. Certification state: certification-impact required for freeze context.
12. Traversal: outbound direct and transitive.
13. Version behavior: selected package version baseline.
14. Stale behavior: stale dependencies cap impact confidence.
15. Unknown behavior: unresolved paths listed as UNKNOWN.
16. Ordering: impact class, distance, targetId.
17. Complete: full impact closure under scope.
18. Partial: unknown or unresolved dependent segments.
19. No answer: NOT_FOUND when package missing.
20. Blocking: constitutional or boundary critical impact conflict.
21. Rule: QRY-010-RULE.

QRY-011:
1. Purpose: lineage from Constitution to implementation.
2. Input type: Artifact or Capability canonicalId.
3. Source nodes: Constitution.
4. Target nodes: Artifact, ImplementationBoundary.
5. Relationships: Constitution->GovernanceAuthority->Capability->Program->Package->Artifact.
6. Ownership fields: authority and owner chain.
7. Evidence fields: full path provenance.
8. Authority classes: AUTHORITATIVE and DERIVED.
9. Lifecycle fields: chain lifecycle states.
10. Validation state: constitutional integrity required.
11. Certification state: optional by scope.
12. Traversal: forward and reverse lineage traversal.
13. Version behavior: selected lineage version scope.
14. Stale behavior: stale authority link blocks complete constitutional lineage.
15. Unknown behavior: missing chain segments become UNKNOWN.
16. Ordering: lineage level order.
17. Complete: end-to-end chain resolved.
18. Partial: chain contains unresolved non-critical segment.
19. No answer: NOT_FOUND for unresolved anchor input.
20. Blocking: missing constitutional ancestry.
21. Rule: QRY-011-RULE.

QRY-012:
1. Purpose: what evidence supports this relationship.
2. Input type: relationshipId.
3. Source nodes: Relationship.
4. Target nodes: EvidenceSource, Artifact.
5. Relationships: EvidenceSource->Relationship.
6. Ownership fields: evidence owner context.
7. Evidence fields: directEvidenceReference, sourcePath, sourceSection, derivationRule.
8. Authority classes: all four.
9. Lifecycle fields: evidence lifecycle.
10. Validation state: evidence integrity required.
11. Certification state: optional.
12. Traversal: relationship to provenance sources.
13. Version behavior: relationship version scope.
14. Stale behavior: stale evidence downgraded and flagged.
15. Unknown behavior: missing evidence yields UNKNOWN or BLOCKED for authoritative queries.
16. Ordering: evidence tier, source identifier.
17. Complete: full supporting evidence set resolved.
18. Partial: some evidence fields missing.
19. No answer: NOT_FOUND when relationship missing.
20. Blocking: authoritative relationship without admissible evidence.
21. Rule: QRY-012-RULE.

QRY-013:
1. Purpose: which relationships are AUTHORITATIVE.
2. Input type: optional scope filter.
3. Source nodes: Relationship.
4. Target nodes: Relationship set.
5. Relationships: relationship inventory filtered by authorityClassification.
6. Ownership fields: ownershipContext.
7. Evidence fields: directEvidenceReference required.
8. Authority classes: AUTHORITATIVE only.
9. Lifecycle fields: active lifecycle required unless lineage requested.
10. Validation state: required.
11. Certification state: optional.
12. Traversal: filter query.
13. Version behavior: selected graph version.
14. Stale behavior: stale-blocking authoritative edges excluded and diagnosed.
15. Unknown behavior: n/a.
16. Ordering: relationshipType, sourceNodeId, targetNodeId.
17. Complete: all admissible authoritative relationships returned.
18. Partial: filtered scope lacks required indexes.
19. No answer: NOT_FOUND for invalid scope filter.
20. Blocking: missing authority classification index.
21. Rule: QRY-013-RULE.

QRY-014:
1. Purpose: which relationships are DERIVED.
2. Input type: optional scope filter.
3. Source nodes: Relationship.
4. Target nodes: Relationship set.
5. Relationships: classification filtered to DERIVED.
6. Ownership fields: ownershipContext.
7. Evidence fields: derivationRuleId and source evidence references.
8. Authority classes: DERIVED.
9. Lifecycle fields: lifecycleState.
10. Validation state: required.
11. Certification state: optional.
12. Traversal: filter query.
13. Version behavior: selected graph version.
14. Stale behavior: stale source-derived relationships may downgrade to POTENTIAL.
15. Unknown behavior: missing derivation metadata yields CONFLICTED.
16. Ordering: derivationRuleId, sourceNodeId, targetNodeId.
17. Complete: all valid derived relationships with derivationRuleId.
18. Partial: some derived edges missing derivation metadata.
19. No answer: NOT_FOUND for invalid scope filter.
20. Blocking: absent derivation index.
21. Rule: QRY-014-RULE.

QRY-015:
1. Purpose: which required relationships remain POTENTIAL or UNKNOWN.
2. Input type: optional relationship class scope.
3. Source nodes: Relationship requirement set.
4. Target nodes: Relationship instances.
5. Relationships: required classes intersect POTENTIAL/UNKNOWN.
6. Ownership fields: ownershipContext where known.
7. Evidence fields: missingEvidenceDescriptors.
8. Authority classes: POTENTIAL, UNKNOWN.
9. Lifecycle fields: lifecycleState where available.
10. Validation state: required.
11. Certification state: relevant in cert/freeze scope.
12. Traversal: filter and gap analysis.
13. Version behavior: selected version.
14. Stale behavior: stale unresolved evidence flagged.
15. Unknown behavior: represented explicitly, not omitted.
16. Ordering: relationshipType, gapSeverity, sourceNodeId.
17. Complete: all required unresolved classes reported.
18. Partial: missing requirement catalog segments.
19. No answer: NOT_FOUND only for invalid scope.
20. Blocking: requirement catalog unavailable.
21. Rule: QRY-015-RULE.

QRY-016:
1. Purpose: where constitutional drift exists.
2. Input type: optional domain or package scope.
3. Source nodes: drift diagnostics scope.
4. Target nodes: drift findings.
5. Relationships: drift finding to impacted entities and evidence.
6. Ownership fields: impacted ownership context.
7. Evidence fields: driftProvenance.
8. Authority classes: all, with conflict emphasis.
9. Lifecycle fields: drift finding lifecycle.
10. Validation state: required.
11. Certification state: required for cert/freeze context.
12. Traversal: diagnostic index traversal.
13. Version behavior: selected assessment snapshot.
14. Stale behavior: stale authoritative claims become drift findings.
15. Unknown behavior: unresolved drift candidate marked UNKNOWN.
16. Ordering: severity, ruleId, impactedEntityId.
17. Complete: all active drift findings returned.
18. Partial: diagnostics index incomplete.
19. No answer: NOT_FOUND for invalid scope.
20. Blocking: drift engine unavailable.
21. Rule: QRY-016-RULE.

QRY-017:
1. Purpose: what is the validation chain.
2. Input type: Capability, Package, or Artifact canonicalId.
3. Source nodes: subject entity.
4. Target nodes: ValidationRule, ValidationRecord, ValidationAuthority.
5. Relationships: Capability->Validation, Package->ValidationRecord.
6. Ownership fields: validation authority owner.
7. Evidence fields: validation source references.
8. Authority classes: AUTHORITATIVE, DERIVED.
9. Lifecycle fields: validation lifecycle.
10. Validation state: required.
11. Certification state: optional.
12. Traversal: outbound chain traversal.
13. Version behavior: current validation set.
14. Stale behavior: stale-blocking validation evidence blocks complete chain.
15. Unknown behavior: unknown chain segment explicitly returned.
16. Ordering: chain sequence, ruleId.
17. Complete: full chain from subject to records.
18. Partial: missing record or rule segments.
19. No answer: NOT_FOUND for missing subject.
20. Blocking: required validation authority unresolved.
21. Rule: QRY-017-RULE.

QRY-018:
1. Purpose: what is the certification chain.
2. Input type: Capability, Package, or Artifact canonicalId.
3. Source nodes: subject entity.
4. Target nodes: CertificationRule, CertificationRecord, CertificationAuthority.
5. Relationships: Capability->Certification, Package->CertificationRecord.
6. Ownership fields: certification authority owner.
7. Evidence fields: certification evidence and release linkage.
8. Authority classes: AUTHORITATIVE required for complete.
9. Lifecycle fields: certification lifecycle.
10. Validation state: prerequisite validation chain.
11. Certification state: required.
12. Traversal: outbound chain traversal.
13. Version behavior: selected certification scope.
14. Stale behavior: stale certification evidence yields BLOCKED in certification context.
15. Unknown behavior: unknown certification segment returned UNKNOWN.
16. Ordering: chain sequence, certificationRuleId.
17. Complete: full certification chain with authority resolution.
18. Partial: incomplete non-critical chain segment.
19. No answer: NOT_FOUND for missing subject.
20. Blocking: unresolved certifying authority or invalid evidence.
21. Rule: QRY-018-RULE.

QRY-019:
1. Purpose: what is the release lineage.
2. Input type: Package or ReleaseRecord canonicalId.
3. Source nodes: Package, ReleaseRecord.
4. Target nodes: ReleaseRecord, CertificationRecord, Foundation.
5. Relationships: Package->ReleaseRecord, Package->CertificationRecord, Foundation->Package.
6. Ownership fields: release authority owner.
7. Evidence fields: release provenance and hashes.
8. Authority classes: AUTHORITATIVE preferred.
9. Lifecycle fields: release lifecycle.
10. Validation state: release integrity checks required.
11. Certification state: required.
12. Traversal: lineage traversal across release chain.
13. Version behavior: historical lineage allowed.
14. Stale behavior: superseded release remains lineage-visible and non-current.
15. Unknown behavior: lineage gaps returned UNKNOWN.
16. Ordering: release chronology then recordId.
17. Complete: contiguous release lineage resolved.
18. Partial: missing lineage nodes.
19. No answer: NOT_FOUND for missing seed node.
20. Blocking: conflicting release-state authoritative claims.
21. Rule: QRY-019-RULE.

QRY-020:
1. Purpose: what is constitutional home of this entity.
2. Input type: entity canonicalId.
3. Source nodes: any governed entity.
4. Target nodes: ConstitutionalClause, GovernanceAuthority.
5. Relationships: entity governance and constitutional ancestry relations.
6. Ownership fields: constitutionalHomeId and governanceAuthorityId.
7. Evidence fields: constitutional source references.
8. Authority classes: AUTHORITATIVE required for complete.
9. Lifecycle fields: authority lifecycle.
10. Validation state: constitutional integrity required.
11. Certification state: optional.
12. Traversal: upstream governance ancestry.
13. Version behavior: current governing home.
14. Stale behavior: stale-blocking home evidence blocks complete result.
15. Unknown behavior: unresolved home returns UNKNOWN.
16. Ordering: authority tier then canonicalId.
17. Complete: constitutional home resolved with evidence.
18. Partial: home resolved but supporting chain incomplete.
19. No answer: NOT_FOUND for missing entity.
20. Blocking: conflicting constitutional homes unresolved.
21. Rule: QRY-020-RULE.

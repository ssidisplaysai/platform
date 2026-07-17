# GRT-0008 API Documentation

## RuntimePolicyDefinition API

Purpose:
- Immutable authored policy source contract.

Key behavior:
- Canonicalizes metadata, rule dependencies, policy/dependency sets.
- Deep-freezes snapshots.

Non-responsibilities:
- No runtime evaluation.
- No policy resolution.

## RuntimePolicyCompiler API

Purpose:
- Deterministic compiler boundary from RuntimePolicyDefinition to RuntimePolicyIR + RuntimePolicyCompilationCertificate.

Contract:
- compile(definition) returns RuntimePolicyCompilationResult.
- Never leaks uncaught exceptions to callers.
- Invalid compilations return deterministic failure artifacts.

## RuntimePolicyCompilerPass API

Purpose:
- Deterministic pass extension boundary.

Pass record contract:
- passName
- sequence
- success/failureReason
- inputDigest/outputDigest
- diagnosticsDigest/evidenceDigest

## Compiler Pass Documentation

### 1. DefinitionValidationPass
Input:
- RuntimePolicyCompilerState.normalizedDefinition.
Output:
- Validated state or failed deterministic invalid state.
Invariants:
- required name/rules/schema/lifecycle/conflict/effect/obligation validity.
- duplicate rule signature and duplicate explicit ruleId rejection.
- function callback rejection.
Diagnostics:
- emits deterministic validation diagnostics for invalid definitions.
Evidence:
- emits DefinitionValidated or DefinitionValidationFailed.
Deterministic identity behavior:
- uses stable state digest and immutable failure records.
Failure behavior:
- marks state failed with deterministic failureReason.
Non-responsibilities:
- no normalization/resolution/evaluation.

### 2. CanonicalOrderingPass
Input:
- validated definition.
Output:
- canonical policy/rule/condition/obligation ordering.
Invariants:
- stable lexical ordering and stable record normalization.
Diagnostics:
- none required on nominal path.
Evidence:
- CanonicalOrderingApplied.
Deterministic identity behavior:
- ordering is canonical and reproducible.
Failure behavior:
- propagated through compiler boundary if exception occurs.
Non-responsibilities:
- no dependency validation/evaluation.

### 3. NormalizationPass
Input:
- canonicalized definition.
Output:
- normalized strategy and priorities.
Invariants:
- conflict strategy defaults and priority normalization.
Diagnostics:
- none required on nominal path.
Evidence:
- NormalizationApplied.
Deterministic identity behavior:
- normalized values are canonical.
Failure behavior:
- propagated as invalid compile result if exception occurs.
Non-responsibilities:
- no rule dependency graph validation.

### 4. DependencyResolutionPass
Input:
- normalized definition.
Output:
- dependency-validated state.
Invariants:
- dependency rule references must resolve.
Diagnostics:
- emits deterministic missing-dependency diagnostics.
Evidence:
- DependenciesResolved or DependencyResolutionFailed.
Deterministic identity behavior:
- stable dependency ordering and stable failure reason.
Failure behavior:
- deterministic failed pass result with failedPassName.
Non-responsibilities:
- no conflict strategy evaluation.

### 5. ConflictAnalysisPass
Input:
- dependency-valid definition.
Output:
- conflict metadata annotations.
Invariants:
- duplicate target metadata tracked deterministically.
Diagnostics:
- deterministic warning diagnostics for potential duplicates.
Evidence:
- ConflictAnalysisCompleted.
Deterministic identity behavior:
- stable duplicate counts and metadata.
Failure behavior:
- propagated through compiler boundary on exception.
Non-responsibilities:
- no conflict resolution decision execution.

### 6. DeterministicOptimizationPass
Input:
- conflict-analyzed definition.
Output:
- deterministic rule ordering refinement.
Invariants:
- stable ordering by priority/name.
Diagnostics:
- none required on nominal path.
Evidence:
- DeterministicOptimizationApplied.
Deterministic identity behavior:
- preserves stable order across repeated compiles.
Failure behavior:
- converted by compiler boundary if exception occurs.
Non-responsibilities:
- no identity/certificate issuance.

### 7. IdentityAssignmentPass
Input:
- optimized definition.
Output:
- generated deterministic policy/rule IDs when absent.
Invariants:
- identities derive from canonical content and compile context.
Diagnostics:
- none required on nominal path.
Evidence:
- DeterministicIdentitiesAssigned.
Deterministic identity behavior:
- stable generatedIds map.
Failure behavior:
- compiler converts exception to invalid result.
Non-responsibilities:
- no IR generation.

### 8. PolicyIRGenerationPass
Input:
- identity-assigned normalized definition.
Output:
- RuntimePolicyIR.
Invariants:
- executable-only IR payload, canonical fields, immutable records.
Diagnostics:
- none required on nominal path.
Evidence:
- RuntimePolicyIRGenerated.
Deterministic identity behavior:
- runtimePolicyIrId/runtimePolicyIrDigest from canonical content.
Failure behavior:
- converted by compiler boundary if exception occurs.
Non-responsibilities:
- no certificate issuance.

### 9. CompilationCertificationPass
Input:
- RuntimePolicyIR and accumulated pass state.
Output:
- RuntimePolicyCompilationCertificate and finalized pass results.
Invariants:
- includes all pass results including this pass.
- includes diagnostics/evidence/validation digests.
Diagnostics:
- throw if RuntimePolicyIR missing before certification.
Evidence:
- CompilationCertificateIssued.
Deterministic identity behavior:
- certificateId derived from canonical compile artifacts.
Failure behavior:
- converted by compiler boundary to deterministic invalid result.
Non-responsibilities:
- no runtime evaluation.

## RuntimePolicyIR API

Purpose:
- Immutable executable policy artifact.

Fields:
- runtimePolicyIrId/runtimePolicyIrDigest
- policyDefinitionId/policyDefinitionDigest
- schemaVersion/conflictStrategy
- policySetIds/dependencyPolicyIds
- canonical rule IR set
- conflictMetadata
- compilerId/compilerVersion

## RuntimePolicyCompilationCertificate API

Purpose:
- Immutable compile attestation for replay and audit.

Fields:
- certificateId
- policy/IR digests and IDs
- compiler identity
- validationResult/validationDigest
- diagnosticsDigest/evidenceDigest
- passResults

## RuntimePolicyFact API

Purpose:
- Immutable authored runtime fact envelope.

Fields:
- factKey/factType/factValue
- sourceKind/sourceId/sourceVersion/sourceDigest
- confidence/provenanceReferences/metadata

## RuntimePolicyFactCompiler API

Purpose:
- Deterministically compile RuntimePolicyFact into RuntimePolicyFactIR.

Behavior:
- enforces closed fact vocabulary and canonical value shaping.
- throws RuntimePolicyFactCompilationError on unsupported types/values.

## RuntimePolicyFactIR API

Purpose:
- Immutable evaluator input artifact.

Fields:
- factId
- canonicalType/canonicalValue
- provenance object and provenanceDigest
- sourceDigest/confidence/schemaVersion

## RuntimePolicyResolver API

Purpose:
- Deterministically select RuntimePolicyIR candidate.

Behavior:
- deterministic candidate ordering.
- exact runtime ID match preferred.
- duplicate runtimePolicyIrId candidate rejection.

## RuntimePolicyEvaluator API

Purpose:
- Synchronous pure evaluation over RuntimePolicyIR + RuntimePolicyFactIR.

Behavior:
- validates FactIR input shape.
- computes matched rules, conflict outcome, obligations, trace, deterministic decision identity.

## RuntimePolicyConflictResolver API

Purpose:
- Resolve effects under configured strategy.

Strategies:
- deny-overrides
- permit-overrides
- first-applicable
- only-one-applicable

## RuntimePolicyDecision API

Purpose:
- Immutable decision wrapper.

Fields:
- decisionId
- policyDefinitionId/runtimePolicyIrId
- decision outcome
- matchedPolicyIds/matchedRuleIds
- obligations
- trace
- factDigests/contextDigest

## RuntimePolicyDecisionTrace API

Purpose:
- Immutable deterministic trace wrapper.

Fields:
- traceId/decisionId
- ordered trace steps with phase/code/message/details

## RuntimePolicyEvidence API

Purpose:
- Append-only evidence log.

Behavior:
- monotonic sequence numbering.
- immutable entries.

## RuntimePolicyDiagnostics API

Purpose:
- Monotonic diagnostic log.

Behavior:
- deterministic sequencing.
- immutable entries.

## RuntimePolicyTelemetry API

Purpose:
- Deterministic counter aggregation.

Behavior:
- counter increment and stable snapshot sort.

## RuntimePolicySnapshotStore API

Purpose:
- Context-bound snapshot revision storage.

Behavior:
- save/loadLatest/history enforce runtimeExecutionContextId ownership.
- deterministic revision numbering.

## RuntimePolicyReplay API

Purpose:
- Deterministic replay and equivalence verification.

Behavior:
- replay(runtimePolicyIr, facts, context)
- verify(..., baselineDecision) returns digest-based equivalence report.

## RuntimePolicyManager API

Purpose:
- Context-local orchestration boundary for compile/register/evaluate/replay.

Behavior:
- compileAndRegister enforces local registry ownership and duplicate rejection.
- evaluate enforces context ownership and candidate partition checks.
- replayDecision enforces registration, digest match, object ownership.
- emits telemetry, diagnostics, and evidence.

## Adapter APIs

Adapters:
- PolicyCapabilityDispatchAdapter
- PolicyPermissionBridgeAdapter
- PolicyWorkflowTransitionAdapter
- PolicyExecutionIntentAdapter
- PolicySchedulingPlanAdapter
- PolicyMessagingPublishAdapter
- PolicyServiceLifecycleAdapter
- PolicyHostOperationAdapter
- PolicyDecisionEvidenceAdapter
- PolicyReplayVerificationAdapter

Common adapter contract:
- additive projection only
- immutable output
- no frozen subsystem mutation
- no obligation execution
- no identity/authentication acquisition

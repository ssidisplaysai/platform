# GRT-0008 Traceability Matrix

## Requirement to Implementation/Test/Validation/Governance Mapping

| Requirement | Implementation | Focused Test | Validation Evidence | GAR/GD/Package |
|---|---|---|---|---|
| definition validation | src/runtime/policy/passes/DefinitionValidationPass.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0, determinism 3x | GAR-0027, GD-0019, 03-api-documentation.md |
| compiler-pass ordering | src/runtime/policy/RuntimePolicyCompiler.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| deterministic compilation | src/runtime/policy/RuntimePolicyCompiler.ts | tests/runtime/policy/runtime-policy.test.ts | focused + matrix | GAR-0027, 04-validation-report.md |
| compiler failure artifacts | src/runtime/policy/RuntimePolicyCompiler.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| RuntimePolicyIR purity | src/runtime/policy/passes/PolicyIRGenerationPass.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| canonical normalization | src/runtime/policy/passes/CanonicalOrderingPass.ts, src/runtime/policy/passes/NormalizationPass.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| rule identity | src/runtime/policy/passes/IdentityAssignmentPass.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| certificate completeness | src/runtime/policy/passes/CompilationCertificationPass.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| fact-type validation | src/runtime/policy/RuntimePolicyFactCompiler.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| Fact IR provenance | src/runtime/policy/RuntimePolicyFactCompiler.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| resolver ordering | src/runtime/policy/RuntimePolicyResolver.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| candidate partition validation | src/runtime/policy/RuntimePolicyManager.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| evaluator purity | src/runtime/policy/RuntimePolicyEvaluator.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| Permit | src/runtime/policy/RuntimePolicyEvaluator.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| Deny | src/runtime/policy/RuntimePolicyEvaluator.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| Conditional | src/runtime/policy/RuntimePolicyEvaluator.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| NotApplicable | src/runtime/policy/RuntimePolicyEvaluator.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| Indeterminate | src/runtime/policy/RuntimePolicyConflictResolver.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| deny-overrides | src/runtime/policy/RuntimePolicyConflictResolver.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027, GD-0019 |
| permit-overrides | src/runtime/policy/RuntimePolicyConflictResolver.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027, GD-0019 |
| first-applicable | src/runtime/policy/RuntimePolicyConflictResolver.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027, GD-0019 |
| only-one-applicable | src/runtime/policy/RuntimePolicyConflictResolver.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027, GD-0019 |
| obligations | src/runtime/policy/RuntimePolicyEvaluator.ts, src/runtime/policy/adapters/*.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027, GD-0019 |
| decision traces | src/runtime/policy/RuntimePolicyEvaluator.ts, src/runtime/policy/RuntimePolicyDecisionTrace.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| context isolation | src/runtime/policy/RuntimePolicyManager.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027, GD-0019 |
| replay membership validation | src/runtime/policy/RuntimePolicyManager.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027, GD-0019 |
| full replay equivalence | src/runtime/policy/RuntimePolicyReplay.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| snapshot isolation | src/runtime/policy/RuntimePolicySnapshotStore.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| evidence | src/runtime/policy/RuntimePolicyEvidence.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| diagnostics | src/runtime/policy/RuntimePolicyDiagnostics.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| telemetry | src/runtime/policy/RuntimePolicyTelemetry.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| adapters | src/runtime/policy/adapters/*.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| public exports | src/runtime/policy/index.ts | tests/runtime/policy/runtime-policy.test.ts | focused 128/0 | GAR-0027 |
| frozen-milestone non-regression | frozen runtime paths unchanged | tests/runtime/policy/runtime-policy.test.ts | frozen-path diff pass | GAR-0027, 06-repository-impact.md |

# 13 Traceability Architecture

## Mandatory Provenance For Every Node And Edge
1. sourceArtifact
2. sourcePath
3. sourceSection
4. sourceIdentifier
5. sourceVersionOrRelease
6. sourceCertificationState
7. extractionMethod
8. derivationRule
9. authorityClassification

## Lineage Paths
Primary lineage supports forward and reverse traversal across:
1. Constitution
2. GovernanceAuthority
3. Capability
4. Program
5. Package
6. Artifact
7. ImplementationBoundary
8. Validation
9. Certification
10. Release

## Traceability Guarantees
1. Any query response can disclose the evidence chain.
2. Any authoritative claim can be traced to certified source evidence.
3. Any derived claim can be traced to source evidence plus deterministic derivation rule.

## Traceability Scope Separation
1. Package-level traceability documents how GEA-0002 architecture artifacts map to authoritative source corpus.
2. Compiled claim-level traceability documents node and edge provenance produced by future compiler implementation.
3. GEA-0002 contains architecture requirements for claim-level provenance and does not claim generated claim-level outputs exist.

## Traceability Validation Identifiers
1. TRACE-PKG-001: architecture package source traceability completeness.
2. TRACE-ARCH-001: traceability architecture requirement completeness.
3. TRACE-RUNTIME-001: compiled node and edge provenance completeness.
4. TRACE-OUTPUT-001: generated Atlas traceability integrity.

## Architecture-Only Current-State Classification
1. TRACE-PKG-001: expected PASS when package source references are valid and complete.
2. TRACE-ARCH-001: expected PASS when provenance requirements are fully specified.
3. TRACE-RUNTIME-001: expected NOT APPLICABLE until compiler implementation and compiled Atlas outputs exist.
4. TRACE-OUTPUT-001: expected NOT APPLICABLE until generated Atlas outputs exist.

## Ambiguity Elimination Rule
1. PARTIAL shall not be used to combine package-level and runtime-level traceability scope results.
2. Package-level defects shall be reported independently from runtime not-applicable states.

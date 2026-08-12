# EHC-0004 Compatibility Specification

Artifact ID: EHC-0004
Decision Parent: GCD-0005
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Architecture and Runtime Authority
Owner: Compatibility Governance

## Purpose

Define constitutional compatibility semantics between Genesis and registered application contracts.

## Compatibility Fields

- supportedGenesisVersion
- contractVersion
- apiVersion
- compatibilityStatus
- compatibilityWindow

## Compatibility Status Values

- Compatible
- CompatibleWithWarnings
- Incompatible
- PendingValidation

## Compatibility Rules

1. Applications SHALL declare supportedGenesisVersion.
2. Applications SHALL declare contractVersion compatible with EHC policies.
3. API version declaration is required when application exposes integration APIs used by Genesis contracts.
4. compatibilityStatus SHALL be computed and published by application authority semantics and validated by Genesis governance rules.
5. Incompatible status SHALL block Active readiness reporting until resolved or explicitly waived by governance authority.

## Breaking Change Governance

Breaking changes SHALL require:
- approval reference
- migration guidance publication
- compatibility impact declaration
- compatibility window declaration

No breaking change may be treated as Active-compatible without explicit approval evidence.

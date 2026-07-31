# Validation Standards

## Standard Objective

Define deterministic validation commands that every work order and release can reference.

## Validation Profiles

1. Profile QF (Quick Feedback)
- Purpose: Fast local confidence during development.
- Required commands:
  - tsc (scoped quality config)
  - lint (changed files or scoped target)
  - focused tests for modified subsystem

2. Profile QG (Quality Gate)
- Purpose: Pull request and merge gate.
- Required commands:
  - repository typecheck gate
  - repository lint gate
  - subsystem integration tests
  - atlas guardrails
  - dependency audit policy check

3. Profile QC (Certification)
- Purpose: Certification package evidence collection.
- Required commands:
  - quality gate profile (QG)
  - targeted regression matrix
  - architecture and governance checks
  - certification evidence command set capture

## Canonical Command Standard (Recommended)

The following command names should be standardized in package scripts:

- quality:typecheck
- quality:lint
- quality:test:unit
- quality:test:integration
- quality:test:regression
- quality:architecture
- quality:governance
- quality:dependency
- quality:security
- quality:templates
- quality:gate
- quality:certification

## Mapping from Current Repository Scripts

Existing:
- atlas:guardrails
- atlas:test
- atlas:regression
- atlas:certify
- gar:scan
- gar:test
- gar2:scan
- gar2:validate
- gar2:test

Recommended mapping:
- quality:architecture => atlas:guardrails + gar2:validate
- quality:test:regression => atlas:regression
- quality:governance => gar:scan + gar2:scan
- quality:certification => atlas:certify + quality:typecheck + quality:lint + quality:dependency

## Determinism Requirements

Every validation command must:
- run non-interactively
- exit non-zero on failure
- emit machine-parsable summary metrics
- avoid environment-dependent behavior where possible
- reference stable fixture datasets for repeatability

## Evidence Requirements

Every work order should record:
- commands executed
- pass/fail outcomes
- duration
- failure classification
- remediation or exclusion rationale

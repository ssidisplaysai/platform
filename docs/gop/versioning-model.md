# Versioning Model

Status: Frozen by GOP-0004A

## 1. Versioned Assets

The following assets are versioned:

- runtime architecture
- platform contracts
- module manifests
- execution schema
- event schema
- worker protocol

## 2. Semantic Versioning Policy

Semantic versioning applies:

- MAJOR: breaking contract or invariant changes
- MINOR: additive backward-compatible changes
- PATCH: clarifications, fixes, non-breaking behavior corrections

## 3. Runtime Version Baseline

Constitutional runtime baseline:

- Runtime major line: 1.x (starting from GOP-0004 freeze)

GOP-0004A does not introduce behavior changes and therefore remains a documentation freeze release.

## 4. Contract Version Rules

Contracts in platform runtime must evolve with these rules:

- additive fields: MINOR
- required field removal or type narrowing: MAJOR
- default semantics changes affecting behavior: MAJOR

## 5. Manifest Version Rules

Module manifest evolution:

- optional metadata additions: MINOR
- route or permission semantic break: MAJOR
- typo or documentation-only correction: PATCH

## 6. Execution Schema Version Rules

Execution schema changes:

- additive nullable fields: MINOR
- identity or lifecycle semantic changes: MAJOR
- metric derivation bugfix without contract break: PATCH

## 7. Event Schema Version Rules

Event schema changes:

- additive metadata fields: MINOR
- sequence or identity semantics change: MAJOR
- validation bugfixs without semantic contract break: PATCH

## 8. Worker Protocol Version Rules

Worker protocol must carry explicit version once external workers are enabled.

Rules:

- capability additions: MINOR
- registration or heartbeat required field break: MAJOR
- non-breaking quality fixes: PATCH

## 9. Deprecation Policy

Deprecation lifecycle:

1. announce deprecation in docs and release notes
2. keep compatibility for at least one MINOR release line
3. remove only in next MAJOR with migration guidance

## 10. Constitutional Compliance

Any version change that affects frozen invariants in runtime-constitution.md requires explicit amendment before implementation.

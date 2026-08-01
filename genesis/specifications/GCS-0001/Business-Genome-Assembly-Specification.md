# Business Genome Assembly Specification

## Normative Requirements
- A conforming compiler MUST assemble certified compiler outputs into a canonical Business Genome.
- Assembly MUST consume canonical entities, canonical relationships, validated facts, rule results, ledgers, and manifests.
- Assembly MUST produce Business Genome snapshot and delta outputs with manifest and provenance closure.
- Assembly MUST enforce referential integrity, cross-reference integrity, duplicate detection, orphan detection, and completeness checks.

## Normative Prohibitions
- Assembly MUST NOT create new evidence.
- Assembly MUST NOT perform identity resolution or rule evaluation.

## Informative Guidance
This specification defines normative behavior corresponding to WS-IIIE architecture contracts.

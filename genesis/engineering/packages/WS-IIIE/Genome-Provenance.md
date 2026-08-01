# Genome Provenance

## Purpose
Define provenance requirements for assembled Business Genome artifacts.

## Provenance Questions
Every assembled Business Genome SHALL answer:
1. Which compiler execution created me?
2. Which compiler version?
3. Which evidence contributed?
4. Which identities?
5. Which relationships?
6. Which rules?
7. Which manifests?
8. Which certification?

## Provenance Requirements
Each assembled genome SHALL include:
- Compiler execution identifier
- Compiler version
- Evidence references
- Identity references
- Relationship references
- Rule result references
- Assembly manifest reference
- Replay manifest reference
- Publication manifest reference
- Certification record reference

## Provenance Integrity
Provenance links SHALL be immutable and auditable.
Missing required provenance references SHALL block certification.

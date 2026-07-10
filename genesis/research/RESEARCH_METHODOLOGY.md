# Research Methodology

Status: Approved
Classification: Genesis Research Standard

## Purpose

This methodology defines how Genesis research is conducted so discoveries are testable, auditable, and governable.
It extends the Genesis scientific method with research-specific controls for experiments, evidence quality, and peer review.

## Research Method Lifecycle

1. Observation
- Record a concrete phenomenon from enterprise reality, semantic modeling, or compiler output behavior.

2. Question
- Define the specific uncertainty to resolve.

3. Hypothesis
- State a falsifiable claim.

4. Evidence Collection
- Gather source-attributed, lineage-preserving evidence.

5. Experiment Design
- Define method, variables, expected outcomes, and rejection criteria.

6. Prototype or Modeling
- Build a constrained model, simulation, or conceptual prototype for testing.

7. Verification
- Evaluate results against predefined criteria.

8. Peer Review
- Submit methods, evidence, and conclusions for independent critique.

9. Discovery
- Register validated outcome as a discovery record with confidence and limitations.

10. Specification Candidate
- Propose discovery as a candidate semantic, governance, or architecture specification input.

11. Compiler Validation
- Validate compatibility assumptions against compiler-stage constraints and deterministic requirements.

12. Canonical Promotion
- Promote only through formal governance after all prior stages pass.

## Accepted Evidence Types

- primary operational records with source attribution
- reproducible experiment outputs
- versioned models with lineage history
- audit logs with provenance metadata
- comparative cross-domain studies with traceable datasets
- peer-reviewed analytical reports tied to raw evidence

## Invalid Evidence Types

- unattributed claims
- anecdotal assertions without reproducible support
- synthetic examples presented as factual evidence without disclosure
- evidence lacking source identity, timestamp, or lineage
- circular references where claims only cite derivative claims

## Falsifiability Requirement

Every hypothesis must be falsifiable.
A hypothesis lacking explicit disconfirmation conditions is rejected before experiment design.

## Repeatability Requirement

Research findings must be repeatable by independent reviewers using the documented method, evidence inputs, and criteria.
Findings that cannot be repeated are marked inconclusive and cannot advance to specification candidate.

## Promotion Rules

A research outcome may advance when:
- evidence quality meets minimum standards
- falsifiability and repeatability criteria are satisfied
- peer review accepts methodology and interpretation
- limitations and known unknowns are documented
- compiler compatibility assumptions are validated

## Rejection Rules

A research outcome is rejected or returned when:
- hypothesis is non-falsifiable
- evidence is weak, missing, or non-lineaged
- experiment design is not reproducible
- verification criteria are ambiguous or unmet
- peer review identifies unresolved critical flaws

## Relationship to GENESIS_SCIENTIFIC_METHOD.md

GENESIS_SCIENTIFIC_METHOD.md defines the platform-wide discovery governance baseline.
This document specializes that baseline for research operations by adding explicit experiment design, peer review, and compiler validation stages.
Where conflict exists, GENESIS_SCIENTIFIC_METHOD.md is authoritative.

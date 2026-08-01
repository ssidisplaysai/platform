# Compiler Instruction Specification

## 1. Normative Instruction Model
A compiler instruction is a governed execution directive interpreted by conforming compiler passes.

## 2. Normative Instruction Requirements
Every instruction MUST define:
- instruction identifier
- instruction class
- required inputs
- expected outputs
- preconditions
- postconditions
- failure conditions
- provenance requirements
- replay requirements

## 3. Normative Instruction Determinism
- Identical instruction inputs and versions MUST produce identical instruction outcomes.
- Instruction evaluation order MUST be deterministic.

## 4. Normative Instruction Constraints
- Instructions MUST NOT authorize creation of non-evidence-backed facts.
- Instructions MUST NOT bypass lifecycle, manifest, replay, or certification requirements.

## Informative Guidance
Instruction encoding format is implementation-defined and out of scope for this specification.

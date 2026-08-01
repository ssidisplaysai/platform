# Relationship Confidence Model

## Purpose
Define constitutional confidence semantics for relationship resolution decisions.

## Required Decision Fields
Every relationship decision SHALL include:
- Supporting Evidence
- Contradicting Evidence
- Confidence
- Authority Weight
- Rule Set Version
- Compiler Version
- Replay Identifier
- Certification Status

## Confidence Semantics
Confidence SHALL represent governed decision certainty derived from approved evidence and rules.
Confidence SHALL NOT be treated as an unconstrained heuristic.

## Authority Weight
Authority Weight SHALL encode governed source authority strength.
Weight definitions SHALL be rule-set controlled and versioned.

## Contradiction Semantics
Contradicting evidence SHALL be retained and SHALL influence confidence under governed rules.
Suppression of contradicting evidence SHALL be prohibited.

## Confidence Determinism
For identical evidence sets and version context, confidence outputs SHALL be deterministic.

## Confidence State Bands
Implementations MAY map confidence to bands, but band definitions MUST be governance-defined and versioned.
Example bands: HIGH, MEDIUM, LOW, INSUFFICIENT.

## Certification Relationship
Confidence outputs SHALL be certifiable through replay and independent evidence review.

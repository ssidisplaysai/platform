# Canonical Relationship Model

## Purpose
Define the canonical relationship structure and required fields for constitutional relationship resolution.

## Core Relationship Record
Each canonical relationship record SHALL include:
- Relationship Identifier
- Source Entity
- Target Entity
- Relationship Type
- Relationship Class
- Relationship State
- Effective Date
- Expiration Date (if any)
- Supporting Evidence References
- Contradicting Evidence References
- Confidence
- Authority Weight
- Rule Set Version
- Compiler Version
- Business Genome Version
- Replay Identifier
- Certification Status
- Created Timestamp
- Last State Transition Timestamp

## Relationship Type Governance
Relationship classes SHALL be governed enumerations with explicit constitutional definitions.
New classes MAY be added only by governance amendment and version increment.

## Directionality
Relationship direction SHALL be explicit.
If a relationship is bi-directional, each direction SHALL be represented through governed directional semantics.

## Cardinality
Cardinality constraints SHALL be rule-governed per relationship class.
Any class-specific cardinality violation SHALL trigger rejection or conditional outcome under approved rules.

## Relationship Lineage
Each relationship record SHALL include lineage links to:
- Evidence lineage
- Identity decision lineage
- Rule lineage
- Compiler lineage
- Certification lineage

## Supersession and Retirement Markers
Relationship records SHALL support immutable status markers for:
- Superseded by relationship identifier
- Supersession rationale reference
- Retirement timestamp
- Retirement rationale reference

## Compatibility Contract
All model changes SHALL be versioned and backward compatibility behavior SHALL be explicitly declared in governance metadata.

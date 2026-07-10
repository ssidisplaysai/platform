# STAGE-04: Semantic Mapping

**Stage**: 4 of 8  
**Name**: Semantic Mapping  
**Purpose**: Map verified EKOs to canonical business semantics (Genesis Business Semantics - GBS)  
**Input**: Verified EKOs from Stage 3  
**Output**: Canonical EKOs (GBS-aligned)  
**Specification**: GCS-0001  

---

## 1. Purpose

The **Semantic Mapping** stage normalizes EKOs to canonical business concepts defined in Genesis Business Semantics (GBS).

This ensures that different organizations using the same concepts refer to them consistently.

### Core Responsibilities

1. **Semantic Resolution**: Map EKOs to canonical concepts
2. **Alias Resolution**: Standardize terminology
3. **Relationship Validation**: Ensure semantic consistency
4. **Semantic Normalization**: Create canonical forms
5. **Cross-Organization Alignment**: Apply GBS standards

---

## 2. Inputs

### 2.1 Input Format

**Type**: Verified EKOs (from Stage 3)  
**Format**: JSON  

### 2.2 Semantic Mappings Required

Input must include:
- GBS concept definitions
- Alias mappings
- Relationship rules
- Normalization rules

### 2.3 GBS Concepts

Genesis Business Semantics defines:

```
Core Concepts:
  - Actor: Who performs actions
  - Resource: What is operated on
  - Capability: What can be done
  - Constraint: Limitations
  - Process: How things flow
  - Outcome: What is achieved

Each concept has:
  - Canonical name
  - Aliases (synonyms)
  - Relationships to other concepts
  - Normalization rules
  - Validation rules
```

---

## 3. Outputs

### 3.1 Output Artifacts

#### 3.1.1 Canonical EKOs (GBS-Aligned)

```json
{
  "ekoId": "eko_<hash>_v1",
  "type": "capability",
  "content": "Can create graphics",
  "semanticForm": "Capability[Actor=Designer, Resource=Graphics, Action=Create]",
  "canonicalConcept": "capability_design_graphics",
  "gbsMapping": {
    "concept": "Actor_Capability",
    "mappedTo": "gbs_001_capability_design",
    "confidence": 0.92
  },
  "aliases": {
    "alternate": ["ability to design", "graphics creation capability"],
    "relatedConcepts": ["design", "graphics", "creative"]
  },
  "originalConfidence": 0.85,
  "semanticConfidence": 0.92,
  "metadata": {
    "mappedAt": "2026-07-10T00:00:00Z",
    "mappedBy": "semantic-mapper-1.0"
  }
}
```

#### 3.1.2 Semantic Map

```json
{
  "mapId": "smap_<hash>_v1",
  "ekosProcessed": 42,
  "ekosWithCanonicalization": 42,
  "mappedConcepts": {
    "actor": 15,
    "capability": 12,
    "constraint": 8,
    "resource": 4,
    "process": 2,
    "outcome": 1
  },
  "aliasResolutions": 23,
  "relationshipsValidated": 45
}
```

---

## 4. Invariants

### Stage 4 Invariants (I4-x)

| ID | Invariant | Definition |
|----|-----------|-----------|
| **I4.1** | Semantic Mapping | All EKOs map to GBS concepts |
| **I4.2** | Alias Consistency | Aliases resolve deterministically |
| **I4.3** | Relationship Validity** | Relationships follow GBS rules |
| **I4.4** | Canonical Form | Deterministic canonical representation |
| **I4.5** | Immutability | Original data unchanged |
| **I4.6** | Determinism | Same input → same output |

---

## 5. Semantic Mapping Process

### 5.1 Mapping Algorithm

```
For each EKO:
  1. Extract semantic components (actor, action, resource)
  2. Look up concept mapping in GBS
  3. Find aliases and synonyms
  4. Normalize terminology
  5. Create canonical form
  6. Validate against GBS rules
  7. Calculate semantic confidence
  8. Output canonical EKO
```

### 5.2 Concept Mapping Example

```
Input EKO:
  Type: "capability"
  Content: "Can design graphics"
  
Semantic Extraction:
  Actor: "Designer"
  Action: "design"
  Resource: "graphics"

GBS Lookup:
  Concept: "capability_design_graphics" (exact match)
  OR
  Concept: "capability_visual_design" (semantic match)
  OR
  Concept: "actor_capability" (generic match)

Alias Resolution:
  "design" → canonical: "design"
  "graphics" → canonical: "visual_content"
  "ability" → canonical: "capability"

Output:
  CanonicalConcept: "capability_design_visual_content"
  SemanticForm: "Capability[Actor=Designer, Resource=Visual Content]"
  GBSMapping: "gbs_001_capability_design"
  Confidence: 0.92
```

### 5.3 Relationship Validation

```
GBS Rules:
  - Actor has Capabilities (1:many valid)
  - Resource has Constraints (1:many valid)
  - Capability requires Resource (required)
  - Process has Outcomes (1:many valid)

Validation:
  IF EKO1.actor.id == EKO2.actor.id
     THEN (EKO1.capability, EKO2.capability) can coexist
  IF EKO1 == "not X" and EKO2 == "X"
     THEN conflict, cannot coexist
```

---

## 6. Metrics

### 6.1 Mapping Metrics

| Metric | Purpose |
|--------|---------|
| **ekosWithCanonicalization** | Items successfully mapped |
| **mappingConfidenceAverage** | Quality of mappings |
| **aliasResolutions** | Terminology standardizations |
| **relationshipsValidated** | Relationships checked |
| **unmappedConcepts** | Items without mapping |

---

## 7. Trust Boundary (B4, B5)

### 7.1 Trust About Verified EKOs (B4)

We **trust**:
- EKOs are verified
- Conflicts are resolved
- Confidence scores are final
- Content is accurate

### 7.2 Trust for Stage 5 (B5)

Stage 5 **trusts**:
- EKOs map to canonical GBS concepts
- Aliases are resolved
- Relationships are valid
- Semantic form is canonical

---

## 8. Determinism

### 8.1 Deterministic Guarantees

```
✓ Identical input → identical canonical forms
✓ Identical alias resolution
✓ Identical concept mappings
✓ Identical relationship validation
✓ Identical confidence adjustments
```

### 8.2 Non-Deterministic Elements

Explicitly allowed:
- Mapping execution order (results same)
- GBS concept version (tracked in metadata)

---

**STAGE-04: Semantic Mapping**  
**Part of GCS-0001 Genesis Compiler Specification**

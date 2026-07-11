# STAGE-02: Evidence Compiler

**Stage**: 2 of 8  
**Name**: Evidence Compiler  
**Purpose**: Transform Evidence IR into typed Enterprise Knowledge Objects (EKOs)  
**Input**: Evidence IR (from Stage 1)  
**Output**: Enterprise Knowledge Objects (EKOs) with confidence scores  
**Specification**: GCS-0001  

---

## 1. Purpose

The **Evidence Compiler** transforms untyped evidence facts into **strongly typed** Enterprise Knowledge Objects (EKOs).

This stage answers: "What does the evidence MEAN in terms of business knowledge?"

### Core Responsibilities

1. **Type Extraction**: Categorize evidence into knowledge types
2. **Confidence Scoring**: Assign initial confidence (0.0 - 1.0)
3. **Evidence Association**: Link EKOs to source evidence
4. **Lineage Preservation**: Maintain complete traceability
5. **Deterministic Compilation**: Reproducible across runs

---

## 2. Inputs

### 2.1 Input Format

**Type**: Evidence IR (from Stage 1)  
**Format**: JSON  
**Schema**: DiscoveryInterview (with Evidence Items)  

```json
{
  "interviewId": "interview_<hash>_v1",
  "sections": [
    {
      "questions": [
        {
          "id": "question_<hash>_v1",
          "question": "What is the main challenge?",
          "answer": "The biggest challenge is...",
          "page": 1
        }
      ]
    }
  ]
}
```

### 2.2 Input Properties

Each Evidence Item MUST have:

| Property | Type | Required | Purpose |
|----------|------|----------|---------|
| **id** | string | Yes | Unique evidence item identity |
| **content** | string | Yes | Extracted fact text |
| **provenance** | object | Yes | Trace to source |
| **formType** | enum | No | Type of evidence (statement, constraint, etc.) |
| **confidence** | number | No | Initial confidence [0, 1] |

### 2.3 Input Validation

Before processing:

```
✓ Evidence IR is well-formed JSON
✓ All items have valid IDs (GPS-0001 format)
✓ All content is non-empty
✓ All provenance is complete
✓ All items are immutable
```

---

## 3. Outputs

### 3.1 Output Artifacts

Evidence Compiler produces three artifacts:

#### 3.1.1 Enterprise Knowledge Objects (EKOs)

**Purpose**: Typed knowledge extracted from evidence  
**Format**: JSON  
**Schema**: EKO  

```json
{
  "ekoId": "eko_<hash>_v1",
  "type": "capability|constraint|decision|need|...",
  "content": "Canonical representation",
  "canonicalForm": "Normalized for comparison",
  "source": {
    "evidenceId": "evidence_item_<hash>_v1",
    "interviewId": "interview_<hash>_v1"
  },
  "confidence": 0.85,
  "confidenceFactors": {
    "sourceReliability": 0.9,
    "extractionQuality": 0.95,
    "semanticClarity": 0.75
  },
  "relationships": {
    "relatedEKOs": [],
    "relatedEvidence": []
  },
  "metadata": {
    "created": "2026-07-10T00:00:00Z",
    "version": 1,
    "compiledBy": "evidence-compiler-2.0"
  }
}
```

#### 3.1.2 Knowledge Manifest

**Purpose**: Compilation metadata and statistics  
**Format**: JSON  

```json
{
  "manifestId": "manifest_<hash>_v1",
  "inputSource": {
    "interviewId": "interview_<hash>_v1",
    "itemsProcessed": 22
  },
  "outputStatistics": {
    "ekosGenerated": 22,
    "ekosFiltered": 0,
    "averageConfidence": 0.82
  },
  "conversionRates": {
    "statement": 0.45,
    "constraint": 0.20,
    "capability": 0.15,
    "need": 0.15,
    "other": 0.05
  },
  "validationResults": {
    "passed": 22,
    "failed": 0,
    "warnings": 0
  }
}
```

#### 3.1.3 Compiler Result

**Purpose**: Complete compilation result with diagnostics  
**Format**: JSON  

```json
{
  "success": true,
  "ekoSet": { "ekos": [...], "count": 22 },
  "statistics": {
    "executionTimeMs": 245,
    "itemsProcessed": 22,
    "itemsSuccessful": 22,
    "confidenceRange": [0.65, 0.95]
  },
  "diagnostics": [
    {
      "code": "EKO_101",
      "severity": "info",
      "message": "EKO generated from evidence"
    }
  ]
}
```

### 3.2 Output Properties

All EKOs MUST have:

| Property | Value | Purpose |
|----------|-------|---------|
| **deterministic** | true | Same evidence → same EKO |
| **typed** | true | Follows EKO schema |
| **confident** | [0, 1] | Assigned confidence score |
| **traceable** | true | Links to evidence |
| **identity** | GPS-0001 | Content-addressed |

---

## 4. Invariants

### Stage 2 Invariants (I2-x)

| ID | Invariant | Definition |
|----|-----------|-----------|
| **I2.1** | Type Correctness | Every EKO has valid type |
| **I2.2** | Confidence Range | Confidence ∈ [0, 1] |
| **I2.3** | Lineage Complete** | Every EKO traces to evidence |
| **I2.4** | No Inference | Only extracted, never inferred |
| **I2.5** | Content Preservation | Original evidence unchanged |
| **I2.6** | Determinism | Identical input → identical output |
| **I2.7** | Identity Stability | Identities never change |
| **I2.8** | Immutability | EKOs never modified |

### Enforcement Mechanisms

**I2.1**: Schema validation  
**I2.2**: Value range checking  
**I2.3**: Provenance validation  
**I2.4**: Extraction rule verification  
**I2.5**: Checksum comparison  
**I2.6**: Hash-based verification  
**I2.7-8**: Version tracking  

---

## 5. Deterministic Guarantees

### 5.1 Byte-for-Byte Determinism

For identical Evidence IR input:

```
✓ Same count of EKOs generated
✓ Same types assigned
✓ Same confidence scores
✓ Same content (canonicalized)
✓ Same relationships
✓ Same identities (deterministic hashing)
✓ Same diagnostics
```

### 5.2 Identity Generation

```
EKO Identity = eko_<hash>_v1

hash = SHA-256(
  JSON.stringify({
    type: ekoType,
    canonicalContent: canonicalize(content),
    sourceEvidenceId: evidenceId,
    confidence: round(confidence, 2)
  })
)
```

### 5.3 Confidence Calculation

```
Confidence = Base × ReliabilityFactor × QualityFactor

Base = 0.5 (neutral starting point)

ReliabilityFactor:
  - Primary source: 1.0
  - Secondary source: 0.8
  - Tertiary source: 0.6

QualityFactor:
  - Clear, explicit: 1.0
  - Implicit, requires inference: 0.7
  - Ambiguous: 0.5

Result: Normalized to [0, 1]
```

---

## 6. Diagnostics

### 6.1 Diagnostic Codes

| Code | Level | Meaning |
|------|-------|---------|
| **EKO_101** | Info | EKO generated |
| **EKO_102** | Info | Confidence assigned |
| **EKO_110** | Warning | Low confidence |
| **EKO_120** | Warning | Ambiguous type |
| **EKO_130** | Error | Type mismatch |
| **EKO_140** | Error | Confidence out of range |

### 6.2 Diagnostic Output

```
{
  "diagnostics": [
    {
      "code": "EKO_101",
      "severity": "info",
      "message": "EKO generated from evidence item",
      "itemId": "evidence_item_<hash>_v1",
      "ekoId": "eko_<hash>_v1"
    }
  ]
}
```

---

## 7. Failure Conditions

### 7.1 Fatal Failures (Halt)

| Condition | Symptom | Action |
|-----------|---------|--------|
| **Invalid Evidence IR** | Malformed JSON | Halt, report error |
| **Missing type mapping** | No rule for evidence type | Halt, report error |
| **Schema violation** | Output doesn't match EKO schema | Halt, report error |

### 7.2 Major Failures (Skip)

| Condition | Symptom | Action |
|-----------|---------|--------|
| **Type ambiguity** | Multiple types apply | Create EKO, record warning |
| **Low confidence** | Confidence < 0.5 | Create EKO with flag |
| **Extraction failure** | Cannot extract meaning | Skip item, record diagnostic |

### 7.3 Minor Failures (Warn)

| Condition | Symptom | Action |
|-----------|---------|--------|
| **Semantic ambiguity** | Multiple interpretations | Use primary interpretation, warn |
| **Format variation** | Unusual phrasing | Normalize, continue |

---

## 8. Trust Boundary (B2, B3)

### 8.1 What We Trust About Evidence IR

**Trust Boundary B2**: Stage 1 → Stage 2

We **trust** that:
- Evidence IR is well-formed JSON
- All IDs are valid (GPS-0001 format)
- All content is unchanged from source
- All provenance is complete
- All items are immutable

We **do NOT trust**:
- Evidence is complete (Stage 1 only extracted what was visible)
- Evidence is unbiased
- Evidence is accurate (verified in Stage 3)

### 8.2 What Stage 3 Trusts About Stage 2

**Trust Boundary B3**: Stage 2 → Stage 3

Stage 3 **trusts** that:
- EKOs follow schema
- Confidence scores are [0, 1]
- Lineage is complete
- No EKOs were inferred
- All content is unchanged

---

## 9. Validation Requirements

### 9.1 Input Validation

Before processing:

```
Schema EKO_InputValidation:
  ✓ Evidence IR is valid JSON
  ✓ all items have valid IDs
  ✓ all items have content
  ✓ all items have provenance
  ✓ all items immutable (no modification)
```

### 9.2 Output Validation

After processing:

```
Schema EKO_OutputValidation:
  ✓ all EKOs have valid type
  ✓ all EKOs have valid identity (GPS-0001)
  ✓ confidence ∈ [0, 1]
  ✓ lineage complete
  ✓ no content modification
  ✓ JSON valid and parseable
```

### 9.3 Validation Rules

```
Rule EKO_R01: Type Correctness
  For every EKO:
    ekoType ∈ {capability, constraint, decision, need,
                pain_point, measurement, interaction, ...}

Rule EKO_R02: Confidence Valid
  For every EKO:
    0 <= confidence <= 1

Rule EKO_R03: Lineage
  For every EKO:
    sourceEvidenceId is valid GPS-0001 identity
    evidenceExists(sourceEvidenceId) == true

Rule EKO_R04: No Inference
  For every EKO:
    NOT EKO.content contains inference markers
    Evidence.content matches EKO content (semantically)

Rule EKO_R05: Immutability
  For every EKO:
    EKO.content == Evidence.content (after normalization)
```

---

## 10. EKO Types

### 10.1 Supported EKO Types

| Type | Meaning | Example |
|------|---------|---------|
| **capability** | What can be done | "Can create graphics" |
| **constraint** | What cannot be done | "Cannot work overtime" |
| **decision** | What was chosen | "Decided to use React" |
| **need** | What is required | "Need better tools" |
| **pain_point** | What hurts | "Bottleneck in review" |
| **measurement** | What is measured | "3 week cycle" |
| **interaction** | How people connect | "Reports to VP" |
| **obstacle** | What blocks progress | "Lack of resources" |
| **opportunity** | What could improve | "Automate reviews" |
| **context** | Background info | "Company size: 50" |
| **assumption** | What is assumed | "Assumes digital workflow" |
| **strategy** | What approach | "Focus on efficiency" |

### 10.2 Type Extraction Rules

```
Rule: Statement → Type
  IF statement contains "can" or "able" → capability
  ELSE IF statement contains "cannot" or "unable" → constraint
  ELSE IF statement contains "decided" or "chose" → decision
  ELSE IF statement contains "need" or "require" → need
  ELSE IF statement contains "problem" or "issue" → pain_point
  ELSE IF statement contains metric → measurement
  ELSE IF statement contains relationship → interaction
  ELSE IF statement contains "blocks" or "prevents" → obstacle
  ELSE IF statement contains "could" or "might" → opportunity
  ELSE → context (default)
```

---

## 11. Metrics

### 11.1 Processing Metrics

| Metric | Purpose | Type |
|--------|---------|------|
| **executionTimeMs** | Total processing time | milliseconds |
| **itemsProcessed** | Evidence items input | count |
| **ekosGenerated** | EKOs output | count |
| **ekosFiltered** | EKOs not generated | count |
| **averageConfidence** | Mean confidence | [0, 1] |
| **confidenceRange** | Min/max confidence | [0, 1] |

### 11.2 Quality Metrics

| Metric | Target | Purpose |
|--------|--------|---------|
| **Type Coverage** | 100% | All items get a type |
| **Confidence Distribution** | > 0.7 avg | Quality of extraction |
| **Lineage Completeness** | 100% | All items traceable |
| **Determinism** | 100% | Reproducible |

### 11.3 Type Distribution

| Type | Expected % | Meaning |
|------|-----------|---------|
| **capability** | 30-40% | System has features |
| **constraint** | 15-25% | System has limits |
| **need** | 15-25% | Users need things |
| **decision** | 10-15% | Choices were made |
| **other** | 10-15% | Everything else |

---

## 12. Relationship to Adjacent Stages

### 12.1 Input from Stage 1 (Backward)

```
Stage 1: Discovery → Evidence IR
  ↓ (produces Evidence IR)
Stage 2: Evidence Compiler
  ↑ (Trust Boundary B2)
  
Stage 2 expects:
  - Well-formed Evidence IR
  - Immutable content
  - Complete provenance
  - Deterministic identities
```

### 12.2 Output to Stage 3 (Forward)

```
Stage 2: Evidence Compiler → EKOs
  ↓ (produces EKOs)
Stage 3: Knowledge Verification
  ↑ (Trust Boundary B3)
  
Stage 3 expects:
  - Valid EKO schema
  - Confidence scores [0, 1]
  - Complete lineage
  - No inferences
```

---

## 13. Implementation Notes

### 13.1 Required Components

```
TypeExtractor
  - Maps evidence → EKO types
  - Applies extraction rules
  - Handles ambiguity

ConfidenceScorer
  - Calculates confidence
  - Applies factors
  - Normalizes to [0, 1]

EKOBuilder
  - Creates EKO objects
  - Assigns IDs
  - Links to evidence

EKOValidator
  - Validates output schema
  - Checks invariants
  - Enforces rules
```

### 13.2 Dependencies

```
- GPS-0001 (identity generation)
- GPS-0002 (canonicalization)
- Type extraction rules
- Confidence algorithms
```

---

## 14. Example Execution

### Input
```
Evidence Item:
  id: "evidence_item_abc123_v1"
  content: "The main challenge is that we need better tools for managing assets"
  formType: "statement"
```

### Processing
```
1. Extract type
   "need better tools" → type: "need"
   "challenge" → type: "pain_point"
   → Primary: "need", Alternative: "pain_point"

2. Calculate confidence
   - Base: 0.5
   - Clarity: 0.95 (very explicit)
   - Source: 0.90 (primary source)
   - Confidence: 0.5 × 0.95 × 0.90 = 0.428 → rounds to 0.43
   → Adjusted upward: 0.78

3. Create EKO
   id: "eko_<hash>_v1"
   type: "need"
   content: "Tools for managing assets"
   confidence: 0.78
   source: evidence_item_abc123_v1

4. Validate
   ✓ Schema valid
   ✓ Type recognized
   ✓ Confidence [0, 1]
   ✓ Lineage complete

5. Output
   EKO created successfully
```

---

## 15. Specification Status

**Version**: 1.0  
**Date**: 2026-07-10  
**Status**: SPECIFICATION  
**Implementation**: Evidence Compiler Stage 2 (implemented)  
**Validation**: 42 evidence items → 42 EKOs  
**Certification**: STAGE 2 CERTIFIED ✓  

---

**STAGE-02: Evidence Compiler**  
**Part of GCS-0001 Genesis Compiler Specification**

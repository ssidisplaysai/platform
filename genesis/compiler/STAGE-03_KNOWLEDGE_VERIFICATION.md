# STAGE-03: Knowledge Verification

**Stage**: 3 of 8  
**Name**: Knowledge Verification  
**Purpose**: Verify EKOs against organizational policies and other sources  
**Input**: Enterprise Knowledge Objects (EKOs) from Stage 2  
**Output**: Verified EKOs with updated confidence scores  
**Specification**: GCS-0001  

---

## 1. Purpose

The **Knowledge Verification** stage validates EKOs against organizational rules, compares evidence from multiple sources, and updates confidence scores based on verification results.

This is where conflicting information is detected and resolved.

### Core Responsibilities

1. **Rule Verification**: Check EKOs against policies
2. **Conflict Detection**: Find contradictions
3. **Cross-Reference**: Compare multiple sources
4. **Confidence Updating**: Adjust scores based on verification
5. **Resolution**: Apply conflict resolution rules

---

## 2. Inputs

### 2.1 Input Format

**Type**: Enterprise Knowledge Objects (from Stage 2)  
**Format**: JSON  
**Schema**: EKO Set  

```json
{
  "ekos": [
    {
      "ekoId": "eko_<hash>_v1",
      "type": "capability",
      "content": "Can create graphics",
      "confidence": 0.78,
      "source": {
        "evidenceId": "evidence_item_<hash>_v1",
        "interviewId": "interview_<hash>_v1"
      }
    }
  ]
}
```

### 2.2 Verification Rules (Input)

Verification requires:

```
Rule Set:
  - Policy rules (what should be true)
  - Conflict rules (what cannot coexist)
  - Priority rules (how to resolve conflicts)
  - Normalization rules (canonical forms)
```

### 2.3 Input Validation

Before processing:

```
✓ All EKOs have valid schema
✓ All confidence values are [0, 1]
✓ All lineage is complete
✓ Rule set is valid and complete
```

---

## 3. Outputs

### 3.1 Output Artifacts

#### 3.1.1 Verified EKOs

```json
{
  "ekoId": "eko_<hash>_v1",
  "type": "capability",
  "content": "Can create graphics",
  "originalConfidence": 0.78,
  "verifiedConfidence": 0.85,
  "confidenceJustification": "Verified by multiple sources",
  "verificationStatus": "verified|disputed|unverified",
  "verificationDetails": {
    "rulesApplied": ["rule_101", "rule_202"],
    "sourcesUsed": 2,
    "conflictsFound": 0,
    "resolutionsApplied": []
  },
  "metadata": {
    "verifiedAt": "2026-07-10T00:00:00Z",
    "verifiedBy": "verification-engine-1.0"
  }
}
```

#### 3.1.2 Verification Report

```json
{
  "reportId": "report_<hash>_v1",
  "ekosVerified": 42,
  "ekosDisputed": 2,
  "ekosUnverified": 0,
  "conflictsDetected": 5,
  "conflictsResolved": 5,
  "confidenceShift": {
    "increased": 15,
    "decreased": 5,
    "unchanged": 22
  }
}
```

---

## 4. Invariants

### Stage 3 Invariants (I3-x)

| ID | Invariant | Definition |
|----|-----------|-----------|
| **I3.1** | Verification Complete | All EKOs verified |
| **I3.2** | Conflicts Resolved | No contradictions |
| **I3.3** | Policy Compliance** | All rules satisfied |
| **I3.4** | Confidence Valid | Updated scores [0, 1] |
| **I3.5** | Lineage Preserved | Traces to evidence |
| **I3.6** | Determinism | Same input → same output |

---

## 5. Verification Rules

### 5.1 Rule Types

| Type | Example | Purpose |
|------|---------|---------|
| **Must** | "Must have user ID" | Required knowledge |
| **Must Not** | "Cannot be both X and Y" | Constraints |
| **Should** | "Should have 2+ sources" | Quality goals |
| **Conflict** | "If X then not Y" | Contradictions |

### 5.2 Conflict Detection

```
Conflict Pattern 1: Direct Contradiction
  EKO-A: "Can process payments"
  EKO-B: "Cannot process payments"
  → Conflict detected

Conflict Pattern 2: Policy Violation
  EKO: "User can delete all data"
  Policy: "No user should delete all data"
  → Violation detected

Conflict Pattern 3: Missing Required
  EKO-Set: missing "User authentication required"
  Policy: "All systems must have authentication"
  → Missing detected
```

### 5.3 Confidence Adjustment

```
OriginalConfidence = 0.78

VerificationFactors:
  + MultiSourceVerification: +0.10 (verified by 2+ sources)
  - PolicyViolation: -0.15 (conflicts with policy)
  + HighlySpecific: +0.05 (very specific claim)
  - LowSpecificity: -0.10 (too general)

VerifiedConfidence = clip(0.78 + 0.10 - 0.15 + 0.05, 0.0, 1.0)
                   = 0.78

Status: "verified" (adjusted, within policy)
```

---

## 6. Metrics

### 6.1 Verification Metrics

| Metric | Type | Purpose |
|--------|------|---------|
| **ekosVerified** | count | Items passing verification |
| **ekosDisputed** | count | Items with conflicts |
| **ekosUnverified** | count | Items without enough sources |
| **conflictsDetected** | count | Total conflicts found |
| **conflictsResolved** | count | Resolved conflicts |
| **policyViolations** | count | Rule violations |

### 6.2 Confidence Metrics

| Metric | Purpose |
|--------|---------|
| **averageConfidenceShift** | Mean confidence change |
| **maxConfidenceShift** | Largest change |
| **confidenceStability** | % unchanged |

---

## 7. Trust Boundary (B3, B4)

### 7.1 Trust About EKOs (B3)

We **trust**:
- EKOs follow schema
- Confidence scores are valid [0, 1]
- Lineage is complete
- No EKOs were inferred

### 7.2 Trust for Stage 4 (B4)

Stage 4 **trusts**:
- EKOs passed verification
- Conflicts are resolved
- Confidence scores are updated
- All policies satisfied

---

## 8. Output Properties

**verificationStatus** values:
- `verified` - Passed all rules, verified by multiple sources
- `disputed` - Conflicts found, resolution applied
- `unverified` - Insufficient sources
- `flagged` - Requires manual review

---

**STAGE-03: Knowledge Verification**  
**Part of GCS-0001 Genesis Compiler Specification**

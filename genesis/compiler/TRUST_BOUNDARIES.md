# Genesis Compiler: Trust Boundaries

**Document**: GCS-0001 Supporting  
**Topic**: Trust Boundaries and Assumptions  
**Date**: 2026-07-10  

---

## What is a Trust Boundary?

A **trust boundary** is where one stage of the pipeline makes explicit assumptions about the output of the previous stage.

When Stage N processes output from Stage N-1, it **trusts that**:
- The format is correct
- The structure is valid
- The content is accurate
- The invariants hold

If these assumptions are violated, Stage N's behavior is undefined.

---

## Trust Boundaries in the Genesis Pipeline

### Boundary B1: Reality → Stage 1 (Discovery)

**Location**: Between Reality and Evidence Discovery  
**Stage 1 Trusts**:

| Assumption | Meaning | Verification |
|-----------|---------|--------------|
| **Source authenticity** | Claimed source is real | Source registration, audit trail |
| **Content integrity** | Content hasn't been tampered with | Checksum verification |
| **Format correctness** | File format matches declaration | File signature verification |
| **Encoding validity** | Content is UTF-8 compatible | Encoding detection, conversion |
| **Reasonable size** | File is not suspiciously large | Size limit checking |

**What Could Fail**:
- Malicious source injection
- File corruption
- Format mismatch
- Encoding problems
- Excessively large files

**Stage 1 Does NOT Trust**:
- Content is complete (may be partial)
- Content is accurate (verified in later stages)
- Content is unbiased (could be opinions)
- Content is current (could be historical)

---

### Boundary B2: Stage 1 → Stage 2 (Evidence IR Valid)

**Location**: Between Discovery and Evidence Compiler  
**Stage 2 Trusts**:

| Assumption | Meaning | Validation |
|-----------|---------|-----------|
| **JSON validity** | Evidence IR is valid JSON | Schema validation |
| **Identity format** | All IDs follow GPS-0001 | Identity format validation |
| **ID determinism** | Same content → same ID | Content hash verification |
| **Immutability** | Content unchanged after creation | Checksum verification |
| **Provenance complete** | Every item traces to source | Provenance verification |
| **Text preservation** | Source text unchanged | Text length matching |
| **Ordering preserved** | Items in source order | Order verification |

**What Could Fail**:
- Malformed JSON
- Invalid IDs
- Non-deterministic IDs
- Modified content
- Missing provenance
- Text modifications
- Reordered items

**Verification at B2**:
```
Schema Validation:
  ✓ Valid JSON structure
  ✓ Required fields present
  ✓ Type correctness
  ✓ Value ranges valid

Identity Validation:
  ✓ Format: evidence_item_<hash>_v1
  ✓ Hash: 64 hex characters
  ✓ Version: v1
  ✓ Deterministic (reproducible)

Provenance Validation:
  ✓ Source references valid
  ✓ Page numbers correct
  ✓ Block positions valid
  ✓ Complete lineage
```

**Stage 2 Does NOT Trust**:
- Content is accurate (verified in Stage 3)
- Content is interpreted correctly (determined in Stage 2)
- Content is complete (only extracted what was visible)

---

### Boundary B3: Stage 2 → Stage 3 (EKOs Valid)

**Location**: Between Evidence Compiler and Knowledge Verification  
**Stage 3 Trusts**:

| Assumption | Meaning | Validation |
|-----------|---------|-----------|
| **Type validity** | All EKO types recognized | Type enumeration check |
| **Confidence range** | Confidence ∈ [0, 1] | Range validation |
| **Lineage complete** | All EKOs trace to evidence | Reference validation |
| **No inference** | Only extracted, never inferred | Content matching |
| **Immutability** | EKOs not modified | Checksum verification |

**Verification at B3**:
```
EKO Validation:
  ✓ Type in {capability, constraint, need, ...}
  ✓ Confidence in [0, 1]
  ✓ Source evidence exists
  ✓ Evidence ID is valid
  ✓ Content not inferred
```

**Stage 3 Does NOT Trust**:
- EKOs are accurate (that's what verification does)
- All sources are included (there may be others)
- EKO confidence is final (will be adjusted)

---

### Boundary B4: Stage 3 → Stage 4 (Verified EKOs)

**Location**: Between Knowledge Verification and Semantic Mapping  
**Stage 4 Trusts**:

| Assumption | Meaning | Validation |
|-----------|---------|-----------|
| **Verification complete** | All EKOs verified | Status check |
| **Conflicts resolved** | No contradictions remain | Conflict check |
| **Policies satisfied** | All rules complied with | Policy check |
| **Confidence updated** | Confidence reflects verification | Score validation |

**Verification at B4**:
```
Verification Status Check:
  ✓ Status in {verified, disputed, flagged, ...}
  ✓ If disputed: resolutions applied
  ✓ If flagged: human review noted
  ✓ Confidence updated (may have changed)
```

---

### Boundary B5: Stage 4 → Stage 5 (Canonical EKOs)

**Location**: Between Semantic Mapping and Enterprise Genome  
**Stage 5 Trusts**:

| Assumption | Meaning | Validation |
|-----------|---------|-----------|
| **Semantic mapping valid** | EKOs map to GBS concepts | Mapping check |
| **Aliases resolved** | Terminology standardized | Alias check |
| **Relationships valid** | Relationships follow rules | Relationship check |
| **Canonical forms deterministic** | Same content → same form | Hash verification |

**Verification at B5**:
```
Semantic Validation:
  ✓ GBS mapping exists
  ✓ Canonical concept valid
  ✓ Aliases consistent
  ✓ Relationships conform to GBS rules
```

---

### Boundary B6: Stage 5 → Stage 6 (Enterprise Genome)

**Location**: Between Enterprise Genome and Blueprint Projection  
**Stage 6 Trusts**:

| Assumption | Meaning | Validation |
|-----------|---------|-----------|
| **Graphs complete** | All entities represented | Entity count check |
| **Graphs consistent** | No contradictions | Consistency check |
| **References valid** | No dangling references | Reference check |
| **Authority established** | Identity graph is authoritative | Authorization check |

**Verification at B6**:
```
Genome Validation:
  ✓ Identity graph: all actors/resources included
  ✓ Capability graph: all capabilities defined
  ✓ Relationship graph: all relationships valid
  ✓ Organizational structure: hierarchy valid
  ✓ No dangling references
  ✓ Referential integrity maintained
```

---

### Boundary B7: Stage 6 → Stage 7 (Enterprise Blueprint)

**Location**: Between Blueprint Projection and Solution Projection  
**Stage 7 Trusts**:

| Assumption | Meaning | Validation |
|-----------|---------|-----------|
| **Blueprint valid** | All specifications correct | Schema check |
| **APIs specified** | All endpoints defined | API check |
| **Data models defined** | All models complete | Model check |
| **Workflows complete** | All processes specified | Workflow check |

**Verification at B7**:
```
Blueprint Validation:
  ✓ API specifications valid (OpenAPI/GraphQL)
  ✓ Data model schemas valid (JSON Schema)
  ✓ Workflow definitions complete
  ✓ Module contracts satisfied
  ✓ No ambiguities or gaps
```

---

### Boundary B8: Stage 7 → Stage 8 (Generated Systems)

**Location**: Between Solution Projection and Runtime Synchronization  
**Stage 8 Trusts**:

| Assumption | Meaning | Validation |
|-----------|---------|-----------|
| **Code compiles** | All code is syntactically valid | Compilation check |
| **Tests pass** | Generated tests all succeed | Test run check |
| **Deployable** | Code can be deployed | Deployment check |
| **Executable** | Systems can run | Execution check |

**Verification at B8**:
```
System Validation:
  ✓ TypeScript compilation succeeds
  ✓ ESLint passes (no style violations)
  ✓ All unit tests pass
  ✓ Integration tests pass
  ✓ Docker image builds
  ✓ Kubernetes manifests valid
  ✓ CI/CD pipelines configured
```

---

### Boundary B9: Stage 8 → Stage 1 (Observations → Evidence)

**Location**: Between Runtime Synchronization and Discovery (next cycle)  
**Stage 1 Trusts**:

| Assumption | Meaning | Validation |
|-----------|---------|-----------|
| **Observations valid** | Observations accurately captured | Format check |
| **Timestamps accurate** | When recorded | Timestamp check |
| **Metadata complete** | Context preserved | Metadata check |
| **Immutable** | Observations not modified | Checksum check |

**Verification at B9**:
```
Observation Validation:
  ✓ Valid observation format
  ✓ Timestamps are ISO 8601 UTC
  ✓ Metadata fields complete
  ✓ Actor/action references valid
  ✓ No retroactive modification
```

---

## Trust Boundary Violations

### What Happens When Assumptions Break?

#### Violation Type 1: Format Mismatch
**Scenario**: Stage N receives input in wrong format  
**Example**: Stage 2 receives non-JSON Evidence  
**Impact**: Processing fails  
**Recovery**: Error reported, processing halted  

#### Violation Type 2: Missing Invariant
**Scenario**: Invariant is not maintained  
**Example**: Stage 3 receives non-immutable EKOs  
**Impact**: Subsequent processing unreliable  
**Recovery**: Validation fails, error reported  

#### Violation Type 3: Reference Broken
**Scenario**: Reference points to non-existent entity  
**Example**: EKO references non-existent evidence  
**Impact**: Cannot trace lineage  
**Recovery**: Validation fails, error reported  

#### Violation Type 4: Determinism Lost
**Scenario**: Same input produces different output  
**Example**: Identities are non-deterministic  
**Impact**: Cannot compare/deduplicate  
**Recovery**: Hash mismatch detected, error reported  

---

## Trust Validation Checklist

### For Every Stage

**Before Processing**:
- [ ] Input schema is valid
- [ ] All required fields present
- [ ] All invariants checked
- [ ] All trust assumptions verified
- [ ] Diagnostics prepared

**During Processing**:
- [ ] All inputs consumed
- [ ] All invariants maintained
- [ ] No data loss
- [ ] Deterministic order
- [ ] Diagnostics recorded

**After Processing**:
- [ ] All outputs valid
- [ ] All invariants hold
- [ ] Lineage complete
- [ ] Determinism verified
- [ ] Diagnostics finalized

---

## Trust in Practice

### Example: Evidence IR Trust Boundary (B2)

**Stage 1 Output**:
```json
{
  "interviewId": "interview_abc123_v1",
  "sections": [{
    "questions": [{
      "id": "question_def456_v1",
      "question": "What is X?",
      "answer": "Answer text",
      "page": 1
    }]
  }]
}
```

**Stage 2 Trust Check**:
```
Input Validation:
  1. Parse JSON
     ✓ Valid JSON: YES
  
  2. Check schema
     ✓ interviewId present: YES
     ✓ sections array: YES
     ✓ questions array: YES
  
  3. Validate IDs
     ✓ interviewId format: interview_<hash>_v1
       Hash: abc123 (valid)
       Version: v1 (valid)
     ✓ questionId format: question_<hash>_v1
       Hash: def456 (valid)
       Version: v1 (valid)
  
  4. Verify determinism
     ✓ Recompute hash of answer text
       Original: "Answer text"
       Computed: def456
       Match: YES
  
  5. Check immutability
     ✓ No modification flags
     ✓ Checksum valid
  
  6. Verify provenance
     ✓ Page reference valid: 1
     ✓ Source traceable: YES

Result: ✓ TRUSTED - Processing continues
```

---

## Design Philosophy

### Trust But Verify

The Genesis pipeline uses a "**trust but verify**" model:

1. **Trust**: Stages trust the previous stage's output format
2. **Verify**: But always validate all assumptions
3. **Fail Fast**: If validation fails, report immediately
4. **No Silent Failures**: Every failure is diagnostic

### Explicit Boundaries

Trust boundaries are **explicit and documented**:

- What is trusted (listed)
- What is not trusted (listed)
- How to verify (validation rules)
- What to do if violated (error handling)

### Composability

Trust boundaries enable composability:

- Stages can be implemented independently
- As long as trust boundary is satisfied
- Can replace implementation without affecting others
- New implementations must meet same contract

---

## Conclusion

The Genesis Compiler maintains explicit, documented trust boundaries between every stage. These boundaries ensure:

✓ **Predictability** - What can be assumed at each stage  
✓ **Reliability** - Early detection of violations  
✓ **Composability** - Independent stage development  
✓ **Auditability** - Complete trust verification trail  

Every trust boundary is validated before processing, and any violation is immediately reported with diagnostics.

---

**TRUST_BOUNDARIES.md**  
**Part of GCS-0001 Genesis Compiler Specification**

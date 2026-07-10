# Genesis Compiler: Invariants

**Document**: GCS-0001 Supporting  
**Topic**: Compiler Invariants and Guarantees  
**Date**: 2026-07-10  

---

## What is an Invariant?

An **invariant** is a property that must be true:
- **At stage entry** (precondition)
- **During stage processing** (maintained)
- **At stage exit** (postcondition)

Invariants are **always enforced**. If an invariant is violated, processing halts with an error.

---

## Global Invariants (All Stages)

### I0: Immutability

**Definition**: No data is ever modified after creation.

**Applies To**: All artifacts at all stages.

**Implementation**:
- Original data never touched
- New artifacts created for all outputs
- Original stored in immutable ledger
- Checksums verify no tampering

**Verification**:
```
For every artifact:
  1. Compute checksum of original
  2. At any point, recompute checksum
  3. Must match: original ≡ stored
  4. If different: INVARIANT VIOLATED
```

**Example**:
```
Stage 1 creates Evidence IR:
  Original: "What is X?"
  ID: evidence_item_abc123_v1
  Checksum: <hash of "What is X?">

Stage 2 receives it:
  Recompute checksum of stored text
  Must match original checksum
  If not: ERROR (data corrupted)
```

---

### I1: Completeness

**Definition**: No data is lost in transformation.

**Applies To**: All transformations between stages.

**Implementation**:
- Input count ≥ output count (items may be deduplicated)
- All source information preserved in provenance
- Never drop an item without recording reason

**Verification**:
```
For every transformation:
  Input Count:  record total items received
  Output Count: record total items produced
  Deduplicated: count items merged
  Lost:         count items dropped (with reasons)
  
  Assert: output >= (input - deduplicated)
```

**Example**:
```
Stage 2 processes Evidence IR:
  Input: 22 evidence items
  Created EKOs: 22
  Expected: all 22 EKOs created
  Actual: 22 EKOs in output
  Result: ✓ COMPLETE
```

---

### I2: Traceability

**Definition**: Every output item traces completely to its source(s).

**Applies To**: All items at all stages.

**Implementation**:
- Provenance metadata stored with every item
- Provenance includes: source stage, source ID, timestamp
- Multi-source items include all sources

**Verification**:
```
For every output item:
  1. Check provenance field exists
  2. For each source reference:
     a. Source item exists in previous stage
     b. Reference ID is valid
     c. Content matches expected
  3. If any check fails: INVARIANT VIOLATED
```

**Example**:
```
Stage 3 EKO provenance:
{
  "ekoId": "eko_xyz_v1",
  "provenance": {
    "sourceStage": "stage_2",
    "sourceEKO": "eko_abc_v1",
    "sourceEvidence": "evidence_item_def_v1",
    "timestamp": "2026-07-10T00:00:00Z"
  }
}

Verification:
  ✓ Source EKO exists
  ✓ Source evidence exists
  ✓ Trace complete: Stage 3 ← Stage 2 ← Stage 1
```

---

### I3: Determinism

**Definition**: Same input always produces identical output.

**Applies To**: All stages that can run multiple times.

**Implementation**:
- Use deterministic algorithms only
- Sort collections consistently
- Use UTC timestamps (not local)
- Hash-based identities (not random)
- Canonical representations (GPS-0002)

**Verification**:
```
1. Run Stage with input data
2. Record output (JSON, files)
3. Run Stage again with same input
4. Compare outputs byte-for-byte
5. Must be identical:
   - Same JSON structure
   - Same field order
   - Same values
   - Same metadata
6. If different: INVARIANT VIOLATED
```

**Example**:
```
Determinism Test (Stage 2):
  Run 1: compileInterview(zach_interview.json)
    Output: evidence.set.json (hash: abc123...)
  
  Run 2: compileInterview(zach_interview.json)
    Output: evidence.set.json (hash: abc123...)
  
  Run 3: compileInterview(zach_interview.json)
    Output: evidence.set.json (hash: abc123...)
  
  Result: ✓ DETERMINISTIC (all hashes identical)
```

---

### I4: Consistency

**Definition**: No conflicting identities or contradictory data.

**Applies To**: Identities across all stages.

**Implementation**:
- Same content → same identity (no collisions)
- Identity immutable (once created, never changes)
- Different content → different identity

**Verification**:
```
For entire stage output:
  1. Collect all identities
  2. For each unique identity:
     a. Collect all items with that ID
     b. All must have identical content
     c. If content differs: COLLISION DETECTED
        → INVARIANT VIOLATED
  3. Result: identity map (ID → unique content)
```

---

### I5: Validity

**Definition**: All outputs pass structural and semantic validation.

**Applies To**: All artifacts at all stages.

**Implementation**:
- Schema validation (correct structure)
- Semantic validation (correct meaning)
- No invalid references
- All required fields present

**Verification**:
```
For every artifact:
  1. Validate schema
  2. Validate semantic rules
  3. Validate references
  4. If any fail: INVARIANT VIOLATED
```

---

## Stage-Specific Invariants

### Stage 1 (Discovery)

#### I1.1: Immutable Evidence IR

**Definition**: Evidence IR is immutable and never modified.

**Verification**:
```
After Stage 1:
  Evidence IR checksummed
  Stored with checksum
  Any read verifies checksum matches
```

#### I1.2: Complete Provenance

**Definition**: Every evidence item has complete provenance (source → page → block).

**Verification**:
```
For every evidence item:
  ✓ sourceFile exists
  ✓ sourceFile is accessible
  ✓ pageNumber is valid
  ✓ blockIndex is valid
```

#### I1.3: Deterministic Identities

**Definition**: Same source always produces identical IDs.

**Verification**:
```
Identity = evidence_item_<SHA-256(formType, content, questionId)>_v1

Run 1: compute identity from same source
Run 2: compute identity from same source
  → Identical IDs
```

#### I1.4: No Inference

**Definition**: Evidence IR contains only extracted, never inferred content.

**Verification**:
```
For every evidence item:
  ✓ Content is verbatim from source
  ✓ No summarization
  ✓ No interpretation
  ✓ No calculations
```

#### I1.5: Text Preservation

**Definition**: Original source text completely preserved.

**Verification**:
```
Source: "original text from PDF"
Extracted: "original text from PDF"
Compare: source.length == extracted.length
         AND textMatch (UTF-8 NFC normalized)
```

#### I1.6: Deterministic Ordering

**Definition**: Items processed in deterministic order (document order).

**Verification**:
```
Document order preserved:
  Page 1 → Page 2 → Page 3 → ...
  Block 1 → Block 2 → Block 3 → ...
  Q1 → Q2 → Q3 → ...
```

#### I1.7: No Duplication

**Definition**: No duplicate evidence items created.

**Verification**:
```
For all pairs of evidence items:
  If ID1 == ID2: content1 must equal content2
  If content1 != content2: ID1 must not equal ID2
```

#### I1.8: Collection Consistency

**Definition**: All collections in Evidence IR have consistent structure.

**Verification**:
```
For every collection:
  ✓ Type is valid (document, interview, result)
  ✓ Items array valid
  ✓ Metadata complete
  ✓ Relationships valid
```

---

### Stage 2 (Evidence Compiler)

#### I2.1: Type Correctness

**Definition**: Every EKO has a valid, recognized type.

**Verification**:
```
EKO type ∈ {capability, constraint, decision, need,
             pain_point, measurement, interaction,
             obstacle, opportunity, context,
             assumption, strategy}
```

#### I2.2: Confidence Range

**Definition**: Every EKO has confidence in range [0, 1].

**Verification**:
```
For every EKO:
  0.0 <= confidence <= 1.0
  confidence is number (not string)
```

#### I2.3: Complete Lineage

**Definition**: Every EKO traces to source evidence.

**Verification**:
```
For every EKO:
  ✓ sourceEvidenceId exists
  ✓ Source evidence accessible
  ✓ Can reconstruct how EKO created
```

#### I2.4: No Inference

**Definition**: EKOs extracted, not inferred.

**Verification**:
```
EKO content must be found in source evidence
  Source: "can create graphics"
  EKO: "Capability: create graphics"
  ✓ Content extracted (not inferred)
```

#### I2.5: Content Preservation

**Definition**: Original evidence content preserved in EKO.

**Verification**:
```
Source content subseteq EKO content
  (EKO may add structure, never remove or change core content)
```

#### I2.6: Determinism

**Definition**: Same evidence always produces same EKOs.

**Verification**:
```
Same input → same EKOs (same types, same confidence)
```

#### I2.7: Identity Stability

**Definition**: EKO ID doesn't change (same EKO = same ID).

**Verification**:
```
EKO = { type, canonicalContent, sourceEvidenceId, confidence }
ID = hash(EKO content)
→ Same content = same ID (stable)
```

#### I2.8: Immutability

**Definition**: EKOs don't change after creation.

**Verification**:
```
Original EKO checksum verified at every access
```

---

### Stage 3 (Knowledge Verification)

#### I3.1: Verification Complete

**Definition**: All EKOs have verification status.

**Verification**:
```
For every EKO:
  status ∈ {verified, disputed, flagged, unverified}
```

#### I3.2: Conflicts Resolved

**Definition**: No unresolved conflicts remain.

**Verification**:
```
Conflict Check:
  For pairs of EKOs that contradict:
    At least one must be marked disputed/flagged
    OR one must be removed
    OR resolution documented
```

#### I3.3: Policy Compliance

**Definition**: Verified EKOs comply with all policies.

**Verification**:
```
For every policy rule:
  For every verified EKO:
    Apply rule
    If rule violated: mark disputed or flag
```

#### I3.4: Confidence Valid

**Definition**: Updated confidence in [0, 1].

**Verification**:
```
For every EKO:
  originalConfidence: number in [0, 1]
  verifiedConfidence: number in [0, 1]
  verifiedConfidence >= 0 and verifiedConfidence <= 1
```

#### I3.5: Lineage Preserved

**Definition**: Verification maintains complete lineage.

**Verification**:
```
For every verified EKO:
  ✓ Original source references preserved
  ✓ Verification actions logged
  ✓ Can reconstruct verification process
```

#### I3.6: Determinism

**Definition**: Same input produces same verification results.

**Verification**:
```
Run 1: verify(EKO set) → verification results
Run 2: verify(EKO set) → same results
```

---

### Stage 4 (Semantic Mapping)

#### I4.1: Semantic Mapping Valid

**Definition**: Every EKO maps to valid GBS concept.

**Verification**:
```
For every EKO:
  gbsMapping exists
  gbsMapping ID is valid
  GBS concept defined and accessible
```

#### I4.2: Alias Consistency

**Definition**: Aliases resolve deterministically.

**Verification**:
```
For every alias resolution:
  "design" → canonical "design" (always)
  "graphics" → canonical "visual_content" (always)
  Run 1 mappings ≡ Run 2 mappings
```

#### I4.3: Relationship Validity

**Definition**: Relationships follow GBS rules.

**Verification**:
```
For every relationship:
  Relationship type valid (owns, has, creates, etc.)
  Actor-capability relationships valid (1:many)
  No invalid relationship combinations
```

#### I4.4: Canonical Form

**Definition**: Deterministic canonical representation created.

**Verification**:
```
canonicalForm = normalize(EKO content)
Run 1: canonicalForm_1
Run 2: canonicalForm_2
  → canonicalForm_1 ≡ canonicalForm_2
```

#### I4.5: Immutability

**Definition**: Canonical EKOs immutable.

**Verification**:
```
Checksum verification on access
```

#### I4.6: Determinism

**Definition**: Same input produces same canonical mapping.

**Verification**:
```
Same verified EKOs → same canonical EKOs
```

---

### Stage 5 (Enterprise Genome)

#### I5.1: Graph Consistency

**Definition**: No contradictions in graphs.

**Verification**:
```
Contradiction check:
  If A owns B and B owns A: ERROR
  If Actor X works for Y and X manages Y: ERROR
  If Capability requires Resource R but R doesn't have it: ERROR
```

#### I5.2: Referential Integrity

**Definition**: All references point to existing entities.

**Verification**:
```
For every edge/reference:
  fromNode exists
  toNode exists
  relationship type valid
```

#### I5.3: Completeness

**Definition**: All entities represented in genome.

**Verification**:
```
Count entities in genome
Count canonical EKOs
  Should be: genome entities >= EKOs
  (may deduplicate in genome creation)
```

#### I5.4: Determinism

**Definition**: Same EKOs produce same genome.

**Verification**:
```
Run 1: genome from EKO set
Run 2: genome from EKO set
  → Identical structure
```

#### I5.5: Identity Authority

**Definition**: Identity graph is authoritative.

**Verification**:
```
Identity graph is single source of truth:
  If entity not in identity graph: doesn't exist
  All capabilities tied to authoritative identities
  All relationships reference authoritative entities
```

#### I5.6: Immutability

**Definition**: Genome structure immutable.

**Verification**:
```
Once created, genome not modified
Only new genomes created
Original archived
```

---

### Stage 6 (Blueprint Projection)

#### I6.1: Domain Validity

**Definition**: Projections valid for domain.

**Verification**:
```
For every domain projection:
  Domain is recognized (CRM, ERP, HR, etc.)
  Entities relevant to domain included
  Irrelevant entities excluded
```

#### I6.2: Non-Overlap

**Definition**: Domains don't share entities.

**Verification**:
```
For each pair of domains:
  Intersection of entities: empty
  (Each entity belongs to exactly one domain)
```

#### I6.3: Contract Compliance

**Definition**: APIs satisfy contracts.

**Verification**:
```
For every API:
  Endpoints defined
  Schemas defined
  No ambiguities
  Specification complete
```

#### I6.4: Completeness

**Definition**: All entities projected.

**Verification**:
```
For each entity in genome:
  Must be projected to some domain
  OR explicitly marked as non-projected
  (No entities dropped without reason)
```

#### I6.5: Consistency

**Definition**: No contradictions.

**Verification**:
```
Domain consistency:
  Same entity in different projections has compatible specs
  API contracts don't conflict
  Data models consistent
```

#### I6.6: Determinism

**Definition**: Same genome produces same blueprint.

**Verification**:
```
Run 1: blueprint from genome
Run 2: blueprint from genome
  → Identical specs
```

---

### Stage 7 (Solution Projection)

#### I7.1: Code Compiles

**Definition**: Generated code compiles without errors.

**Verification**:
```
For each generated file:
  $ typescript --noEmit
  Result: success (0 errors, 0 warnings)
```

#### I7.2: Lint Passing

**Definition**: Code passes style checks.

**Verification**:
```
For each generated file:
  $ eslint <file>
  Result: success (0 violations)
```

#### I7.3: Tests Pass

**Definition**: Generated tests all pass.

**Verification**:
```
For each test suite:
  $ jest
  Result: success (all tests pass)
```

#### I7.4: Complete Implementation

**Definition**: All blueprints implemented.

**Verification**:
```
For every module in blueprint:
  Generated code exists
  For every API endpoint:
    Implementation generated
  For every data model:
    Schema and migration generated
```

#### I7.5: Determinism

**Definition**: Same blueprint produces same code.

**Verification**:
```
Run 1: generateCode(blueprint)
Run 2: generateCode(blueprint)
  → Identical source files
```

#### I7.6: Traceability

**Definition**: Code traces to blueprint.

**Verification**:
```
For every function:
  Can trace to capability in blueprint
  Can trace to API endpoint in blueprint
  Lineage preserved in comments
```

---

### Stage 8 (Runtime)

#### I8.1: Execution Correctness

**Definition**: Systems run as designed.

**Verification**:
```
For each system:
  $ systemctl status
  Result: running
  $ health-check
  Result: healthy
```

#### I8.2: Observation Completeness

**Definition**: All significant events recorded.

**Verification**:
```
Event check:
  System errors → observation recorded
  User actions → observation recorded
  State changes → observation recorded
  Performance events → observation recorded
```

#### I8.3: Feedback Traceability

**Definition**: Observations trace to actions.

**Verification**:
```
For every observation:
  ✓ Actor identified
  ✓ Action identified
  ✓ Result recorded
  ✓ Timestamp accurate
```

#### I8.4: Immutable Records

**Definition**: Observations never modified.

**Verification**:
```
Immutable log:
  Append-only
  Checksummed
  Timestamped
```

#### I8.5: Continuous Learning

**Definition**: New evidence feeds back to pipeline.

**Verification**:
```
Feedback loop:
  Observations → Evidence IR
  Evidence IR → Stage 1 (next cycle)
  New cycle processes new evidence
```

#### I8.6: Non-Intrusive

**Definition**: Observation doesn't disrupt operation.

**Verification**:
```
Performance impact:
  Observation overhead < 1%
  No performance degradation
  No user impact
```

---

## Cross-Stage Invariant Relationships

### How Invariants Flow Through Stages

```
Stage 1 Output (Evidence IR):
  ✓ I1.1: Immutable
  ✓ I1.2: Complete provenance
  ✓ I1.3: Deterministic identities
  ↓ (B2 validates all invariants)

Stage 2 Input (verified Evidence IR):
  ← I1.1 implies I2.1 (structure valid)
  ← I1.2 implies I2.3 (lineage complete)
  ← I1.3 implies I2.6 (determinism maintained)

Stage 2 Output (EKOs):
  ✓ I2.1: Type correctness
  ✓ I2.2: Confidence range
  ↓ (B3 validates all invariants)

Stage 3 Input (verified EKOs):
  ← I2.1 implies I3.1 (verification possible)
  ← I2.2 implies I3.4 (confidence valid)

... and so on through all stages
```

---

## Invariant Verification Process

### When is Verification Done?

```
AT STAGE ENTRY:
  ✓ Verify input invariants (from previous stage)
  ✓ All checks must pass before processing
  ✗ If check fails: halt with diagnostic

DURING PROCESSING:
  ✓ Maintain invariants throughout
  ✓ No invariants violated mid-process
  ✗ If violation detected: rollback, halt

AT STAGE EXIT:
  ✓ Verify output invariants
  ✓ All checks must pass before output
  ✗ If check fails: halt with diagnostic
```

---

## What Happens When Invariant Fails?

### Error Classification

| Severity | Type | Action |
|----------|------|--------|
| FATAL | Core invariant violated (I1-I5) | Stop immediately, report |
| MAJOR | Stage-specific invariant violated | Stop stage, report, rollback |
| MINOR | Validation warning | Log warning, may continue |

### Example: Immutability Invariant Failure

```
Stage 2 processing:
  1. Create EKO from evidence item
  2. Store EKO with checksum
  3. Later, verify checksum
  4. Checksum doesn't match!
  
Diagnostic:
  ✗ INVARIANT VIOLATION: I2.8 (Immutability)
  EKO ID: eko_xyz123_v1
  Expected checksum: abc...
  Actual checksum: def...
  
  Possible causes:
    - Memory corruption
    - Storage failure
    - Unauthorized modification
    - Software bug
  
  Action:
    → STOP processing
    → Report error with full context
    → Do NOT attempt recovery
    → Manual investigation required
```

---

## Conclusion

The Genesis Compiler maintains **five global invariants** and **48+ stage-specific invariants** to ensure:

✓ **Reliability**: Data never lost or corrupted  
✓ **Traceability**: Complete audit trail from reality  
✓ **Consistency**: No contradictions or anomalies  
✓ **Determinism**: Reproducible results  
✓ **Validity**: All outputs structurally sound  

Every invariant is:
- **Explicit** (clearly defined)
- **Verifiable** (can be checked)
- **Enforceable** (failures halt processing)
- **Recoverable** (failures reported with diagnostics)

---

**COMPILER_INVARIANTS.md**  
**Part of GCS-0001 Genesis Compiler Specification**

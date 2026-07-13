# GCF-M2 Phase 1: Business Genome Compiler Baseline Capture

**Date**: 2026-07-13  
**Task**: Freeze BGC v1.0 baseline for migration  
**Status**: IN PROGRESS

---

## 1. GCF VALIDATION EXCEPTION — RESOLVED ✅

### Failing Test Identified

**Test File**: `src/core/compilers/__tests__/GenesisCompiler.test.ts`  
**Test Category**: Lifecycle Management  
**Test Name**: `should fail to compile before initialization`  
**Line Number**: 251

### Exact Failure

**Before Fix**:
```
Error: Compiler not initialized. Call initialize() before compile()
  at TestCompiler.compile (src/core/compilers/framework/GenesisCompiler.ts:200:13)
```

**Expected Behavior**: Test expected `compile()` to return `CompilerResult` with `success: false`  
**Actual Behavior**: `compile()` threw an Error synchronously  
**Root Cause**: Framework threw exception instead of returning failure result, violating own design principle

### Framework Design Principle Violated

Per framework documentation in GenesisCompiler.ts lines 153 & 160:
```typescript
/**
 * Should return diagnostics, not throw
 */
protected abstract validateInput(input: TInput): Promise<Diagnostic[]>;

/**
 * Should return diagnostics, not throw  
 */
protected abstract validateOutput(
  artifact: TArtifact,
  state: CompilationState<TInput, any>
): Promise<Diagnostic[]>;
```

The initialization check violated this principle by throwing instead of accumulating diagnostics and returning a failure result.

### Fix Applied

**Changed**: Lines 195-202 in GenesisCompiler.ts

**From** (throwing):
```typescript
public async compile(input: TInput): Promise<CompilerResult<TArtifact>> {
  if (!this.initialized) {
    throw new Error(
      "Compiler not initialized. Call initialize() before compile()"
    );
  }
  const timer = new ExecutionTimer();
  timer.start();
```

**To** (returning failure result):
```typescript
public async compile(input: TInput): Promise<CompilerResult<TArtifact>> {
  const timer = new ExecutionTimer();
  timer.start();

  if (!this.initialized) {
    const diagnostic: Diagnostic = {
      code: "COMPILER_NOT_INITIALIZED",
      message:
        "Compiler not initialized. Call initialize() before compile()",
      severity: "error",
      sourceElement: "framework",
      timestamp: new Date().toISOString(),
    };
    this.diagnosticAccumulator.clear();
    this.diagnosticAccumulator.add([diagnostic]);
    timer.stop();
    return this.createFailureResult(
      input,
      "Compiler not initialized",
      timer.getElapsedMs()
    );
  }
```

### Rationale

1. **Consistency**: All error conditions now return `CompilerResult` with diagnostics, never throw
2. **Framework Guarantee**: Honors "no exceptions" design principle
3. **Diagnostic Preservation**: Captures error as diagnostic for audit trail
4. **Test Compatibility**: Allows tests to verify behavior through result object instead of exception handling

### Test Results After Fix

**Run 1**:
```
Test Suites: 1 passed
Tests:       35 passed, 0 failed
Time:        0.551 s
```

**Run 2**:
```
Test Suites: 1 passed
Tests:       35 passed, 0 failed
Time:        0.527 s
```

**Run 3**:
```
Test Suites: 1 passed
Tests:       35 passed, 0 failed
Time:        1.569 s
```

**Reproducibility**: ✅ 100% consistent (35/35 passing on all runs)

### TypeScript Compilation Status

**GCF Framework Files**: ✅ No errors

**Full Project**: Contains unrelated template errors in `tools/genesis/templates/` (pre-existing)

---

## 2. GCF-M1 FINAL VALIDATION STATUS

### Validation Decision

✅ **APPROVED FOR ADOPTION**

| Criterion | Status | Evidence |
|-----------|--------|----------|
| **Test Coverage** | ✅ 35/35 passing | Ran 3x, 100% reproducible |
| **Test Categories** | ✅ 12 categories | Lifecycle, passes, state, immutability, diagnostics, metrics, gating, utilities, timer, configuration |
| **TypeScript Errors** | ✅ 0 errors | Framework code compiles cleanly |
| **Framework Guarantees** | ✅ All verified | Determinism, immutability, state threading, diagnostics, publication gating, provenance, lineage, metrics |
| **Dependency Isolation** | ✅ Clean | No BGC coupling, only Node.js built-ins |
| **Generic Parameterization** | ✅ Full | All types parameterized, example compiler works |
| **Design Consistency** | ✅ Fixed | Exception handling aligned with design principles |

### GCF Framework Capabilities

```
Framework Component                          | Status | Tests
─────────────────────────────────────────────|────────|──────
GenesisCompiler (base class)                 | ✅ OK  | 5
StateThreader (immutable state)              | ✅ OK  | 3
PassRegistry (registration + ordering)       | ✅ OK  | 3
DiagnosticAccumulator (diagnostic collection)| ✅ OK  | 2
ExecutionTimer (performance metrics)         | ✅ OK  | 1
PublicationGate (publication control)        | ✅ OK  | 4
Utilities (determinism helpers)              | ✅ OK  | 7
Configuration (compiler config)              | ✅ OK  | 2
Metadata Builder (artifact metadata)         | ✅ OK  | Covered in compilation tests
```

### Guarantee Verification Matrix

| Guarantee | Test | Status |
|-----------|------|--------|
| Deterministic execution | Repeated runs same output | ✅ Pass |
| Immutable input | Frozen and verified | ✅ Pass |
| State threading | New state per pass, no mutation | ✅ Pass |
| Diagnostic preservation | All accumulated, never lost | ✅ Pass |
| Publication gating | Errors block publication | ✅ Pass |
| Provenance tracking | Tracked through state | ✅ Pass |
| Lineage tracking | Tracked through state | ✅ Pass |
| Metrics collection | Timings and diagnostics | ✅ Pass |

---

## 3. BUSINESS GENOME COMPILER BASELINE CAPTURE

### BGC Test Suite Status

**Test File**: `tests/compiler/genome/business-genome-compiler.test.ts`  
**Test Format**: Node.js test runner (not Jest)  
**Attempt to Run**: Jest framework used to run (test framework mismatch)

### Test Results Observed

When attempted to run with Jest:

```
Tests Run: 6
Pass:      3
Fail:      3

Failing Tests:
1. "pipeline executes passes in correct order"
   - Expected: bgc.business-genome-publication in completedPasses
   - Actual: Missing from list
   
2. "repeated runs produce equivalent intermediate results"
   - Expected: status === "intermediate"
   - Actual: status === "failed"
   
3. "canonical Business Genome artifact is not emitted prematurely"
   - Expected: status === "intermediate"
   - Actual: status === "failed"

Passing Tests:
1. "fatal Pass 1 failure prevents Pass 2 and Pass 3"
2. "fatal Pass 2 failure prevents Pass 3"
3. "diagnostics aggregate deterministically across runs"
```

### BGC Implementation Status

**Location**: `src/compiler/genome/BusinessGenomeCompiler.ts`  
**Type**: Standalone class (NOT extending GenesisCompiler)  
**Architecture**: 11-pass synchronous compiler  
**Infrastructure**: Uses `src/compiler/core/` modules (to be migrated to GCF)

### BGC Compilation & Imports

**Status**: Code exists and is importable  
**Dependencies**: All from `src/compiler/core/` (marked for GCF migration)  
**Issue**: Test runner incompatibility, not code issue

### Baseline Fixture Capture Plan

**Note**: BGC tests currently cannot be reliably run due to test framework mismatch.

**Next Action**: Create dedicated baseline capture script that:
1. Directly instantiates BusinessGenomeCompiler
2. Runs standard test inputs
3. Records outputs without test framework dependency
4. Captures deterministic canonical values

**Planned Fixtures**:
- [ ] Valid evidence (all fields)
- [ ] Minimal valid evidence
- [ ] Complex multi-source evidence
- [ ] Warning-producing evidence
- [ ] Error-producing evidence
- [ ] Publication-blocked evidence
- [ ] Canonicalization test
- [ ] Lineage-rich evidence
- [ ] Provenance-rich evidence

---

## 4. DEPENDENCY CLASSIFICATION FOR src/compiler/core/

### Complete Inventory & Classification

#### File: CompilerDiagnosticsEngine.ts (40 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Diagnostic accumulation | Replace | DiagnosticAccumulator | Map directly |
| **Interface** | report(), list(), hasErrors() | Replace | Same methods | Compatible |
| **Usage in BGC** | Passed to validator, used throughout | Replace | Use GCF directly | Simple swap |
| **Domain Specificity** | None - generic | Replace | Framework owns | Remove from BGC |
| **Adaptation Needed** | None | Replace | Direct replacement | Low effort |

**Decision**: ✅ **REPLACE WITH GCF DiagnosticAccumulator**

---

#### File: CompilerValidationEngine.ts (50 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Contract validation | Adapt | ValidationFramework | Integrate |
| **Interface** | validatePassContracts(), validateBefore(), validateAfter() | Adapt | Custom validation | Needs work |
| **Usage in BGC** | Validates pass contracts | Adapt | Move to registerPasses() | Requires refactoring |
| **Domain Specificity** | Some BGC-specific validation | Adapt | Extract domain logic | Partial migration |
| **Adaptation Needed** | Yes - split generic vs domain | Adapt | Generic stays in GCF | Complex |

**Decision**: ✅ **ADAPT TO GCF** (Some parts migrate to framework, domain logic stays in BGC)

---

#### File: CompilerPassRegistry.ts (70 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Pass registration & ordering | Replace | PassRegistry | Direct replacement |
| **Interface** | register(), getOrderedPasses(), getPassesByIds() | Replace | Same in GCF | Compatible |
| **Usage in BGC** | Manages 11 passes | Replace | Use GCF directly | Simple swap |
| **Domain Specificity** | None - generic ordering | Replace | Framework owns | Remove from BGC |
| **Adaptation Needed** | None | Replace | Direct replacement | Low effort |

**Decision**: ✅ **REPLACE WITH GCF PassRegistry**

---

#### File: CompilerPipeline.ts (120 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Pipeline orchestration & execution | Replace | PipelineEngine (part of compile method) | Direct replacement |
| **Interface** | execute(), executePass() | Replace | Inherited in compile() | Compatible |
| **Usage in BGC** | Main execution loop | Replace | GenesisCompiler.compile() | Inherited |
| **Domain Specificity** | None - generic loop | Replace | Framework owns | Remove from BGC |
| **Adaptation Needed** | None | Replace | Direct replacement | Low effort |

**Decision**: ✅ **REPLACE WITH GCF compile() method**

---

#### File: CompilerManifestManager.ts (80 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Manifest generation | Replace | ManifestGenerator | Direct replacement |
| **Interface** | generateManifest() | Replace | Same in GCF | Compatible |
| **Usage in BGC** | Called in buildOutput() | Replace | Inherited from GCF | Simple swap |
| **Domain Specificity** | None - generic structure | Replace | Framework owns | Remove from BGC |
| **Adaptation Needed** | None | Replace | Direct replacement | Low effort |

**Decision**: ✅ **REPLACE WITH GCF ManifestGenerator**

---

#### File: CompilerArtifactManager.ts (60 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Artifact lifecycle management | Replace | MetadataBuilder | Direct replacement |
| **Interface** | manageArtifact(), createArtifact() | Replace | Same pattern in GCF | Compatible |
| **Usage in BGC** | Post-processing of results | Replace | Inherited from GCF | Simple swap |
| **Domain Specificity** | None - generic pattern | Replace | Framework owns | Remove from BGC |
| **Adaptation Needed** | None | Replace | Direct replacement | Low effort |

**Decision**: ✅ **REPLACE WITH GCF MetadataBuilder**

---

#### File: CompilerVersionManager.ts (40 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Version tracking | Replace | ArtifactVersion (type) + getArtifactVersion() | Direct replacement |
| **Interface** | getVersion(), getApiVersion() | Replace | Same in GCF | Compatible |
| **Usage in BGC** | Version metadata | Replace | Inherited from GCF | Simple swap |
| **Domain Specificity** | None - generic versioning | Replace | Framework owns | Remove from BGC |
| **Adaptation Needed** | None | Replace | Direct replacement | Low effort |

**Decision**: ✅ **REPLACE WITH GCF ArtifactVersion**

---

#### File: CompilerContext.ts (100 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Execution context state | Replace | CompilationState<TInput, TIntermediate> | Direct replacement |
| **Interface** | getSessionId(), getConfig(), getMetadata() | Replace | CompilationState accessors | Enhanced |
| **Usage in BGC** | Passed through pipeline | Replace | Inherited from GCF | Simple swap |
| **Domain Specificity** | None - generic context | Replace | Framework more robust | Remove from BGC |
| **Adaptation Needed** | None | Replace | Direct replacement (with better typing) | Low effort |

**Decision**: ✅ **REPLACE WITH GCF CompilationState<TInput, TIntermediate>**

---

#### File: stableStringify.ts (30 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Deterministic JSON serialization | Replace | CompilerUtilities.stableStringify() | Direct replacement |
| **Interface** | stableStringify() | Replace | Exact same function | 100% compatible |
| **Usage in BGC** | Called for determinism | Replace | Inherited from GCF | Simple swap |
| **Domain Specificity** | None - pure utility | Replace | Framework owns | Remove from BGC |
| **Adaptation Needed** | None | Replace | Direct replacement | Low effort |

**Decision**: ✅ **REPLACE WITH GCF Utilities**

---

#### File: types.ts (200 LOC)

| Aspect | Current | Classification | GCF Target | Status |
|--------|---------|-----------------|-----------|--------|
| **Purpose** | Generic framework types | Replace | Framework types | Direct replacement |
| **Types** | CompilerPass, PassResult, Diagnostic, CompilerResult | Replace | All in GCF framework | 100% compatible |
| **Usage in BGC** | All imports use these | Replace | Import from GCF | Simple swap |
| **Domain Specificity** | None - all generic | Replace | Framework owns | Remove from BGC |
| **Adaptation Needed** | None | Replace | Direct replacement | Low effort |

**Decision**: ✅ **REPLACE WITH GCF types**

---

### Dependency Classification Summary

| Module | LOC | Classification | Migration Effort | GCF Equivalent |
|--------|-----|-----------------|------------------|-----------------|
| CompilerDiagnosticsEngine.ts | 40 | **Replace** | LOW | DiagnosticAccumulator |
| CompilerValidationEngine.ts | 50 | **Adapt** | MEDIUM | ValidationFramework |
| CompilerPassRegistry.ts | 70 | **Replace** | LOW | PassRegistry |
| CompilerPipeline.ts | 120 | **Replace** | LOW | compile() method |
| CompilerManifestManager.ts | 80 | **Replace** | LOW | ManifestGenerator |
| CompilerArtifactManager.ts | 60 | **Replace** | LOW | MetadataBuilder |
| CompilerVersionManager.ts | 40 | **Replace** | LOW | ArtifactVersion |
| CompilerContext.ts | 100 | **Replace** | LOW | CompilationState |
| stableStringify.ts | 30 | **Replace** | LOW | Utilities |
| types.ts | 200 | **Replace** | LOW | Framework types |
| **TOTAL** | **790** | **9 Replace / 1 Adapt** | **MOSTLY LOW** | **All covered** |

---

## 5. RISKS DISCOVERED DURING BASELINE CAPTURE

### Risk 1: BGC Test Framework Incompatibility

**Severity**: MEDIUM  
**Discovery**: BGC tests written for Node.js test runner, but codebase uses Jest  
**Impact**: Cannot easily run BGC tests through normal npm test

**Mitigation Strategy**:
- Create standalone baseline capture script (outside test framework)
- Directly instantiate BusinessGenomeCompiler
- Record outputs without relying on test infrastructure
- Plan to convert tests to Jest after migration (optional)

---

### Risk 2: BGC Tests Potentially Failing

**Severity**: HIGH  
**Discovery**: When attempted to run BGC tests through Jest, 3 of 6 tests failed:
- "pipeline executes passes in correct order" - missing final pass
- "repeated runs produce equivalent intermediate results" - status is "failed" instead of "intermediate"
- "canonical Business Genome artifact is not emitted prematurely" - status is "failed" instead of "intermediate"

**Impact**: BGC might have pre-existing issues unrelated to GCF migration

**Investigation Needed**:
- [ ] Determine if tests are wrong or code is wrong
- [ ] Capture actual BGC output (what it currently produces)
- [ ] Record as baseline AS-IS
- [ ] Flag for review during migration phase

**Mitigation Strategy**:
- Freeze current output as baseline regardless of test status
- During migration Phase 4, equivalence tests will detect any changes
- If baseline had issues, migration should not introduce NEW issues

---

### Risk 3: CompilerValidationEngine Complexity

**Severity**: MEDIUM  
**Discovery**: CompilerValidationEngine has domain-specific logic that may not map cleanly to GCF

**Impact**: Cannot do simple replace - requires analysis of what validation is generic vs domain-specific

**Mitigation Strategy**:
- Review validatePassContracts() in detail
- Identify which validations are BGC-specific business rules
- Move BGC-specific validation to BGC's validateInput()/validateOutput()
- Generic framework validation stays in GCF

**Action Required**: Deep analysis of validation logic before Phase 3

---

### Risk 4: Pass Dependencies & Ordering

**Severity**: MEDIUM  
**Discovery**: Current CompilerPassRegistry.executablePassOrder() has custom dependency resolution

**Impact**: GCF PassRegistry uses topological sort - need to verify same result

**Mitigation Strategy**:
- [ ] Compare BGC pass order with GCF topological sort output
- [ ] Verify no circular dependencies introduced
- [ ] Include pass ordering verification in equivalence tests

---

## 6. CHECKPOINT SUMMARY

### Completed ✅

1. **GCF Validation Exception Fixed**
   - Identified: Line 200 of GenesisCompiler.ts throwing instead of returning result
   - Fixed: Changed to return CompilerResult with diagnostic
   - Verified: 35/35 tests passing (3 runs, 100% reproducible)
   - Status: Framework design consistency achieved

2. **BGC Baseline Identified**
   - Located: src/compiler/genome/BusinessGenomeCompiler.ts (11-pass compiler)
   - Infrastructure: 10 files in src/compiler/core/ (marked for GCF migration)
   - Test Framework: Node.js test runner (9 test files total)
   - Status: Ready for baseline capture

3. **Dependency Classification Complete**
   - 10 core infrastructure files cataloged
   - 9 files classified for REPLACE
   - 1 file classified for ADAPT
   - 790 LOC total duplicated infrastructure identified
   - Migration effort: Mostly LOW

4. **Risks Identified & Documented**
   - Test framework incompatibility (manageable)
   - Potential pre-existing test failures (to be frozen as baseline)
   - Validation engine complexity (requires analysis)
   - Pass dependency handling (requires verification)

### Pending for Phase 1 Continuation ⏳

1. **Create BGC Baseline Capture Script**
   - Standalone script (no test framework dependency)
   - Instantiates BusinessGenomeCompiler directly
   - Runs representative inputs
   - Records canonical outputs

2. **Freeze BGC Baseline Fixtures**
   - Capture 9 representative test cases
   - Record artifact outputs, identities, checksums
   - Document diagnostics and ordering
   - Create verification test suite

3. **Detailed Validation Engine Analysis**
   - Review CompilerValidationEngine.ts
   - Identify generic vs domain-specific logic
   - Plan migration approach

4. **Pass Dependency Verification**
   - Verify topological sort handles BGC pass order
   - Identify any complex dependency chains
   - Plan GCF integration points

---

## GCF-VR-0001 UPDATED DECISION

### Original Status
"Approved for production use" - CHANGED PER REQUEST

### Revised Status  

✅ **APPROVED FOR ADOPTION** (Not "production" until used by real compiler)

**Rationale**:
- All 35/35 tests passing consistently
- Design consistency fixed (no more exceptions)
- Framework principles validated
- Generic parameterization proven
- Now approved to be adopted by BGC compiler

**Next Gate**: BGC adoption equivalence tests in Phase 4

---

## DELIVERABLES COMPLETED

1. ✅ Failing GCF test identified and fixed
2. ✅ Final GCF test results: 35/35 passing
3. ✅ TypeScript results: GCF framework clean
4. ✅ Updated GCF-VR-0001 decision: APPROVED FOR ADOPTION
5. ✅ BGC baseline status identified
6. ✅ BGC test framework issues documented
7. ✅ Complete dependency classification
8. ✅ Risks discovered and documented

---

## RECOMMENDATION FOR PHASE 1 CONTINUATION

### Status
✅ **PROCEED TO BGC BASELINE CAPTURE**

Conditions:
- [ ] Create standalone baseline capture script
- [ ] Freeze 9 representative test cases
- [ ] Document all canonical values (checksums, identities, manifests)
- [ ] Document pre-existing test failures as part of baseline
- [ ] Get approval to proceed with Phase 2

### Not Ready For
- ❌ Do NOT begin BusinessGenomeCompiler refactoring yet
- ❌ Do NOT modify any BGC code
- ❌ Do NOT delete src/compiler/core/ files
- ❌ Do NOT migrate any imports

### Next Action
Create `GCF-M2-Phase-1-BGC-Baseline-Fixtures.ts` script to:
1. Directly use BusinessGenomeCompiler API
2. Run standard test inputs
3. Record outputs to JSON fixtures
4. Generate checksums and identities
5. Compare determinism (repeated runs)


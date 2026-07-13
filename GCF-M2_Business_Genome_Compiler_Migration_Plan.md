# GCF-M2: Business Genome Compiler Migration Plan

**Program**: Genesis OS  
**Milestone**: GCF-M2 — Migrate Business Genome Compiler to Genesis Compiler Framework  
**Version**: 1.0  
**Date**: 2026-07-13  
**Status**: PLANNING PHASE — AWAITING APPROVAL

---

## EXECUTIVE SUMMARY

This document details the complete migration of the Business Genome Compiler (BGC) from a standalone implementation to an extension of the Genesis Compiler Framework (GCF). The migration will:

- **Eliminate duplicated infrastructure** (790 LOC currently in `src/compiler/core/`)
- **Achieve ~50% reduction** in BGC infrastructure code
- **Maintain 100% API compatibility** with existing clients
- **Preserve all business logic** unchanged
- **Complete in 4-5 days** with proper planning

**Key Guarantee**: External API remains identical. Only internal implementation changes.

---

## 1. BASELINE & SCOPE

### Current State (v1.0 Business Genome Compiler)

```
BGC Implementation:
├── src/compiler/genome/          (2,750 LOC — domain logic)
├── src/compiler/core/            (790 LOC — infrastructure)
├── tests/compiler/genome/        (16+ test files)
└── src/compiler/evidence/        (Separate — Evidence IR)

Total Affected LOC: 3,540
Infrastructure to Remove: 790 LOC
Domain Logic to Keep: 2,750 LOC
```

### Migration Target (BGC on GCF-M1)

```
BGC Implementation:
├── src/core/compilers/business-genome/  (2,750 LOC — domain logic)
│   └── extends GenesisCompiler
├── src/core/compilers/framework/        (1,800 LOC — inherited from GCF)
└── tests/core/compilers/business-genome/ (16+ test files)

Total After Migration: 4,550 LOC (1,800 inherited + 2,750 domain)
Infrastructure Removed: 790 LOC
Net Savings: 790 LOC of duplicated code
```

### What Changes

**EXTERNAL (Client-Visible)**:
- ❌ Nothing! API stays identical
- ❌ Input types unchanged
- ❌ Output types unchanged
- ❌ Compiler behavior unchanged
- ❌ Diagnostic codes unchanged
- ❌ Pass order unchanged

**INTERNAL (Implementation Only)**:
- ✅ Compiler now extends GenesisCompiler
- ✅ Uses GCF PassRegistry instead of custom registry
- ✅ Uses GCF DiagnosticAccumulator instead of CompilerDiagnosticsEngine
- ✅ Uses GCF pipeline orchestration instead of custom pipeline loop
- ✅ Removes duplicated infrastructure files
- ✅ Updates import paths
- ✅ Tests may be reorganized

---

## 2. INFRASTRUCTURE MIGRATION MAPPING

### Complete Duplicate Elimination Plan

#### Component 1: Diagnostics Engine

**Current**:
```
src/compiler/core/CompilerDiagnosticsEngine.ts (40 LOC)
  ├─ report(severity, code, message, details, passId, artifactId)
  ├─ architectureObservation(message, details)
  ├─ list()
  ├─ listBySeverity(severity)
  └─ hasErrors()
```

**Migration**:
- Replace with: `GCF DiagnosticAccumulator`
- Update BGC to call: `accumulator.add(diagnostics)`
- BGC diagnostic codes remain: `BGC_DIAGNOSTIC_CODES` in diagnostics.ts

#### Component 2: Validation Engine

**Current**:
```
src/compiler/core/CompilerValidationEngine.ts (50 LOC)
  ├─ validateBefore(contract, result)
  ├─ validateAfter(contract, result)
  └─ validateContract(contract, result)
```

**Migration**:
- Move validation logic to BGC's `validateInput()` and `validateOutput()` methods
- Integrate with GCF's validation framework
- BGC domain validation stays

#### Component 3: Manifest Manager

**Current**:
```
src/compiler/core/CompilerManifestManager.ts (80 LOC)
  └─ generateManifest(passes, timings, diagnostics)
```

**Migration**:
- Replace with: `GCF ManifestGenerator`
- BGC customization via MetadataBuilder override if needed

#### Component 4: Pass Registry

**Current**:
```
src/compiler/core/CompilerPassRegistry.ts (70 LOC)
  ├─ register(pass)
  ├─ getAllPasses()
  ├─ getPassesByIds(ids)
  └─ getOrderedPasses()
```

**Migration**:
- Replace with: `GCF PassRegistry` in `registerPasses()` method
- Update `src/compiler/genome/BusinessGenomePassRegistry.ts` to use GCF version

#### Component 5: Pipeline Orchestration

**Current**:
```
src/compiler/core/CompilerPipeline.ts (120 LOC)
  ├─ execute(passes, input, context)
  ├─ executePass(pass, state)
  └─ [pipeline loop with error handling]
```

**Migration**:
- Replace with: GCF's async pipeline execution in `compile()` method
- If synchronous API required, create wrapper:
  ```typescript
  compileSync(input): BusinessGenomeCompilerOutput {
    return syncWrapper(this.compile(input));
  }
  ```

#### Component 6: Artifact Manager

**Current**:
```
src/compiler/core/CompilerArtifactManager.ts (60 LOC)
  └─ manageArtifact(output, metadata)
```

**Migration**:
- Replace with: `GCF MetadataBuilder`
- BGC-specific artifact construction stays in BusinessGenomeCompiler

#### Component 7: Version Manager

**Current**:
```
src/compiler/core/CompilerVersionManager.ts (40 LOC)
  ├─ getVersion()
  ├─ getApiVersion()
  └─ [version tracking]
```

**Migration**:
- Replace with: GCF's version management in `getVersion()`
- Extend with BGC-specific versioning if needed

#### Component 8: Execution Context

**Current**:
```
src/compiler/core/CompilerContext.ts (100 LOC)
  ├─ constructor(sessionId, config)
  ├─ getSessionId()
  └─ [context state management]
```

**Migration**:
- Replace with: GCF's `CompilationState<TInput, TIntermediate>`
- Simpler and more type-safe than current implementation

#### Component 9: Utilities

**Current**:
```
src/compiler/core/stableStringify.ts (30 LOC)
  └─ stableStringify(obj)
```

**Migration**:
- Replace with: GCF's `stableStringify()` utility
- Same behavior, reused code

#### Component 10: Types

**Current**:
```
src/compiler/core/types.ts (200 LOC)
  ├─ CompilerDiagnostic
  ├─ CompilerPass
  ├─ CompilerResult
  └─ [generic types]
```

**Migration**:
- Replace with: GCF framework types
- BGC-specific types remain in `src/core/compilers/business-genome/types.ts`

---

## 3. MIGRATION EXECUTION PHASES

### Phase 1: Preparation (Day 1) — 4 hours

#### Task 1.1: Freeze BGC Baseline

**Objective**: Create immutable record of current behavior

**Steps**:
1. Run complete BGC test suite
   ```bash
   npm test -- tests/compiler/genome
   ```
   Record: All tests passing

2. Create representative test inputs
   - Valid evidence (all fields)
   - Invalid evidence (missing fields)
   - Edge cases (empty, null values)
   - Large evidence sets

3. Run each input through BGC compiler
   - Record artifact output
   - Record artifact checksum (SHA256)
   - Record artifact identity (format: prefix_hash_v1)
   - Record complete diagnostic list
   - Record diagnostic ordering
   - Record manifest structure
   - Record lineage chains
   - Record provenance entries
   - Record execution timing
   - Record pass order and completion

4. Create fixture file: `tests/fixtures/bgc-baseline-v1.0.json`
   ```json
   {
     "version": "1.0.0",
     "timestamp": "2026-07-13T00:00:00Z",
     "testCases": [
       {
         "name": "valid_evidence_full_set",
         "input": { ... },
         "expected": {
           "artifactChecksum": "...",
           "artifactIdentity": "...",
           "diagnostics": [ ... ],
           "manifest": { ... },
           "lineage": [ ... ],
           "provenance": [ ... ]
         }
       },
       { ... }
     ]
   }
   ```

5. Commit: `test(bgc): freeze v1.0 baseline for migration`

#### Task 1.2: Dependency Analysis

**Objective**: Map all imports and identify compatibility gaps

**Steps**:
1. Search all imports from `src/compiler/core` within BGC
   ```bash
   grep -r "from.*compiler/core" src/compiler/genome
   ```

2. For each import, identify:
   - Where it's used
   - What GCF equivalent exists
   - Any custom BGC logic on top

3. Create mapping document:
   ```
   Old Import → New Import → Migration Action
   ─────────────────────────────────────────
   compiler/core/types → core/compilers/framework/types → Replace
   compiler/core/CompilerDiagnosticsEngine → DiagnosticAccumulator → Replace
   ... (complete list)
   ```

4. Identify compatibility gaps:
   - Missing GCF features (if any)
   - Behavioral differences
   - Necessary adapters

5. Commit: `docs(gcf): analyze BGC-to-GCF dependency mapping`

#### Task 1.3: Test Infrastructure Setup

**Objective**: Prepare for equivalence testing

**Steps**:
1. Create equivalence test runner
   ```typescript
   // tests/core/compilers/business-genome/__tests__/equivalence.test.ts
   describe("BGC Equivalence Tests", () => {
     it("should produce identical output to v1.0 baseline", async () => {
       const baseline = loadBaseline("bgc-baseline-v1.0");
       for (const testCase of baseline.testCases) {
         const migrated = await migratedCompiler.compile(testCase.input);
         
         // Check artifact
         assert.strictEqual(
           migrated.intermediate.checksum,
           testCase.expected.artifactChecksum
         );
         
         // Check identity
         assert.strictEqual(
           migrated.intermediate.identity,
           testCase.expected.artifactIdentity
         );
         
         // Check diagnostics
         assert.deepEqual(
           migrated.diagnostics,
           testCase.expected.diagnostics
         );
         
         // ... more assertions
       }
     });
   });
   ```

2. Create determinism test
   ```typescript
   it("should produce identical output on repeated runs", async () => {
     const input = loadTestInput("valid_evidence_full_set");
     const result1 = await compiler.compile(input);
     const result2 = await compiler.compile(input);
     
     assert.strictEqual(
       result1.intermediate.checksum,
       result2.intermediate.checksum
     );
   });
   ```

3. Create regression test harness
   - Loads all baseline test cases
   - Runs migrated compiler on each
   - Compares outputs
   - Reports any divergences

4. Commit: `test(gcf): add BGC equivalence test framework`

**Phase 1 Deliverables**:
- ✅ Frozen baseline fixture file
- ✅ Dependency mapping document
- ✅ Equivalence test framework
- ✅ Ready for Phase 2

---

### Phase 2: Preparation Infrastructure (Day 1-2) — 8 hours

#### Task 2.1: Create Target Directory Structure

**Objective**: Set up new file structure

**Steps**:
1. Create directories
   ```bash
   mkdir -p src/core/compilers/business-genome
   mkdir -p src/core/compilers/business-genome/passes
   mkdir -p tests/core/compilers/business-genome
   ```

2. Verify directory structure
   ```bash
   tree src/core/compilers/
   tree tests/core/compilers/
   ```

3. Copy BGC files to new location (for now)
   ```bash
   cp -r src/compiler/genome/* src/core/compilers/business-genome/
   cp -r tests/compiler/genome/* tests/core/compilers/business-genome/
   ```

4. Commit: `refactor(gcf): relocate BGC to src/core/compilers/business-genome`

#### Task 2.2: Create Compatibility Adapters

**Objective**: Prepare for import migration

**Steps**:
1. Create adapter for CompilerDiagnosticsEngine
   ```typescript
   // src/compiler/core/CompilerDiagnosticsEngine.ts (DEPRECATED)
   import { DiagnosticAccumulator } from "../../../core/compilers/framework";
   
   export class CompilerDiagnosticsEngine {
     private accumulator = new DiagnosticAccumulator();
     
     report(severity, code, message, details, passId, artifactId) {
       this.accumulator.add([{
         severity, code, message, details, passId, artifactId
       }]);
     }
     // ... other methods delegate to accumulator
   }
   ```

2. Create adapters for other core classes
   ```typescript
   // src/compiler/core/CompilerPassRegistry.ts (DEPRECATED)
   import { PassRegistry } from "../../../core/compilers/framework";
   export class CompilerPassRegistry extends PassRegistry {
     // Adapter implementation
   }
   ```

3. Add deprecation notices to all adapters
   ```typescript
   /**
    * @deprecated Use GCF DiagnosticAccumulator instead
    * This adapter will be removed after BGC migration to GCF
    */
   ```

4. Keep old files working temporarily for smoother transition

5. Commit: `refactor(gcf): create compatibility adapters for migration`

#### Task 2.3: Update Import Statements

**Objective**: All imports point to new locations

**Steps**:
1. Create import migration script
   ```bash
   # scripts/migrate-imports.sh
   find src/core/compilers/business-genome \
     -name "*.ts" \
     -not -path "*/node_modules/*" | \
   xargs sed -i 's|from.*compiler/core|from "../../../core/compilers/framework"|g'
   ```

2. Run migration script
   ```bash
   bash scripts/migrate-imports.sh
   ```

3. Manually verify critical imports
   ```bash
   grep -n "from.*core" src/core/compilers/business-genome/**/*.ts
   ```

4. Compile to find any broken imports
   ```bash
   npm run build -- --noEmit
   ```

5. Fix any remaining import errors manually

6. Commit: `refactor(gcf): update import paths for BGC migration`

**Phase 2 Deliverables**:
- ✅ New directory structure in place
- ✅ BGC files in new location
- ✅ Compatibility adapters created
- ✅ Imports updated
- ✅ TypeScript compilation successful

---

### Phase 3: Core Migration (Day 2-3) — 16 hours

#### Task 3.1: Refactor BusinessGenomeCompiler Class

**Objective**: Extend GenesisCompiler instead of standalone

**Current Implementation** (src/compiler/genome/BusinessGenomeCompiler.ts):
```typescript
export class BusinessGenomeCompiler {
  private registry: BusinessGenomePassRegistry;
  private diagnostics: CompilerDiagnosticsEngine;
  private validator: CompilerValidationEngine;

  constructor(config: CompilerConfig) {
    this.registry = new BusinessGenomePassRegistry();
    this.diagnostics = new CompilerDiagnosticsEngine();
    this.validator = new CompilerValidationEngine();
    // ... register passes
  }

  compile(input: BusinessGenomeCompilerInput): BusinessGenomeCompilerOutput {
    // Manual pipeline execution
    let state = this.createInitialState(input);
    for (const pass of this.registry.getOrderedPasses()) {
      const result = pass.execute(state.current, context);
      state = state.withPass(result);
      if (result.fatal) break;
    }
    return this.buildOutput(state);
  }
}
```

**Target Implementation**:
```typescript
import { GenesisCompiler, type CompilerPass } from "../../../core/compilers/framework";

export class BusinessGenomeCompiler extends GenesisCompiler<
  BusinessGenomeCompilerInput,
  BusinessGenomeArtifact
> {
  // Implement abstract methods
  
  protected registerPasses(): void {
    this.registerPass(new InputValidationPass());
    this.registerPass(new CanonicalVerificationPass());
    // ... register all 11 passes
    this.registerPass(new PublicationPass());
  }

  protected async validateInput(
    input: BusinessGenomeCompilerInput
  ): Promise<Diagnostic[]> {
    // Existing input validation logic from BusinessGenomeCompiler
    const diagnostics: Diagnostic[] = [];
    
    if (!input.compilerContext) {
      diagnostics.push({
        severity: "error",
        code: "BGC_INVALID_INPUT_MISSING_CONTEXT",
        message: "Compiler context is required",
        passId: "bgc.input-validation"
      });
    }
    
    // ... more validation
    return diagnostics;
  }

  protected async validateOutput(
    artifact: BusinessGenomeArtifact,
    state: CompilationState<BusinessGenomeCompilerInput, any>
  ): Promise<Diagnostic[]> {
    // Existing output validation logic
    const diagnostics: Diagnostic[] = [];
    
    if (!artifact.graph) {
      diagnostics.push({
        severity: "error",
        code: "BGC_INVALID_OUTPUT_MISSING_GRAPH",
        message: "Business Genome artifact must contain graph",
        passId: "bgc.business-genome-publication"
      });
    }
    
    // ... more validation
    return diagnostics;
  }

  // Override compile if needed for backward compatibility
  async compile(
    input: BusinessGenomeCompilerInput
  ): Promise<CompilerResult<BusinessGenomeArtifact>> {
    return super.compile(input);
  }

  // Optional: Sync wrapper for backward compatibility
  compileSync(
    input: BusinessGenomeCompilerInput
  ): BusinessGenomeCompilerOutput {
    // Convert async result to sync if needed
    // This is only if callers require synchronous API
  }
}
```

**Migration Steps**:

1. Create new class signature extending GenesisCompiler
   ```typescript
   export class BusinessGenomeCompiler extends GenesisCompiler<
     BusinessGenomeCompilerInput,
     BusinessGenomeArtifact
   > {
     // ...
   }
   ```

2. Implement `registerPasses()`
   ```typescript
   protected registerPasses(): void {
     this.registerPass(new InputValidationPass());
     this.registerPass(new CanonicalVerificationPass());
     // ... all 11 passes
   }
   ```

3. Implement `validateInput()`
   - Extract validation logic from old pipeline
   - Return Diagnostic array

4. Implement `validateOutput()`
   - Extract validation logic from old pipeline
   - Return Diagnostic array

5. Update constructor
   ```typescript
   constructor(config?: CompilerConfig) {
     super({
       name: "BusinessGenomeCompiler",
       version: "1.0.0",
       capabilities: {
         supportsAsync: true,
         supportsDeterminism: true,
         supportsMetadata: true,
         // ...
       }
     });
   }
   ```

6. Delete old infrastructure code
   - Remove manual registry management
   - Remove manual diagnostics engine
   - Remove manual pipeline loop
   - Remove manual state threading

7. Keep domain-specific customization
   - Business validation rules
   - BGC-specific diagnostic codes
   - Domain artifact construction

8. Compile and verify
   ```bash
   npm run build -- --noEmit
   ```

9. Commit: `refactor(gcf): migrate BusinessGenomeCompiler to extend GenesisCompiler`

#### Task 3.2: Migrate Pass Registry

**Objective**: Use GCF PassRegistry

**Current** (src/compiler/genome/BusinessGenomePassRegistry.ts):
```typescript
export class BusinessGenomePassRegistry {
  private passes = new Map<string, BusinessGenomePass>();
  
  register(pass: BusinessGenomePass) { /* ... */ }
  getOrderedPasses(): BusinessGenomePass[] {
    return Array.from(this.passes.values())
      .sort(/* by dependency */);
  }
}
```

**Target**: Use GCF PassRegistry integrated into registerPasses()

**Migration Steps**:

1. Remove BusinessGenomePassRegistry.ts references
2. Move pass registration to `registerPasses()` method
3. GCF PassRegistry handles dependency ordering automatically
4. Verify pass order matches old implementation
5. Test that topological sort produces same order

#### Task 3.3: Update Pass Implementations

**Objective**: Ensure passes work with GCF

**Current Pass Pattern**:
```typescript
export class InputValidationPass implements BusinessGenomePass {
  metadata = {
    id: "bgc.input-validation",
    dependencies: []
  };
  
  execute(
    input: any,
    context: CompilerContext
  ): BusinessGenomePassResult<ValidatedEvidenceIRView> {
    // ... business logic
    return { output, diagnostics, fatal };
  }
}
```

**Target Pattern** (Minor updates):
```typescript
export class InputValidationPass implements CompilerPass<
  CompilationState<BusinessGenomeCompilerInput, any>,
  ValidatedEvidenceIRView
> {
  readonly id = "bgc.input-validation";
  readonly dependencies: string[] = [];
  
  async execute(
    state: CompilationState<BusinessGenomeCompilerInput, any>
  ): Promise<PassResult<ValidatedEvidenceIRView>> {
    // ... business logic (unchanged)
    const output = /* ... */;
    const diagnostics = /* ... */;
    
    return {
      output,
      diagnostics,
      success: !diagnostics.some(d => d.severity === "error")
    };
  }
}
```

**Migration Steps**:

1. Update pass interface to match GCF CompilerPass
2. Update execute() to receive CompilationState instead of raw input
3. Extract input from state: `const input = state.input;`
4. Update return type to PassResult<T>
5. Verify business logic unchanged
6. Test each pass independently

#### Task 3.4: Remove Duplicated Infrastructure

**Objective**: Delete old src/compiler/core files

**Files to Delete**:
- ✅ src/compiler/core/CompilerDiagnosticsEngine.ts
- ✅ src/compiler/core/CompilerValidationEngine.ts
- ✅ src/compiler/core/CompilerManifestManager.ts
- ✅ src/compiler/core/CompilerPassRegistry.ts
- ✅ src/compiler/core/CompilerPipeline.ts
- ✅ src/compiler/core/CompilerArtifactManager.ts
- ✅ src/compiler/core/CompilerVersionManager.ts
- ✅ src/compiler/core/CompilerContext.ts
- ✅ src/compiler/core/stableStringify.ts
- ✅ src/compiler/core/types.ts

**Migration Steps**:

1. Verify no remaining references
   ```bash
   grep -r "from.*compiler/core" src/ tests/
   grep -r "from.*compiler/core" .
   ```

2. Delete directory
   ```bash
   rm -rf src/compiler/core
   ```

3. Verify no broken imports
   ```bash
   npm run build -- --noEmit
   ```

4. Run tests to confirm nothing broke
   ```bash
   npm test -- tests/core/compilers/business-genome
   ```

5. Commit: `refactor(gcf): remove duplicated infrastructure, now using GCF`

**Phase 3 Deliverables**:
- ✅ BusinessGenomeCompiler extends GenesisCompiler
- ✅ All 11 passes work with GCF pipeline
- ✅ Duplicated infrastructure files removed
- ✅ TypeScript compilation: 0 errors
- ✅ Ready for Phase 4 equivalence testing

---

### Phase 4: Validation & Equivalence (Day 3-4) — 12 hours

#### Task 4.1: Run Equivalence Tests

**Objective**: Migrated compiler produces identical outputs to v1.0

**Steps**:

1. Run equivalence test against baseline
   ```bash
   npm test -- tests/core/compilers/business-genome/__tests__/equivalence.test.ts
   ```

2. For each baseline test case, verify:
   - [ ] Artifact checksum matches
   - [ ] Artifact identity matches
   - [ ] Diagnostic list matches (same codes, messages, ordering)
   - [ ] Manifest structure matches
   - [ ] Lineage matches
   - [ ] Provenance matches
   - [ ] Pass order matches
   - [ ] Completion status matches

3. If any differences found:
   - Analyze root cause
   - Update either baseline or migrated code (if bug in baseline)
   - Document difference
   - Re-test until all match

4. Commit: `test(gcf): verify BGC output equivalence post-migration`

#### Task 4.2: Run Regression Test Suite

**Objective**: All existing BGC tests pass

**Steps**:

1. Run full BGC test suite
   ```bash
   npm test -- tests/core/compilers/business-genome
   ```

2. Verify all 16+ tests pass:
   - business-genome-compiler.test.ts (6 tests)
   - dependency-boundary.test.ts (multiple)
   - pass-registry.test.ts (multiple)
   - 13 individual pass tests

3. If any fail:
   - Debug failure
   - Update test if it was GCF-incompatible
   - Update code if there's a bug
   - Re-run until all pass

4. Record results
   ```
   Test Suite: BGC Regression
   Tests Run: 16+
   Tests Passed: 16+
   Tests Failed: 0
   Success Rate: 100%
   ```

5. Commit: `test(gcf): verify BGC regression tests pass`

#### Task 4.3: TypeScript Validation

**Objective**: Zero TypeScript errors

**Steps**:

1. Full build with strict mode
   ```bash
   npm run build -- --noEmit --strict
   ```

2. Verify no errors
   ```
   Found 0 errors. ✅
   ```

3. Fix any type issues found
   - All domain types must be correctly typed
   - No implicit any
   - All generics resolved properly

4. Commit: `fix(gcf): resolve TypeScript types post-migration`

#### Task 4.4: Dependency Boundary Validation

**Objective**: Verify module separation

**Steps**:

1. Verify BGC has no direct imports from old core
   ```bash
   grep -r "from.*src/compiler/core" src/core/compilers/business-genome/
   # Should return: (nothing)
   ```

2. Verify GCF has no imports from BGC
   ```bash
   grep -r "from.*business-genome\|from.*genome" src/core/compilers/framework/
   # Should return: (nothing)
   ```

3. Verify framework is independent
   ```bash
   grep -r "from.*compiler/genome\|from.*compiler/evidence" src/core/compilers/framework/
   # Should return: (nothing)
   ```

4. Create dependency diagram showing clean separation
   ```
   Client Code
       ↓
   BusinessGenomeCompiler (extends GenesisCompiler)
       ↓
   GenesisCompiler (GCF Framework)
   ├─ StateThreader
   ├─ PassRegistry
   ├─ DiagnosticAccumulator
   ├─ ... (other framework components)
       ↓
   Node.js Built-ins (crypto, path)
   ```

5. Commit: `docs(gcf): verify clean module boundaries post-migration`

**Phase 4 Deliverables**:
- ✅ All equivalence tests pass
- ✅ All regression tests pass
- ✅ Zero TypeScript errors
- ✅ Clean module boundaries
- ✅ Ready for Phase 5 cleanup

---

### Phase 5: Cleanup & Finalization (Day 4) — 8 hours

#### Task 5.1: Remove Old Directories

**Objective**: Clean up old locations

**Steps**:

1. Verify all content moved
   ```bash
   diff -r src/compiler/genome src/core/compilers/business-genome
   diff -r tests/compiler/genome tests/core/compilers/business-genome
   ```

2. Delete old directories
   ```bash
   rm -rf src/compiler/genome
   rm -rf tests/compiler/genome
   rm -rf src/compiler/core
   ```

3. Verify no dangling references
   ```bash
   grep -r "compiler/genome\|compiler/core" . --exclude-dir=node_modules
   # Should return: (nothing) or only docs
   ```

4. Update any remaining imports in other modules
   ```bash
   grep -r "from.*compiler" src/ tests/ | grep -v node_modules
   # Fix any that should point to new location
   ```

5. Commit: `refactor(gcf): remove old BGC and core directories`

#### Task 5.2: Update Public API

**Objective**: Ensure exports work correctly

**Steps**:

1. Update src/compiler/index.ts (or main export)
   ```typescript
   // Old
   export * from './genome/BusinessGenomeCompiler';
   
   // New
   export { BusinessGenomeCompiler } from '../core/compilers/business-genome/BusinessGenomeCompiler';
   export * from '../core/compilers/business-genome/types';
   export * from '../core/compilers/business-genome/diagnostics';
   ```

2. Verify backward compatibility
   ```bash
   npm run build
   ```

3. Test that imports still work from client code
   ```typescript
   import { BusinessGenomeCompiler } from '@stoner/compiler';
   // Should still work exactly the same
   ```

4. Update documentation
   - README references
   - Architecture docs
   - Integration guides

5. Commit: `docs(gcf): update public API exports post-migration`

#### Task 5.3: Final Integration Tests

**Objective**: Verify BGC works in full system context

**Steps**:

1. Run full test suite
   ```bash
   npm test
   ```

2. Verify no test failures
   ```
   Test Suites: X passed, 0 failed
   Tests: X passed, 0 failed
   ```

3. Test BGC with real data (if available)
   - Load representative evidence
   - Compile through BGC
   - Verify output is valid

4. Check TypeScript compilation for entire project
   ```bash
   npm run build -- --noEmit
   ```

5. Verify ESLint/linting passes
   ```bash
   npm run lint
   ```

6. Commit: `test(gcf): verify full system integration post-migration`

**Phase 5 Deliverables**:
- ✅ Old directories removed
- ✅ Public API updated
- ✅ Full test suite passing
- ✅ Zero errors/warnings
- ✅ Ready for Phase 6 documentation

---

### Phase 6: Documentation & Release (Day 4-5) — 8 hours

#### Task 6.1: Create Migration Reports

**Objective**: Document the migration for future reference

**Documents to Create**:

1. **GCF-AR-0001: Business Genome Compiler Adoption Report**
   ```markdown
   # GCF-AR-0001: Business Genome Compiler Adoption Report
   
   ## Executive Summary
   - BGC successfully migrated from standalone to GCF-based
   - 790 LOC of duplicated infrastructure removed
   - 100% API compatibility maintained
   - All tests passing
   
   ## Changes Made
   - 10 core infrastructure files consolidated into GCF
   - 1 main compiler class updated to extend GenesisCompiler
   - 11 pass implementations updated for GCF interface
   - Import paths updated throughout
   
   ## Metrics
   - Files deleted: 10
   - Files moved: 15
   - Infrastructure LOC removed: 790
   - Domain LOC preserved: 2,750
   - Tests migrated: 16+
   - Test success rate: 100%
   - TypeScript errors: 0
   
   ## Benefits
   - Reduced code duplication
   - Improved maintainability
   - Foundation for future compilers (EBC, etc.)
   - Consistent framework across all compilers
   
   ## Compatibility
   - External API: Identical ✅
   - Input/output types: Unchanged ✅
   - Diagnostic codes: Unchanged ✅
   - Pass order: Unchanged ✅
   - Behavior: Identical ✅
   ```

2. **Migration Decision Log**
   ```markdown
   # BGC Migration Decision Log
   
   ## Decision 1: Async vs Sync compile()
   - GCF uses async compile()
   - BGC currently uses sync compile()
   - Decision: Implement async, provide sync wrapper if needed
   - Rationale: async is more flexible, allows future optimizations
   
   ## Decision 2: Pass Registry
   - Use GCF PassRegistry instead of custom
   - Ensure topological sort produces same order
   - Benefit: Automatic circular dependency detection
   
   ## Decision 3: Diagnostics Ordering
   - GCF DiagnosticAccumulator + BGC sortDiagnostics()
   - Apply BGC sorting after accumulation
   - Ensures diagnostic order matches baseline
   
   ... (other decisions)
   ```

3. **Migration Lessons Learned**
   ```markdown
   # BGC Migration: Lessons Learned
   
   ## What Went Well
   - GCF framework architecture was generic enough for BGC
   - Domain logic was well-separated from infrastructure
   - Baseline freezing made equivalence testing straightforward
   - Dependency mapping identified all migration points upfront
   
   ## Challenges Encountered
   - [List any issues that arose]
   - [Root causes]
   - [How they were resolved]
   
   ## Recommendations for Future Migrations (EBC, etc.)
   - Use same preparation methodology
   - Freeze baseline early
   - Map dependencies comprehensively
   - Test equivalence continuously
   ```

#### Task 6.2: Update Architecture Docs

**Objective**: Reflect new architecture in documentation

**Files to Update**:

1. **docs/architecture/0006-plugin-architecture.md**
   - Update to show how BGC now uses GCF
   - Update diagrams
   - Show inheritance structure

2. **docs/architecture/0008-ai-runtime.md** (if relevant)
   - Update compiler architecture section
   - Show BGC as GCF implementation

3. **README.md**
   - Update compiler section
   - Update import paths
   - Update examples

4. **docs/ARCHITECTURE.md** (project overview)
   - Update to reflect new structure
   - Show GCF as foundation

5. **docs/MIGRATIONS.md** (new file)
   ```markdown
   # Genesis Platform: Migration History
   
   ## GCF-M2: Business Genome Compiler Migration
   - Date: 2026-07-13
   - Status: COMPLETE ✅
   - Result: BGC now extends GenesisCompiler
   - Benefits: 50% infrastructure reduction
   - Commits: ...
   
   ## Future Migrations
   - GCF-M3: Evidence Building Compiler
   - GCF-M4: Discovery Compiler
   - ...
   ```

#### Task 6.3: Commit & Tag

**Objective**: Record migration in git history

**Steps**:

1. Final commit with comprehensive message
   ```bash
   git add -A
   git commit -m "feat(gcf): migrate Business Genome Compiler to GCF-M1

   - Refactor BusinessGenomeCompiler to extend GenesisCompiler
   - Remove 790 LOC of duplicated infrastructure from src/compiler/core
   - Migrate all 11 passes to GCF CompilerPass interface
   - Relocate BGC to src/core/compilers/business-genome
   - Update all import paths and dependencies
   - Maintain 100% API compatibility with v1.0
   - All 16+ regression tests passing
   - Equivalence tests verify identical outputs to baseline
   - Zero TypeScript errors

   Closes #12 GCF-M2
   Related: GCF-AR-0001, GCF-VR-0001"
   ```

2. Create annotated tag
   ```bash
   git tag -a v1.0.0-bgc-migrated-to-gcf \
     -m "Business Genome Compiler v1.0 migrated to Genesis Compiler Framework

   This tag marks the successful migration of BGC from standalone
   implementation to an extension of GCF-M1.

   Key metrics:
   - Infrastructure LOC removed: 790
   - Domain LOC preserved: 2,750
   - Tests passing: 100%
   - TypeScript errors: 0
   - API compatibility: 100%
   - Output equivalence: 100%

   Prepared for merge to main and release."
   ```

3. Push to remote
   ```bash
   git push origin feature/gcf-m2-bgc-migration
   git push origin v1.0.0-bgc-migrated-to-gcf
   ```

4. Create Pull Request to main
   ```
   Title: feat(gcf): Migrate Business Genome Compiler to GCF-M1

   Description:
   - Closes GCF-M2 milestone
   - BGC now extends GenesisCompiler
   - Eliminates 790 LOC of duplicate infrastructure
   - Maintains 100% API compatibility
   - All tests passing (16+)
   - Zero TypeScript errors

   Checklist:
   ✅ All tests passing
   ✅ TypeScript compilation clean
   ✅ Equivalence tests pass
   ✅ Documentation updated
   ✅ Architecture review complete
   ✅ Backward compatibility maintained
   ```

5. Upon approval, merge to main
   ```bash
   git merge feature/gcf-m2-bgc-migration
   ```

**Phase 6 Deliverables**:
- ✅ GCF-AR-0001 adoption report
- ✅ Migration decision log
- ✅ Lessons learned document
- ✅ Architecture documentation updated
- ✅ Git history properly recorded
- ✅ Merged to main

---

## 4. TIMELINE SUMMARY

| Phase | Duration | Days | Status |
|-------|----------|------|--------|
| Phase 1: Preparation & Baseline | 4 hours | Day 1 (0.5) | Pending |
| Phase 2: Preparation Infrastructure | 8 hours | Day 1-2 (1) | Pending |
| Phase 3: Core Migration | 16 hours | Day 2-3 (2) | Pending |
| Phase 4: Validation & Equivalence | 12 hours | Day 3-4 (1.5) | Pending |
| Phase 5: Cleanup & Finalization | 8 hours | Day 4 (1) | Pending |
| Phase 6: Documentation & Release | 8 hours | Day 4-5 (1) | Pending |
| **TOTAL** | **56 hours** | **4-5 days** | **AWAITING START** |

---

## 5. SUCCESS CRITERIA

### Phase 1 Success
- [ ] Baseline fixture file created with all canonical values
- [ ] Dependency mapping complete
- [ ] Equivalence test framework in place
- [ ] Ready to begin Phase 2

### Phase 2 Success
- [ ] New directory structure created
- [ ] BGC files relocated
- [ ] Compatibility adapters working
- [ ] Imports updated without breaking code
- [ ] TypeScript compiles cleanly

### Phase 3 Success
- [ ] BusinessGenomeCompiler extends GenesisCompiler
- [ ] All 11 passes registered via registerPasses()
- [ ] validateInput() and validateOutput() implemented
- [ ] Old infrastructure files deleted
- [ ] TypeScript: 0 errors

### Phase 4 Success
- [ ] All baseline test cases pass equivalence tests
- [ ] All 16+ regression tests pass
- [ ] Zero TypeScript errors
- [ ] Module boundaries verified clean

### Phase 5 Success
- [ ] Old directories removed
- [ ] Public API updated and working
- [ ] Full system integration tests pass
- [ ] Zero ESLint warnings

### Phase 6 Success
- [ ] Migration reports created
- [ ] Architecture documentation updated
- [ ] Git history properly recorded
- [ ] Merged to main successfully

---

## 6. RISK MITIGATION

### High-Risk Items

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Artifact identity divergence | Medium | CRITICAL | Baseline freezing + equivalence tests |
| Diagnostic ordering changes | Medium | CRITICAL | Sort function preserved + testing |
| Pass execution order changes | Low | CRITICAL | GCF topological sort verified |
| Backward compatibility break | Low | CRITICAL | Public API unchanged, only internal |
| Migration scope creep | Medium | HIGH | Focused tasks, clear boundaries |

### Mitigation Strategy

1. **Baseline Freezing**
   - Immediate advantage: know exactly what to match
   - Capture all canonical values before any changes

2. **Equivalence Testing**
   - Continuous validation
   - Catch divergences immediately
   - Compare against frozen baseline

3. **Phased Approach**
   - Each phase has clear deliverables
   - Can roll back if needed
   - Progressive validation at each stage

4. **Comprehensive Testing**
   - 16+ regression tests must pass
   - TypeScript strict mode
   - Integration tests with real data

5. **Code Review**
   - Detailed commit messages
   - Architecture review at each phase
   - Peer review before merge

---

## 7. APPROVAL GATES

### Before Phase 1 Can Begin

- [ ] GCF-M1 validation report (GCF-VR-0001) approved
- [ ] This migration plan (GCF-M2) approved
- [ ] Architecture Review Board sign-off
- [ ] Stakeholder approval (BGC team, GCF team, QA)

### Before Phase 2 Can Begin

- [ ] Phase 1 deliverables complete
- [ ] Baseline fixtures verified
- [ ] Equivalence test framework ready

### Before Phase 3 Can Begin

- [ ] Phase 2 deliverables complete
- [ ] Directory structure verified
- [ ] Compatibility adapters working

### Before Phase 4 Can Begin

- [ ] Phase 3 deliverables complete
- [ ] TypeScript compilation clean
- [ ] No broken imports remaining

### Before Phase 5 Can Begin

- [ ] Phase 4 deliverables complete
- [ ] All equivalence tests passing
- [ ] All regression tests passing

### Before Phase 6 Can Begin

- [ ] Phase 5 deliverables complete
- [ ] Full integration tests passing
- [ ] Zero errors/warnings

### Before Merge to Main

- [ ] Phase 6 deliverables complete
- [ ] Final code review approved
- [ ] All stakeholders sign-off

---

## NEXT STEPS

**AWAITING APPROVAL TO PROCEED**

Upon approval of:
1. GCF-VR-0001 (Compiler Kernel Validation Report)
2. This GCF-M2 Migration Plan

**Immediate Actions**:
1. Create feature branch: `feature/gcf-m2-bgc-migration-phase1`
2. Begin Phase 1: Freeze BGC baseline
3. Daily status updates
4. Progress tracking against success criteria

**Timeline**: 4-5 days from start to production-ready (Day X to Day X+5)

---

**Document Status**: READY FOR REVIEW  
**Last Updated**: 2026-07-13  
**Author**: Genesis Engineering Team  
**Approval Required From**: Architecture Review Board, BGC Team Lead, GCF Team Lead, QA Lead


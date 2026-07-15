# 07 Open Issues

## GCS-0001 Genesis Compiler Language Specification v1.0

**Date**: 2026-07-14  
**Status**: 9 open questions identified  
**Priority**: Ready for Architecture Review  

---

## Issue Index

1. **Identifier Collision Resolution** - Design decision
2. **Profile Boundaries** - Specification scope
3. **Extension Authority Boundaries** - Governance clarification
4. **IR Ownership Matrix** - Governance formalization
5. **Determinism Testing Framework** - Implementation guidance
6. **Incremental Cache Invalidation** - Performance optimization
7. **Error Accumulation vs. Fail-Fast** - Configuration model
8. **Amendment Process Triggers** - Governance policy
9. **Compliance Certification Process** - Governance authority

---

## Issue 1: Identifier Collision Resolution

**Category**: Design Decision  
**Severity**: Low (non-blocking)  
**Status**: Documented with options  

### Problem Statement

Identifier collision exists between:
- Existing `genesis/compiler/GCS-0001.md` (8-stage pipeline specification)
- New `GCS-0001-Genesis-Compiler-Language-v1.0.md` (formal language specification)

Both documents share the identifier "GCS-0001" but represent different concerns (implementation vs. formal language).

### Current Status

Non-blocking semantic layering relationship:
- **Layer 1**: Formal language contracts (new specification) - Foundation
- **Layer 2**: Pipeline implementation (existing spec) - Implementation

### Resolution Options

**Option 1: Rename Existing Document**
- Action: Rename `genesis/compiler/GCS-0001.md` → `genesis/compiler/PIPELINE-0001.md`
- Advantage: Clear distinction between identifiers
- Disadvantage: Requires updating all references
- Recommendation: Supported if clear renaming strategy

**Option 2: Reorganize into Two-Part Specification**
- Action: Create unified specification with two parts
  - Part A: Formal language (specifications/ directory)
  - Part B: Pipeline implementation (compiler/ directory)
- Advantage: Logical relationship clear in structure
- Disadvantage: Requires governance structure decision
- Recommendation: Preferred approach

**Option 3: Keep Both with Explicit Clarification**
- Action: Update existing `GCS-0001.md` header to note relationship
- Advantage: Preserves existing documentation
- Disadvantage: Requires reader awareness of layering
- Recommendation: Acceptable if clarification is prominent

### Question for Architecture Review

Which resolution approach should be used? Options 2 or 3 recommended.

---

## Issue 2: Compiler Profile Boundaries

**Category**: Specification Scope  
**Severity**: Low (affects implementation planning)  
**Status**: Deferred design question  

### Problem Statement

GCS-0001 defines three compliance categories (Core, Profile, Extension) but doesn't specify what constitutes different profiles.

### Current Status

Section 25.2 defines generic profile categories but leaves specific profile definitions to implementation.

### Design Questions

- Should GCS-0001 define specific profiles (Core Compiler, Extended Compiler, Custom)?
- Or should profile definitions be deferred to implementation specs?
- What makes a profile distinct from base compilation?

### Question for Architecture Review

Should GCS-0001 specify certain profiles normatively, or defer all profile definitions to implementation?

---

## Issue 3: Extension Authority Boundaries

**Category**: Governance Clarification  
**Severity**: Low (affects extension policy)  
**Status**: Policy clarification needed  

### Problem Statement

GCS-0001 Section 24 specifies what extensions are permitted but doesn't fully clarify extension authority boundaries.

### Current Status

Specification prohibits extensions from redefining pass contracts or GES-0001 concepts, but governance policy around extension authority is not formalized.

### Design Questions

- Can extensions modify pass behavior through configuration?
- Can extensions add new IR types vs. only using existing types?
- What is the appeal/override process for extension rejection?
- Who has authority to approve extensions?

### Question for Architecture Review

Should formal extension governance policy accompany GCS-0001 specification?

---

## Issue 4: IR Ownership Matrix Formalization

**Category**: Governance Formalization  
**Severity**: Low (documentation/clarity)  
**Status**: Recommendation for governance decision  

### Problem Statement

Section 10.3 assigns semantic authority for each IR type, but authority ownership is not formally captured in governance record.

### Current Status

Matrix is defined in specification but has not been formally approved through governance.

### Design Questions

- Should IR ownership matrix be formally captured in governance decision?
- Should ambiguous ownership cases be escalated to specification authority?
- How should ownership changes be governed?

### Question for Architecture Review

Should explicit governance decision formally approve IR ownership matrix?

---

## Issue 5: Determinism Testing Framework

**Category**: Implementation Guidance  
**Severity**: Low (implementation detail)  
**Status**: Guidance needed for implementation  

### Problem Statement

GCS-0001 Section 21.4 specifies determinism verification process but doesn't define testing framework.

### Current Status

Specification defines what to test; implementation must define how.

### Design Questions

- Should determinism testing be automated in CI/CD?
- What platforms/languages must produce identical output?
- What tolerance is acceptable for floating-point comparisons?
- Should incremental builds also be tested for determinism?

### Question for Implementation Team

What determinism testing framework should be developed for compiler verification?

---

## Issue 6: Incremental Cache Invalidation Strategy

**Category**: Performance Optimization  
**Severity**: Medium (affects performance)  
**Status**: Algorithm research needed  

### Problem Statement

GCS-0001 Section 23 defines incremental safety contracts but doesn't specify cache invalidation algorithm.

### Current Status

Specification defines contract; implementation must choose algorithm.

### Design Questions

- Should cache invalidation use file-level or finer granularity?
- How should transitive dependency changes be detected?
- What is acceptable cache hit/miss ratio?
- Should cache be persistent across runs?

### Question for Implementation Team

What cache invalidation algorithm should be chosen for performance vs. safety?

---

## Issue 7: Error Accumulation vs. Fail-Fast Configuration

**Category**: Configuration Model  
**Severity**: Low (affects error handling UX)  
**Status**: Invocation model needed  

### Problem Statement

GCS-0001 Section 12.2 defines both error accumulation and fail-fast modes but doesn't specify how mode selection works.

### Current Status

Specification defines modes; implementation must define invocation.

### Design Questions

- Should mode be selected at compile-time or runtime?
- Should default be fail-fast or error accumulation?
- Should mode be CLI flag, configuration file, or both?
- Can mode be changed during compilation?

### Question for Implementation Team

How should error accumulation vs. fail-fast mode selection be configured?

---

## Issue 8: Amendment Process Triggers

**Category**: Governance Policy  
**Severity**: Low (affects spec evolution)  
**Status**: Policy clarification needed  

### Problem Statement

GCS-0001 Section 28 (Amendment Process, in implementation report) defines amendment track framework but doesn't provide decision criteria.

### Current Status

Framework is generic; specific triggers are not defined.

### Design Questions

- What specific technical issues trigger Amendment Track 1 (Critical Fix)?
- What changes trigger Amendment Track 2 (Enhancement)?
- What changes trigger Amendment Track 3 (Normative Expansion)?
- Who decides which track applies?
- What is decision timeline?

### Question for Governance Authority

What specific amendment triggers should be documented for GCS-0001?

---

## Issue 9: Compliance Certification Process

**Category**: Governance Authority  
**Severity**: Low (affects implementation authority)  
**Status**: Governance authority decision needed  

### Problem Statement

GCS-0001 Section 25.2 defines compliance declaration format but doesn't establish certification process or authority.

### Current Status

Specification allows compliance declarations but doesn't govern their approval.

### Design Questions

- Who is authorized to certify implementations?
- What certification test suite should implementations pass?
- How is certification validated?
- What is duration of certification validity?
- How are violations handled?

### Question for Governance Authority

Should formal compliance certification process be established?

---

## Summary by Category

### Design Decisions (5 issues)
- Issue 1: Identifier Collision (blocking if not decided)
- Issue 2: Profile Boundaries
- Issue 3: Extension Authority Boundaries
- Issue 4: IR Ownership Matrix
- Issue 7: Error Mode Configuration

### Implementation Guidance (2 issues)
- Issue 5: Determinism Testing Framework
- Issue 6: Cache Invalidation Strategy

### Governance Policy (2 issues)
- Issue 8: Amendment Process Triggers
- Issue 9: Compliance Certification Process

---

## Blocked By / Dependencies

| Issue | Blocked By | Dependency | Status |
|---|---|---|---|
| 1 | Architecture Review | Identifier decision | ✅ Ready |
| 2 | Architecture Review | Profile scope | ✅ Ready |
| 3 | Governance | Extension policy | ✅ Ready |
| 4 | Governance | IR ownership formalization | ✅ Ready |
| 5 | Implementation | Determinism testing | ✅ Ready |
| 6 | Implementation | Cache algorithm | ✅ Ready |
| 7 | Implementation | Configuration model | ✅ Ready |
| 8 | Governance | Amendment policy | ✅ Ready |
| 9 | Governance | Certification authority | ✅ Ready |

---

## Recommendation

✅ **Non-Blocking for GCS-0001 Approval**

All 9 open issues are non-blocking for Architecture Review approval. Issues should be addressed in order:

1. **Immediate** (before approval): Issue 1 (Identifier Collision)
2. **Architecture Review**: Issues 2-4 (Design decisions)
3. **Before Implementation**: Issue 7 (Configuration)
4. **During Implementation**: Issues 5-6 (Implementation guidance)
5. **Governance Decision**: Issues 8-9 (Policy)

---

**Open Issues Status**: Documented and prioritized  
**Recommendation**: Ready for Architecture Review with open issues tracked  
**Next Phase**: Issues resolved during implementation planning

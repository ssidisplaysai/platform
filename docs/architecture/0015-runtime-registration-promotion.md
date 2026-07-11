# ADR-0015: Runtime Registration & Promotion Engine

## Status

ACCEPTED

## Date

2026-07-06

## Context

The Genesis Business Compiler has successfully implemented:
- Definition Registry (Phase 1)
- Generation Planner (Phase 2)
- Generation Compiler (Phase 3)
- Artifact Writer (Phase 4)
- Entity Templates (Phase 5)
- Generated Slice Validation (Phase 6)

The next logical step is to establish a controlled promotion mechanism that moves validated generated artifacts from the sandbox (`generated/genesis/`) into the Genesis Runtime.

The promotion pipeline must:
1. Accept only validated slices
2. Build immutable promotion plans
3. Support reversibility via rollback
4. Be deterministic and reproducible
5. Start as simulation (Phase 7) with real integration in future phases

## Decision

We implement Phase 7: Runtime Registration & Promotion Engine with these characteristics:

### Architecture

**Promotion Pipeline:**
```
Generated Slice
    ↓
Validation Check
    ↓
Promotion Plan Creation
    ↓
Step Execution
    ↓
Runtime Registration
    ↓
Promotion Result
```

### Components

1. **PromotionContext** - Immutable promotion configuration
2. **PromotionPlan** - Ordered list of promotion steps
3. **PromotionEngine** - Main orchestration
4. **PromotionValidator** - Slice validation before promotion
5. **PromotionResult** - Immutable promotion outcome
6. **RuntimeRegistrar** - Simulated runtime registration
7. **RollbackManager** - Rollback management

### Design Decisions

**Decision 1: Simulation First**
- Phase 7 is simulation only (no actual file movement)
- No runtime modifications
- No src/core changes
- Establishes architecture for future phases
- Rationale: Allows testing promotion logic before real integration

**Decision 2: Validation Gate**
- Promotion requires successful validation first
- Fail-fast: abort if validation fails
- No partial promotion
- Rationale: Ensures only complete, valid slices are promoted

**Decision 3: Immutable Plans**
- Promotion plans are immutable (frozen)
- Plans created before execution
- Plans can be inspected/audited before running
- Rationale: Determinism, auditability, safety

**Decision 4: Ordered Steps**
- Promotion happens in 10 deterministic steps:
  1. Validate slice
  2-9. Copy artifact files
  10. Register in runtime
- Steps cannot be skipped or reordered
- Rationale: Ensures consistent, reproducible behavior

**Decision 5: Rollback Support**
- Track what was promoted
- On error, perform rollback
- Rollback is reversible
- Rationale: Safety net for failures

### Promotion Steps (10 steps per entity)

1. **Validate Slice** - Check all 9 artifacts exist
2. **Definition Promoted** - Copy definition artifact
3. **Repository Promoted** - Copy repository artifact
4. **Service Promoted** - Copy service artifact
5. **Validator Promoted** - Copy validator artifact
6. **Events Promoted** - Copy events artifact
7. **Permissions Promoted** - Copy permissions artifact
8. **Search Promoted** - Copy search artifact
9. **Documentation Promoted** - Copy documentation
10. **Runtime Registered** - Register in Genesis Runtime

### Promotion Result

```javascript
{
  success: true,
  entityName: "Customer",
  promotedArtifacts: [
    "Definition Promoted",
    "Repository Promoted",
    ...
  ],
  registeredComponents: [
    "Definition Registered",
    "Repository Registered",
    ...
  ],
  diagnostics: [],
  rollbackPerformed: false
}
```

### Phase 7 Constraints

**What Phase 7 DOES:**
- ✓ Validates generated slices
- ✓ Builds promotion plans
- ✓ Simulates artifact promotion
- ✓ Simulates runtime registration
- ✓ Manages rollback

**What Phase 7 DOES NOT:**
- ✗ Copy files to src/core
- ✗ Modify actual runtime
- ✗ Change MetadataRuntime
- ✗ Deploy to production

### Future Phases

**Phase 8: Real File Promotion**
- Implement actual file copying
- Copy artifacts to src/core/
- Maintain artifact isolation

**Phase 9: Runtime Integration**
- Real runtime registration
- MetadataRuntime updates
- Active runtime monitoring

**Phase 10: Live Application Discovery**
- Applications discover promoted entities
- Use promoted entities
- Provide feedback loop

## Consequences

### Positive

- ✓ Establishes promotion architecture early
- ✓ Allows testing/validation of promotion logic
- ✓ Simulation is safe (no actual changes)
- ✓ Reversible by design (supports rollback)
- ✓ Immutable plans (deterministic)
- ✓ Clear path to real integration

### Negative

- ✗ Phase 7 is simulation only (no real capability yet)
- ✗ Requires Phase 8+ for actual file movement
- ✗ Promotion looks successful but makes no changes

### Mitigation

- Document Phase 7 as "simulation" prominently
- Add warnings about lack of real changes
- Provide clear path to future phases
- Keep architecture extensible

## Rationale

Implementing promotion as simulation first allows us to:

1. **Validate the architecture** before implementing real file I/O
2. **Test promotion logic** in isolation
3. **Establish deterministic behavior** without side effects
4. **Build gradually** toward full capability
5. **Keep reversibility** by design throughout phases

This approach follows the principle of "compile first, optimize later" and "validate before committing."

## References

- [ADR-0001: Genesis OS Architecture](0001-genesis-architecture.md)
- [ADR-0005: Metadata Engine Design](0005-metadata-engine.md)
- [ADR-0006: Plugin Architecture](0006-plugin-architecture.md)

## Related Documents

- [tools/genesis/compiler/promotion/README.md](../tools/genesis/compiler/promotion/README.md)
- [tools/genesis/README.md](../tools/genesis/README.md)

---

**Architecture Decision Record Created:** 2026-07-06
**Phase:** Genesis Business Compiler Phase 7
**Status:** ACCEPTED ✓

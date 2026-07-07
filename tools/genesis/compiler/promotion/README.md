# Promotion Engine (Phase 7)

## Purpose

The Promotion Engine moves validated generated artifacts from the sandbox into the Genesis Runtime in a controlled, reversible manner.

This is **Runtime Registration**, not deployment.

## Pipeline

```
Generated Slice
    ↓
Validation (all 9 artifacts present?)
    ↓
Promotion Plan (ordered steps)
    ↓
Execute Steps (simulate copying, registering)
    ↓
Success or Rollback
    ↓
Promotion Result
```

## Key Constraints

- Only validates slices are promoted
- If validation fails, promotion aborts (no rollback needed)
- Phase 7 is SIMULATION ONLY
- No actual runtime integration
- No modifications to src/core
- Architecture established for future phases

## Components

### PromotionContext

Immutable configuration for promotion operations.

```javascript
{
  entityName: "Customer",
  sourceDirectory: ".../generated/genesis/Customer",
  targetDirectory: ".../src/core",
  runtime: "simulated",
  options: {}
}
```

### PromotionPlan

Ordered list of promotion steps (10 steps per entity):

1. Validate Slice
2. Definition Promoted
3. Repository Promoted
4. Service Promoted
5. Validator Promoted
6. Events Promoted
7. Permissions Promoted
8. Search Promoted
9. Documentation Promoted
10. Runtime Registered

### PromotionEngine

Main orchestration.

```javascript
import { promoteEntity } from "PromotionEngine.mjs";

const result = await promoteEntity("Customer");
```

### PromotionResult

Immutable promotion outcome.

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

### PromotionValidator

Validates generated slices before promotion.

```javascript
import { validateSliceForPromotion } from "PromotionValidator.mjs";

const result = await validateSliceForPromotion(slicePath, entityName);
// { isValid: true, missingArtifacts: [], error: null }
```

### RuntimeRegistrar

Simulates runtime registration (no actual modification).

```javascript
import { registerEntityInRuntime } from "RuntimeRegistrar.mjs";

const registered = await registerEntityInRuntime("Customer");
// ["Definition", "Repository", "Service", ...]
```

### RollbackManager

Manages promotion rollback on failures.

```javascript
const manager = createRollbackManager();
manager.recordPromotion("Definition", "/path/to/file");
await manager.performRollback();
```

## Usage

### CLI Command

```bash
node tools/genesis/genesis.mjs promote Customer
```

### Output

```
Genesis Promotion Engine v0.1

Promoting

Customer

✓ Generated Slice Validated
✓ Definition Promoted
✓ Repository Promoted
✓ Service Promoted
✓ Validator Promoted
✓ Events Promoted
✓ Permissions Promoted
✓ Search Promoted
✓ Documentation Promoted
✓ Runtime Registered

Promotion Complete

Artifacts Promoted: 9
Components Registered: 7
Rollback: None
```

## Phase 7 Status

**SIMULATION ONLY:**
- ✓ Validates generated slices
- ✓ Builds promotion plans
- ✓ Simulates artifact promotion
- ✓ Simulates runtime registration
- ✓ Manages rollback
- ✗ Does NOT modify src/core
- ✗ Does NOT integrate with actual runtime
- ✗ Does NOT move files

## Architecture for Future Phases

Phase 7 establishes the architecture. Future phases will:

- **Phase 8:** Actual file copying (artifacts → src/core)
- **Phase 9:** Real runtime integration
- **Phase 10:** Live application discovery and use

## Implementation Notes

- All components are immutable (frozen)
- No actual file I/O (simulated)
- No runtime modifications
- Reversible by design
- Deterministic and reproducible

## Files

- `PromotionContext.mjs` - Immutable promotion configuration
- `PromotionPlan.mjs` - Ordered promotion steps
- `PromotionEngine.mjs` - Main orchestration
- `PromotionValidator.mjs` - Slice validation
- `PromotionResult.mjs` - Immutable promotion outcome
- `RuntimeRegistrar.mjs` - Simulated registration
- `RollbackManager.mjs` - Rollback management
- `README.md` - This file

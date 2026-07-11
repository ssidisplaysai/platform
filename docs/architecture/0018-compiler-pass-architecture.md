# ADR-0018: Compiler Pass Architecture

**Status:** ACCEPTED  
**Date:** 2026-07-07  
**Author:** Genesis Compiler Team  
**Phase:** Phase 9

## Context

The Genesis compiler currently orchestrates multiple stages manually:

1. Definition Registry lookup
2. Blueprint loading
3. Plan creation
4. Template rendering
5. Artifact writing
6. Validation
7. Promotion
8. Runtime registration

This manual orchestration makes it difficult to:

- Test individual compiler stages independently
- Insert new compiler capabilities
- Debug specific stages
- Extend the compiler with custom passes
- Measure per-stage performance
- Collect per-stage diagnostics
- Reorder compilation stages

Enterprise customers and plugin developers need to extend the compiler with new capabilities without modifying the core system.

## Decision

We will implement a **pass-based compiler architecture** where:

1. **Every compiler capability becomes an independent Compiler Pass**
2. **Passes are registered in an ordered registry**
3. **Pipeline executes passes sequentially**
4. **Each pass receives the same CompilationContext**
5. **Each pass returns an updated CompilationContext**
6. **Passes are independently testable and composable**

## Architecture

### Pass Registry

```
CompilerPassRegistry
├── DefinitionRegistryPass (order: 10)
├── BlueprintPass (order: 20)
├── PlanningPass (order: 30)
├── RenderingPass (order: 40)
├── WritingPass (order: 50)
├── ValidationPass (order: 60)
├── PromotionPass (order: 70)
└── RuntimeRegistrationPass (order: 80)
```

### CompilationContext

Mutable context passed through all passes:

```javascript
context = {
  entityName: 'Customer',
  definition: {...},
  blueprint: {...},
  plan: {...},
  artifacts: [...],
  diagnostics: [...],
  metadata: {...},
  options: {...},
  startTime: 1234567890,
}
```

Each pass:
1. Receives context as input
2. Modifies context
3. Returns modified context to next pass

### Compiler Pass Interface

```javascript
class CompilerPass {
  name: string;              // Unique identifier
  description: string;       // Human description
  order: number;             // Execution order

  validate(context);         // Check prerequisites
  execute(context);          // Execute pass, return context
  getMetadata();             // Get pass metadata
}
```

### Pipeline Execution

```
Pipeline.execute(context)
  ↓
Registry.list()            // Get sorted passes
  ↓
For each pass:
  - Validate prerequisites
  - Execute pass
  - Measure duration
  - Collect diagnostics
  - Stop on failure (if configured)
  ↓
Return final context + results
```

## Benefits

### 1. Testability

Each pass is independently testable:

```javascript
const context = new CompilerContext({entityName: 'Customer'});
const pass = new MyPass({...injectedDeps...});
const result = await pass.execute(context);
assert(result.artifacts.length > 0);
```

### 2. Extensibility

Enterprise customers can register new passes:

```javascript
import { globalPassRegistry } from 'genesis/compiler/pipeline';

class CustomValidationPass extends CompilerPass {
  async execute(context) {
    // Custom validation logic
    return context;
  }
}

globalPassRegistry.register(new CustomValidationPass());
```

### 3. Performance Analysis

Measure each stage's performance:

```javascript
result.results.forEach(r => {
  console.log(`${r.passName}: ${r.duration}ms`);
});
```

### 4. Debugging

Collect per-stage diagnostics:

```javascript
const context = result.context;
const errors = context.getDiagnosticsAt('error');
errors.forEach(e => console.log(e.message));
```

### 5. Reordering

Change execution order by modifying `order` property:

```javascript
const pass = new PlanningPass({order: 25}); // Run before Blueprint
```

### 6. Composition

Inject dependencies, don't create them:

```javascript
const pass = new RenderingPass({
  compiler: myCompiler,
  templateEngine: myEngine,
});
```

### 7. Backward Compatibility

Existing systems (Definition Registry, Planner, Compiler, etc.) are wrapped by passes. No breaking changes to existing APIs.

## Implementation

### File Structure

```
tools/genesis/compiler/pipeline/
├── CompilerContext.mjs          // Mutable execution context
├── CompilerPass.mjs             // Base class
├── CompilerPassResult.mjs       // Result object
├── CompilerPassRegistry.mjs     // Pass registry
├── CompilerPipeline.mjs         // Pipeline orchestrator
├── README.md                    // Documentation
└── passes/
    ├── DefinitionRegistryPass.mjs
    ├── BlueprintPass.mjs
    ├── PlanningPass.mjs
    ├── RenderingPass.mjs
    ├── WritingPass.mjs
    ├── ValidationPass.mjs
    ├── PromotionPass.mjs
    └── RuntimeRegistrationPass.mjs
```

### Built-in Passes

All built-in passes wrap existing Genesis systems:

- **DefinitionRegistryPass** → Definition Registry
- **BlueprintPass** → Blueprint Builder
- **PlanningPass** → Planner
- **RenderingPass** → Compiler/Template Engine
- **WritingPass** → Artifact Writer
- **ValidationPass** → Generated Slice Validator
- **PromotionPass** → Promotion Engine
- **RuntimeRegistrationPass** → Runtime Registration

### Execution Flow

```
compiler compile Customer
  ↓
Creates CompilerContext({entityName: 'Customer'})
  ↓
Calls CompilerPipeline.execute(context)
  ↓
Executes DefinitionRegistryPass (10)
  ├─ Loads definition from registry
  ├─ Populates context.definition
  └─ Returns context
  ↓
Executes BlueprintPass (20)
  ├─ Builds blueprint from GEDL
  ├─ Populates context.blueprint
  └─ Returns context
  ↓
Executes PlanningPass (30)
  ├─ Creates compilation plan
  ├─ Populates context.plan
  └─ Returns context
  ↓
Executes RenderingPass (40)
  ├─ Renders artifact templates
  ├─ Populates context.artifacts
  └─ Returns context
  ↓
Executes WritingPass (50)
  ├─ Writes artifacts to disk
  └─ Returns context
  ↓
Executes ValidationPass (60)
  ├─ Validates generated artifacts
  └─ Returns context or throws
  ↓
Executes PromotionPass (70)
  ├─ Promotes to runtime
  ├─ Populates context.metadata.promotionResult
  └─ Returns context
  ↓
Executes RuntimeRegistrationPass (80)
  ├─ Registers in runtime
  ├─ Populates context.metadata.runtimeRegistration
  └─ Returns context
  ↓
Returns PipelineResult {
  success: true,
  context: finalContext,
  results: [passResult1, passResult2, ...],
  duration: 1234ms,
  passCount: 8,
  failedCount: 0
}
```

## Constraints

1. **No Inheritance** - Use composition (pass interfaces, not base classes in most cases)
2. **Immutable Returns** - Passes return context, not objects
3. **Small Interfaces** - Keep CompilerPass interface minimal
4. **Node Built-ins Only** - No external dependencies
5. **Backward Compatible** - Existing systems unchanged
6. **Deterministic** - Same input always produces same output

## Future Enhancements

### Phase 10+

1. **Plugin System** - Load passes from plugins
2. **Conditional Passes** - Pass execution based on options
3. **Pass Dependencies** - Explicit dependency declaration
4. **Parallel Passes** - Execute independent passes in parallel
5. **Pass Middleware** - Pre/post execution hooks
6. **Custom Registries** - Per-project pass registries
7. **Pass Metrics** - Performance monitoring
8. **Pass Validation** - Automatic output validation

### Custom Enterprise Passes

Example: Custom enterprise validation pass

```javascript
class EnterpriseCompliancePass extends CompilerPass {
  constructor(complianceEngine) {
    super({
      name: 'EnterpriseCompliance',
      description: 'Validate against enterprise policies',
      order: 55, // Between Writing and Validation
    });
    this.engine = complianceEngine;
  }

  async execute(context) {
    const compliance = await this.engine.validate(
      context.entityName,
      context.artifacts
    );

    if (!compliance.valid) {
      context.addDiagnostic('warning', 'Compliance issues', {
        violations: compliance.violations,
      });
    }

    return context;
  }
}

// Register in pipeline
globalPassRegistry.register(new EnterpriseCompliancePass(engine));
```

## Rationale

### Why Passes?

Passes provide clear separation of concerns:

- Each pass has one responsibility
- Easy to understand pass behavior
- Easy to test pass independently
- Easy to debug specific stages
- Easy to profile performance
- Easy to extend with new capabilities

### Why a Registry?

A registry provides:

- Flexible pass management
- Runtime pass registration
- Custom pass ordering
- Conditional pass execution
- Multiple pipeline configurations

### Why CompilationContext?

A shared context provides:

- Data flow between passes
- Unified diagnostics collection
- Shared metadata
- Reduced parameter passing
- Better testability

## Backward Compatibility

This change is **fully backward compatible**:

1. Existing compiler command works unchanged
2. Definition Registry unchanged
3. Planner unchanged
4. Compiler unchanged
5. All existing tests pass
6. No API changes to generated code

The pass architecture is an **implementation detail** transparent to users.

## Testing Strategy

### Unit Tests

Test each pass independently:

```javascript
describe('DefinitionRegistryPass', () => {
  it('loads definition from registry', async () => {
    const context = new CompilerContext({entityName: 'Customer'});
    const pass = new DefinitionRegistryPass({registry: mockRegistry});
    const result = await pass.execute(context);
    assert(result.definition !== null);
  });
});
```

### Integration Tests

Test pipeline execution:

```javascript
describe('CompilerPipeline', () => {
  it('executes all passes successfully', async () => {
    const context = new CompilerContext({entityName: 'Customer'});
    const pipeline = new CompilerPipeline();
    const result = await pipeline.execute(context);
    assert(result.success === true);
    assert(result.failedCount === 0);
  });
});
```

### Regression Tests

Ensure Customer generation unchanged:

```javascript
describe('Customer compilation', () => {
  it('generates same artifacts as before', async () => {
    const result = await compiler.compile('Customer');
    assert(result.artifacts.length === 9);
    assert(result.success === true);
  });
});
```

## References

- [Compiler Pass Architecture Specification](./pipeline/README.md)
- [Phase 8: Blueprint Engine](./0016-genesis-entity-definition-language.md)
- [Phase 7: Runtime Registration](./0010-runtime-registration-promotion.md)

## Decision Outcome

**ACCEPTED**

The pass-based compiler architecture will:

1. Replace manual compiler orchestration
2. Become the standard for extending Genesis
3. Enable enterprise plugin development
4. Improve testability and debuggability
5. Maintain full backward compatibility

Implementation begins in Phase 9.

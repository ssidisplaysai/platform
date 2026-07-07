# Compiler Pipeline

The Compiler Pipeline implements a pass-based architecture for code generation.

Each stage of the compilation process is an independent, testable **Compiler Pass**.

## Architecture

```
Compiler Pipeline
      ↓
 [Pass Registry]
      ↓
[Ordered Pass List]
      ↓
Execute Pass 1 ──→ CompilationContext ──→ Pass 1 Result
      ↓
Execute Pass 2 ──→ CompilationContext ──→ Pass 2 Result
      ↓
Execute Pass 3 ──→ CompilationContext ──→ Pass 3 Result
      ↓
... (more passes)
      ↓
Final CompilationContext
```

## Core Components

### CompilerContext

Mutable execution context passed through each pass.

**Fields:**
- `entityName` - Name of entity being compiled
- `definition` - Entity definition (populated by DefinitionRegistryPass)
- `blueprint` - Entity blueprint from GEDL (populated by BlueprintPass)
- `plan` - Compilation plan (populated by PlanningPass)
- `artifacts` - Generated artifacts (populated by RenderingPass)
- `diagnostics` - Compilation diagnostics
- `metadata` - Execution metadata
- `options` - Compiler options

**Methods:**
- `addDiagnostic(level, message, details)` - Add diagnostic
- `addArtifact(artifact)` - Add generated artifact
- `getArtifacts()` - Get immutable artifacts
- `getDiagnosticsAt(level)` - Filter diagnostics by level
- `getElapsedTime()` - Get execution duration
- `toJSON()` - Get immutable snapshot

### CompilerPass

Base class for all compiler passes.

**Required:**
- `name` - Unique pass identifier
- `description` - Pass description
- `order` - Execution order (default: 100)

**Methods:**
- `async execute(context)` - Execute pass, return updated context
- `validate(context)` - Optional: validate prerequisites
- `success(duration, diagnostics, metadata)` - Create success result
- `failure(error, duration, diagnostics)` - Create failure result
- `getMetadata()` - Get pass metadata

**Returns:**
- `CompilationContext` - Updated context for next pass
- Throws on error (unless `stopOnFailure: false`)

### CompilerPassResult

Result object from each pass execution.

**Fields:**
- `success` - Whether pass succeeded
- `passName` - Name of pass
- `diagnostics` - Pass diagnostics
- `duration` - Execution time (ms)
- `metadata` - Pass metadata
- `error` - Error message if failed

**Static Methods:**
- `CompilerPassResult.success(name, duration, diagnostics, metadata)`
- `CompilerPassResult.failure(name, error, duration, diagnostics)`

### CompilerPassRegistry

Registry for managing all available compiler passes.

**Methods:**
- `register(pass)` - Register a compiler pass
- `get(passName)` - Get pass by name
- `has(passName)` - Check if registered
- `list()` - List all passes in execution order
- `count()` - Get count of registered passes
- `clear()` - Clear all passes (testing)
- `getMetadata()` - Get registry metadata

**Global Instance:**
```javascript
import { globalPassRegistry } from './CompilerPassRegistry.mjs';
globalPassRegistry.register(myPass);
```

### CompilerPipeline

Main orchestrator for executing compiler passes.

**Methods:**
- `async execute(context)` - Execute all passes
- `getMetadata()` - Get pipeline metadata

**Returns:**
```javascript
{
  success: boolean,
  context: CompilationContext,
  results: CompilerPassResult[],
  duration: number,
  passCount: number,
  failedCount: number
}
```

## Built-in Passes

All built-in passes are in the `passes/` directory.

### DefinitionRegistryPass (Order: 10)

Loads entity definition from the Definition Registry.

**Prerequisites:**
- Context has `entityName`
- Registry injected in constructor

**Populates:**
- `context.definition`

### BlueprintPass (Order: 20)

Loads and builds entity blueprint from GEDL definition.

**Prerequisites:**
- `context.entityName` set
- BlueprintBuilder injected in constructor

**Populates:**
- `context.blueprint`

### PlanningPass (Order: 30)

Creates compilation plan based on blueprint.

**Prerequisites:**
- `context.blueprint` populated
- Planner injected in constructor

**Populates:**
- `context.plan`

### RenderingPass (Order: 40)

Renders artifact templates using the template engine.

**Prerequisites:**
- `context.plan` populated
- Compiler injected in constructor

**Populates:**
- `context.artifacts`

### WritingPass (Order: 50)

Writes generated artifacts to disk.

**Prerequisites:**
- `context.artifacts` populated
- Writer injected in constructor

**Effects:**
- Files written to `generated/genesis/{entity}/`

### ValidationPass (Order: 60)

Validates all generated artifacts.

**Prerequisites:**
- `context.artifacts` populated
- Validator injected in constructor

**Effects:**
- Verifies all 9 required artifacts exist
- Throws on validation failure

### PromotionPass (Order: 70)

Promotes validated artifacts to runtime.

**Prerequisites:**
- `context.entityName` set
- PromotionEngine injected in constructor

**Effects:**
- Moves artifacts from `generated/genesis/` to runtime
- Simulated in Phase 9

### RuntimeRegistrationPass (Order: 80)

Registers entity in runtime.

**Prerequisites:**
- `context.entityName` set
- Runtime injected in constructor

**Effects:**
- Registers 7 runtime components
- Simulated in Phase 9

## Usage

### Basic Pipeline Execution

```javascript
import { CompilerPipeline } from './CompilerPipeline.mjs';
import { CompilerContext } from './CompilerContext.mjs';

// Create context
const context = new CompilerContext({
  entityName: 'Customer',
});

// Execute pipeline
const pipeline = new CompilerPipeline();
const result = await pipeline.execute(context);

if (result.success) {
  console.log(`✓ Compilation succeeded`);
  console.log(`✓ Generated ${result.context.artifacts.length} artifacts`);
  console.log(`✓ Executed ${result.passCount} passes in ${result.duration}ms`);
} else {
  console.log(`✗ Compilation failed`);
  console.log(`✗ Failed passes: ${result.failedCount}`);
}
```

### Register Custom Pass

```javascript
import { CompilerPass } from './CompilerPass.mjs';
import { globalPassRegistry } from './CompilerPassRegistry.mjs';

class CustomPass extends CompilerPass {
  constructor() {
    super({
      name: 'CustomOperation',
      description: 'My custom compiler pass',
      order: 75, // Between Promotion and RuntimeRegistration
    });
  }

  async execute(context) {
    // Do custom work
    context.addDiagnostic('info', 'Custom pass executed');
    return context;
  }
}

globalPassRegistry.register(new CustomPass());
```

### Custom Pipeline

```javascript
import { CompilerPipeline } from './CompilerPipeline.mjs';
import { CompilerPassRegistry } from './CompilerPassRegistry.mjs';

// Create custom registry
const customRegistry = new CompilerPassRegistry();
customRegistry.register(pass1);
customRegistry.register(pass2);
customRegistry.register(pass3);

// Create pipeline with custom registry
const pipeline = new CompilerPipeline({
  registry: customRegistry,
  stopOnFailure: true,
});

const result = await pipeline.execute(context);
```

## Pass Development

### Creating a New Pass

```javascript
import { CompilerPass } from '../CompilerPass.mjs';

export class MyPass extends CompilerPass {
  constructor(options = {}) {
    super({
      name: 'MyCustomPass',
      description: 'Description of what pass does',
      order: 45, // Execution order
      ...options,
    });

    // Inject dependencies
    this.myService = options.myService;
  }

  // Validate prerequisites
  validate(context) {
    if (!context.blueprint) {
      return {
        isValid: false,
        error: 'Blueprint required',
      };
    }
    return { isValid: true };
  }

  // Execute pass
  async execute(context) {
    try {
      // Do work
      const result = await this.myService.doWork(context.entityName);

      // Add diagnostics
      context.addDiagnostic('info', 'Work completed', {
        result: result.count,
      });

      // Return updated context
      return context;
    } catch (error) {
      throw error;
    }
  }
}
```

### Pass Guidelines

1. **Keep Focused** - Each pass handles one responsibility
2. **Validate Input** - Check prerequisites in `validate()`
3. **Add Diagnostics** - Document pass execution
4. **Update Context** - Pass returns modified context
5. **Handle Errors** - Throw errors for pipeline to catch
6. **Immutable Results** - Don't mutate inputs
7. **Composition** - Inject dependencies, don't create them

## Testing Passes

```javascript
import { CompilerContext } from './CompilerContext.mjs';
import { MyPass } from './passes/MyPass.mjs';

// Create context
const context = new CompilerContext({
  entityName: 'Customer',
  blueprint: mockBlueprint,
});

// Create pass with mocks
const pass = new MyPass({
  myService: mockService,
});

// Validate
const validation = pass.validate(context);
if (!validation.isValid) {
  console.error(validation.error);
}

// Execute
const result = await pass.execute(context);

// Check results
console.log(result.artifacts.length); // Check generated artifacts
console.log(result.getDiagnosticsAt('error')); // Check for errors
```

## Error Handling

The pipeline stops on the first failure by default:

```javascript
const pipeline = new CompilerPipeline({
  stopOnFailure: true, // default
});
```

To continue on failure:

```javascript
const pipeline = new CompilerPipeline({
  stopOnFailure: false,
});

const result = await pipeline.execute(context);
console.log(`Failed passes: ${result.failedCount}`);
```

## Diagnostics

Each pass can add diagnostics at different levels:

```javascript
// Information
context.addDiagnostic('info', 'Definition loaded', { fields: 5 });

// Warnings
context.addDiagnostic('warning', 'Field count exceeds 100', { count: 150 });

// Errors
context.addDiagnostic('error', 'Missing required field', { field: 'id' });
```

Access diagnostics:

```javascript
const context = result.context;
const errors = context.getDiagnosticsAt('error');
const warnings = context.getDiagnosticsAt('warning');
const infos = context.getDiagnosticsAt('info');
```

## Performance

Each pass records execution duration:

```javascript
const result = await pipeline.execute(context);

result.results.forEach((passResult) => {
  console.log(`${passResult.passName}: ${passResult.duration}ms`);
});

console.log(`Total pipeline: ${result.duration}ms`);
```

## Integration

The compiler pipeline integrates with:

- **Definition Registry** - Load entity definitions
- **Blueprint Builder** - Build GEDL blueprints
- **Planner** - Create compilation plans
- **Compiler** - Render templates
- **Artifact Writer** - Write files
- **Generated Slice Validator** - Validate artifacts
- **Promotion Engine** - Promote to runtime
- **Runtime** - Register in runtime

All existing systems are wrapped by passes, maintaining backward compatibility.

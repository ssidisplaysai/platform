# Genesis Artifact Writers — Phase 4

The Artifact Writers subsystem handles safe, controlled writing of generated artifacts to the file system.

## Architecture

### Three Components

**ArtifactRecord.mjs**
- Represents a single generated artifact
- Contains: id, stepId, type, name, targetPath, content, status
- Immutable (frozen after creation)
- Export: `createArtifactRecord(input)`

**WriteResult.mjs**
- Represents the result of a write operation
- Contains: success, mode, written, skipped, artifacts, diagnostics
- Immutable (frozen after creation)
- Export: `createWriteResult(input)`

**ArtifactWriter.mjs**
- Main write subsystem
- Conditional behavior based on mode
- Export: `writeArtifacts(context)`

## Modes

### Dry-Run (Default)

In dry-run mode:
- No files are written to disk
- All artifacts are marked as "planned"
- Diagnostics show what would happen
- Safe for inspection and validation

```javascript
writeArtifacts({
  rootDir: "/path/to/project",
  artifacts: [...],
  mode: "dry-run",
})
```

### Write

In write mode:
- Files are written to their targetPath
- Directories are created as needed
- Existing files are skipped unless `force` is true
- Diagnostics show what was written and skipped

```javascript
writeArtifacts({
  rootDir: "/path/to/project",
  artifacts: [...],
  mode: "write",
  force: false, // skip existing files
})
```

## Usage

```javascript
import { writeArtifacts } from "./compiler/writers/ArtifactWriter.mjs";

const result = writeArtifacts({
  rootDir: process.cwd(),
  artifacts: compiledArtifacts,
  mode: "write", // or "dry-run"
  force: false,
});

console.log(`Written: ${result.written}, Skipped: ${result.skipped}`);
```

## Safety Rules

1. **Dry-run is default** — All operations must explicitly opt-in to writing
2. **No force by default** — Existing files are never overwritten without explicit request
3. **Paths are relative** — targetPath is always relative to rootDir
4. **Directories created** — Parent directories are created as needed
5. **Immutable results** — Results and artifacts cannot be modified after creation

## Phase 4 Constraints

- **Placeholder content only** — No real business logic
- **No CRM generation** — Writer is generic, not Customer-specific
- **No runtime integration** — Writer does not modify MetadataRuntime
- **No React/UI** — Writer is backend-only
- **Node.js only** — Uses only fs and path modules

## Future Phases

- Phase 5: Template execution and binding
- Phase 6: Registry integration
- Phase 7: Automation and scheduling

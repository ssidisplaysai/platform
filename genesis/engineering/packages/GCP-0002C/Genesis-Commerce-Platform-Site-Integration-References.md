# Genesis Commerce Platform Site Integration References

## Reference Model
Site integrations are represented through opaque references:
1. wordpressApiBaseUrl
2. wordpressCredentialReference
3. workflowReference
4. promptProfileReference
5. imageProfileReference
6. seoProfileReference
7. brandProfileReference
8. analyticsProfileReference

## Security Position
1. No raw credentials are stored in site models.
2. No provider-specific secret payloads are embedded in UI components.
3. Reference fields are display-safe and validation-safe identifiers.

## Current Site Baseline
1. LED Display Warehouse includes WordPress API base URL and credential reference token.
2. Workflow and profile references remain unconfigured where repository evidence is absent.
3. Secondary Test Site leaves integration references unconfigured by design.

## Publishing Safety Implication
Missing references propagate deterministic blockers in readiness and publishing guard outputs.

# Template Classification

## Full Inventory Classification: tools/genesis/templates

### core-object-system

- tools/genesis/templates/core-object-system/GenesisDefinition.ts => build-time source
- tools/genesis/templates/core-object-system/GenesisInstance.ts => build-time source
- tools/genesis/templates/core-object-system/GenesisObject.ts => build-time source
- tools/genesis/templates/core-object-system/ObjectAudit.ts => build-time source
- tools/genesis/templates/core-object-system/ObjectIdentity.ts => build-time source
- tools/genesis/templates/core-object-system/ObjectKnowledge.ts => build-time source
- tools/genesis/templates/core-object-system/ObjectLifecycle.ts => build-time source
- tools/genesis/templates/core-object-system/ObjectMetadata.ts => build-time source
- tools/genesis/templates/core-object-system/ObjectPermission.ts => build-time source
- tools/genesis/templates/core-object-system/ObjectRelationship.ts => build-time source
- tools/genesis/templates/core-object-system/ObjectTimeline.ts => build-time source
- tools/genesis/templates/core-object-system/README.md => documentation example

### entity

- tools/genesis/templates/entity/definition.template.ts => placeholder artifact / code-generation template
- tools/genesis/templates/entity/repository.template.ts => placeholder artifact / code-generation template
- tools/genesis/templates/entity/service.template.ts => placeholder artifact / code-generation template
- tools/genesis/templates/entity/validator.template.ts => placeholder artifact / code-generation template
- tools/genesis/templates/entity/events.template.ts => placeholder artifact / code-generation template
- tools/genesis/templates/entity/permissions.template.ts => placeholder artifact / code-generation template
- tools/genesis/templates/entity/search.template.ts => placeholder artifact / code-generation template
- tools/genesis/templates/entity/tests.template.ts => placeholder artifact / scaffold template
- tools/genesis/templates/entity/documentation.template.md => documentation example
- tools/genesis/templates/entity/TemplateRenderer.mjs => runtime source
- tools/genesis/templates/entity/validate-templates.mjs => runtime source (new)

## Classification Decision Summary

1. Placeholder templates are non-compilable source artifacts by design.
2. Runtime renderer and validator are executable infrastructure and remain in quality gates.
3. Build-time core object templates are treated as source artifacts; they are not broadly excluded by policy.
4. Documentation templates are examples and not TypeScript compile targets.

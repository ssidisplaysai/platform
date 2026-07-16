# GCC-1006 API Documentation

## New Models
- EnterpriseBlueprint
- EnterpriseBlueprintIR
- BlueprintCompilationContext
- BlueprintCompilationResult
- BlueprintIdentity
- BlueprintVersion
- BlueprintLineage
- BlueprintProvenance
- BlueprintConfidence
- BlueprintConflict
- EnterpriseDefinition
- DomainDefinition
- BoundedContextDefinition
- ModuleDefinition
- ApplicationDefinition
- ServiceDefinition
- ApiDefinition
- DatabaseDefinition
- SchemaDefinition
- AggregateDefinition
- EntityDefinition
- ValueObjectDefinition
- RepositoryDefinition
- CommandDefinition
- QueryDefinition
- EventDefinition
- WorkflowDefinition
- IntegrationDefinition
- PermissionDefinition
- RoleDefinition
- PolicyDefinition
- RuntimeDefinition
- InfrastructureDefinition
- DeploymentDefinition
- EnvironmentDefinition
- ConfigurationDefinition
- SecretReferenceDefinition
- MonitoringDefinition
- SchedulingDefinition
- MessagingDefinition
- StorageDefinition
- NetworkDefinition
- SecurityDefinition

## New Compiler APIs
- BlueprintCompiler.compile(input: BusinessGenomeIR): EnterpriseBlueprintIR
- BlueprintCompiler.compileWithResult(input: BusinessGenomeIR): BlueprintCompilationResult
- BlueprintValidator.validate(ir: EnterpriseBlueprintIR): BlueprintDiagnostic[]
- BlueprintIdentityFactory.generate(...): BlueprintIdentity

## New Core Pass API
- BlueprintCompilerPass (id: blueprint-pass)
  - input: BusinessGenomePassOutput
  - output: BlueprintPassOutput

# GCC-1005 API Documentation

## New Models
- BusinessGenome
- BusinessGenomeIR
- BusinessGenomeCompilationContext
- BusinessGenomeCompilationResult
- GenomeIdentity
- GenomeVersion
- GenomeLineage
- GenomeProvenance
- GenomeConfidence
- GenomeConflict
- GenomeEntity
- GenomeRelationship
- GenomeCapability
- GenomeProcess
- GenomePolicy
- GenomeRule
- GenomeRole
- GenomeResponsibility
- GenomeResource
- GenomeEvent
- GenomeWorkflow
- GenomeConstraint
- GenomeMetric
- GenomeObjective
- GenomeTemporalValidity

## New Compiler APIs
- BusinessGenomeCompiler.compile(input: KnowledgeIR): BusinessGenomeIR
- BusinessGenomeCompiler.compileWithResult(input: KnowledgeIR): BusinessGenomeCompilationResult
- BusinessGenomeValidator.validate(ir: BusinessGenomeIR): GenomeDiagnostic[]
- GenomeIdentityFactory.generate(...): GenomeIdentity

## New Core Pass API
- BusinessGenomeCompilerPass (id: business-genome-pass)
  - input: KnowledgePassOutput
  - output: BusinessGenomePassOutput

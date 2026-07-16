# GCC-1008 API Documentation

Exports:
- RuntimeCompiler
- RuntimeHasher
- RuntimeValidator
- RuntimeIdentityFactory
- EnterpriseRuntimeIR and runtime model types
- RuntimeCompilerPass

New files:
- src/compiler/runtime/EnterpriseRuntimeIR.ts
- src/compiler/runtime/RuntimeIdentity.ts
- src/compiler/runtime/RuntimeHasher.ts
- src/compiler/runtime/RuntimeValidator.ts
- src/compiler/runtime/RuntimeCompiler.ts
- src/compiler/runtime/index.ts
- src/compiler/core/passes/RuntimeCompilerPass.ts

Modified public surfaces:
- src/compiler/core/types.ts (CompilerCoreOutput.enterpriseRuntimeIR)
- src/compiler/core/index.ts (RuntimeCompilerPass export)
- src/compiler/index.ts (runtime exports and runtime types)
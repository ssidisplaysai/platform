# GRT-0001 API Documentation

Primary public entry point:
- RuntimeKernel (src/runtime/kernel/RuntimeKernel.ts)

Core methods:
- boot(runtimeIR, options?): RuntimeContext
- shutdown(reason?): RuntimeContext
- recover(): RuntimeContext
- dispose(): RuntimeContext
- state(): RuntimeKernelState

Supporting API:
- RuntimeContext.snapshot(): RuntimeContextSnapshot
- RuntimeKernelValidator.validate(input, graph): RuntimeValidationResult
- DependencyContainer.register/validate/snapshot
- RuntimeScheduler.register* and list
- EventDispatcher.emit/history

Data contracts:
- RuntimeKernelState, RuntimeKernelDiagnostic, RuntimeKernelEvent, RuntimeKernelMetrics
- RuntimeConfiguration, RuntimeDependencyGraph, RuntimeContextSnapshot

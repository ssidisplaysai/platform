# GRT-0002 API Documentation

Module entrypoint:
- src/runtime/host/index.ts

Primary runtime host API:
- EnterpriseHost(config)
- bootstrap(defaultEnvironment, defaultProfile)
- registerEnvironment(environment)
- registerProfile(profile)
- createRuntimeInstance(runtimeIR, options?)
- activateRuntime(instanceId)
- startRuntime(instanceId)
- deactivateRuntime(instanceId)
- shutdownRuntime(instanceId)
- restartRuntime(instanceId)
- suspendRuntime(instanceId)
- resumeRuntime(instanceId)
- crashRuntime(instanceId, reason)
- recoverRuntime(instanceId)
- superviseRuntimes()
- persistRuntimeState(instanceId)
- restoreRuntimeState(instanceId)
- disposeRuntime(instanceId)
- orchestrateStartup(instanceIds?)
- orchestrateShutdown(instanceIds?)
- shutdownHost()
- disposeHost()
- snapshot()

Host support components:
- HostStateMachine
- EnvironmentRegistry
- ProfileRegistry
- HostDiagnostics
- HostEventRouter
- HostTelemetry
- RuntimeDependencyResolver
- RuntimeActivationPipeline
- RuntimeStateStore

Type surface:
- HostEnvironment, HostProfile
- RuntimeHostConfig, RuntimeHostSnapshot, RuntimeHostTelemetry, RuntimeHostMetrics
- RuntimeInstanceRecord, RuntimeInstanceSummary, RuntimeStateRecord
- HostState, RuntimeInstanceState

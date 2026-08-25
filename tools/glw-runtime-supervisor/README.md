# Genesis GLW Runtime Supervisor

This directory contains the HR004 SUP-M1 implementation foundation. It targets Windows x64 with .NET 10 NativeAOT.

SUP-M1 is intentionally inert. The executable validates its platform and reports that runtime lifecycle behavior is unavailable. It cannot create or terminate a process or Job, control port 3001, access production authority, install a task, deploy, migrate, or roll back GLW.

## Controlled builder

Required builder inputs:

- .NET SDK 10.0.100
- Visual Studio 2022 Build Tools with the pinned MSVC x64 toolset
- Windows SDK 10.0.26100.0
- x64 Windows host

The production host is not a builder. Do not install build prerequisites there to run these commands.

## Validation

From this directory on the controlled builder:

```powershell
dotnet restore Genesis.GLW.RuntimeSupervisor.slnx --use-lock-file
./eng/Verify-SupM1Boundary.ps1
dotnet build Genesis.GLW.RuntimeSupervisor.slnx --configuration Release --no-restore
dotnet run --project tests/Genesis.GLW.RuntimeSupervisor.Tests/Genesis.GLW.RuntimeSupervisor.Tests.csproj --configuration Release --no-build
dotnet publish src/Genesis.GLW.RuntimeSupervisor/Genesis.GLW.RuntimeSupervisor.csproj --configuration Release --no-restore --output artifacts/publish/win-x64
```

After the first authorized restore, generated `packages.lock.json` files must be reviewed and retained. Subsequent certification restores must use `--locked-mode`.

`Verify-SupM1Boundary.ps1` is a read-only defense-in-depth source-policy gate. It scans C#, project, props, and targets files; validates the exact approved production import set; and rejects known lifecycle, dynamic binding, shell, and MSBuild execution primitives. It is not a formal semantic proof and does not replace source review or controlled-builder inspection.

The test assembly uses isolated Windows resources to verify `CloseHandle` and `LocalFree` with post-disposal OS evidence. It also verifies that valid initialized process-attribute-list and duplicated certificate-context wrappers reach the disposed state; direct post-release probing is intentionally not claimed because it would require unsafe stale-pointer use. These are test-only integration fixtures and do not reference GLW processes, tasks, ports, configuration, or production paths.

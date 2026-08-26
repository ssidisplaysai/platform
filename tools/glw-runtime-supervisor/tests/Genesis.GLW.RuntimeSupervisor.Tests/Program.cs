using Genesis.GLW.RuntimeSupervisor.Foundation;
using Genesis.GLW.RuntimeSupervisor.Interop;
using Microsoft.Win32.SafeHandles;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using System.Xml.Linq;

var supM3FixtureMode =
    Environment.GetEnvironmentVariable(
        "GENESIS_SUP_M3_FIXTURE_MODE");

if (string.Equals(
    supM3FixtureMode,
    "RUNNING",
    StringComparison.Ordinal))
{
    Thread.Sleep(TimeSpan.FromSeconds(2));
    return 0;
}

if (string.Equals(
    supM3FixtureMode,
    "COMPLETED",
    StringComparison.Ordinal))
{
    return 37;
}
var tests = new (string Name, Action Body)[]
{
    ("Project files target Windows x64 NativeAOT", ProjectFilesTargetWindowsX64NativeAot),
    ("Platform guard accepts Windows x64", PlatformGuardAcceptsWindowsX64),
    ("Platform guard rejects unsupported targets", PlatformGuardRejectsUnsupportedTargets),
    ("SafeHandle owns and releases an isolated handle", SafeHandleOwnsAndReleasesFixture),
    ("SafeHandle disposal is idempotent", SafeHandleDisposalIsIdempotent),
    ("Invalid SafeHandles remain invalid", InvalidSafeHandlesRemainInvalid),
    ("ReleaseHandle is non-throwing", ReleaseHandleIsNonThrowing),
    ("Handle inheritance defaults off", HandleInheritanceDefaultsOff),
    ("Native error capture is immediate", NativeErrorCaptureIsImmediate),
    ("Safe file handle uses framework implementation", SafeFileHandleUsesFrameworkImplementation),
    ("Lease basic acquire and release", LeaseBasicAcquireAndRelease),
    ("Lease repeated disposal releases once", LeaseRepeatedDisposeReleasesOnce),
    ("Lease aliases share one release obligation", LeaseAliasesShareOneReleaseObligation),
    ("Lease concurrent disposal releases once", LeaseConcurrentDisposeReleasesOnce),
    ("Lease exposes no raw handle authority", LeaseExposesNoRawHandleAuthority),
    ("Lease rejects invalid and closed handles", LeaseRejectsInvalidAndClosedHandles),
    ("Lease retains the underlying SafeHandle", LeaseRetainsUnderlyingSafeHandle),
    ("Failed lease acquisition requires no release", FailedLeaseAcquisitionRequiresNoRelease),
    ("Lease has no finalizer", LeaseHasNoFinalizer),
    ("LocalAlloc wrapper frees isolated memory", LocalAllocWrapperFreesIsolatedMemory),
    ("Initialized attribute list reaches disposed state", InitializedAttributeListReachesDisposedState),
    ("Certificate context reaches disposed state", CertificateContextReachesDisposedState),
    ("Approved isolated runtime observation surface", ApprovedIsolatedRuntimeObservationSurface),
    ("Isolated process reports running state", IsolatedProcessReportsRunningState),
    ("Isolated process zero timeout reports running", IsolatedProcessZeroTimeoutReportsRunning),
    ("Isolated process bounded wait observes exit", IsolatedProcessBoundedWaitObservesExit),
    ("Isolated process exposes exit code after exit", IsolatedProcessExposesExitCodeAfterExit),
    ("Isolated process rejects exit code while running", IsolatedProcessRejectsExitCodeWhileRunning),
    ("Isolated process rejects invalid timeout", IsolatedProcessRejectsInvalidTimeout),
    ("Disposed isolated process rejects observation", DisposedIsolatedProcessRejectsObservation),
    ("Owned isolated process can be terminated", OwnedIsolatedProcessCanBeTerminated),
    ("Owned termination preserves requested exit code", OwnedTerminationPreservesRequestedExitCode),
    ("Owned termination rejects already exited process", OwnedTerminationRejectsAlreadyExitedProcess),
    ("Disposed isolated process rejects termination", DisposedIsolatedProcessRejectsTermination),
    ("Owned terminate-and-wait observes exit", OwnedTerminateAndWaitObservesExit),
    ("Owned terminate-and-wait preserves requested exit code", OwnedTerminateAndWaitPreservesRequestedExitCode),
    ("Owned terminate-and-wait rejects already exited process", OwnedTerminateAndWaitRejectsAlreadyExitedProcess),
    ("Owned terminate-and-wait rejects invalid timeout", OwnedTerminateAndWaitRejectsInvalidTimeout),
    ("Disposed isolated process rejects terminate-and-wait", DisposedIsolatedProcessRejectsTerminateAndWait),
    ("Owned result coordination observes exit", OwnedResultCoordinationObservesExit),
    ("Owned result coordination reports observed exit code", OwnedResultCoordinationReportsObservedExitCode),
    ("Owned result coordination reports timeout without exit code", OwnedResultCoordinationReportsTimeoutWithoutExitCode),
    ("Owned result coordination rejects already exited process", OwnedResultCoordinationRejectsAlreadyExitedProcess),
    ("Owned result coordination rejects invalid timeout", OwnedResultCoordinationRejectsInvalidTimeout),
    ("Disposed isolated process rejects result coordination", DisposedIsolatedProcessRejectsResultCoordination),
    ("Owned wait-for-result observes exit", OwnedWaitForResultObservesExit),
    ("Owned wait-for-result reports observed exit code", OwnedWaitForResultReportsObservedExitCode),
    ("Owned wait-for-result reports timeout without exit code", OwnedWaitForResultReportsTimeoutWithoutExitCode),
    ("Owned wait-for-result rejects invalid timeout", OwnedWaitForResultRejectsInvalidTimeout),
    ("Disposed isolated process rejects wait-for-result", DisposedIsolatedProcessRejectsWaitForResult),
    ("Supervisor observation reports running process", SupervisorObservationReportsRunningProcess),
    ("Supervisor observation reports exited process", SupervisorObservationReportsExitedProcess),
    ("Supervisor observation preserves observed exit code", SupervisorObservationPreservesObservedExitCode),
    ("Supervisor observation rejects disposed process", SupervisorObservationRejectsDisposedProcess),
    ("Supervisor state classifies running process", SupervisorStateClassifiesRunningProcess),
    ("Supervisor state classifies successful exit", SupervisorStateClassifiesSuccessfulExit),
    ("Supervisor state classifies failed exit", SupervisorStateClassifiesFailedExit),
    ("Supervisor state rejects running observation with exit code", SupervisorStateRejectsRunningObservationWithExitCode),
    ("Supervisor state rejects exited observation without exit code", SupervisorStateRejectsExitedObservationWithoutExitCode),
    ("Supervisor snapshot represents running process", SupervisorSnapshotRepresentsRunningProcess),
    ("Supervisor snapshot reports running process healthy", SupervisorSnapshotReportsRunningProcessHealthy),
    ("Supervisor snapshot represents successful exit", SupervisorSnapshotRepresentsSuccessfulExit),
    ("Supervisor snapshot reports successful exit unhealthy", SupervisorSnapshotReportsSuccessfulExitUnhealthy),
    ("Supervisor snapshot represents failed exit", SupervisorSnapshotRepresentsFailedExit),
    ("Supervisor snapshot reports failed exit unhealthy", SupervisorSnapshotReportsFailedExitUnhealthy),
    ("Supervisor snapshot preserves process observation", SupervisorSnapshotPreservesProcessObservation),
    ("Supervisor snapshot preserves semantic process state", SupervisorSnapshotPreservesSemanticProcessState),
    ("Supervisor snapshot rejects running observation with exit code", SupervisorSnapshotRejectsRunningObservationWithExitCode),
    ("Supervisor snapshot rejects exited observation without exit code", SupervisorSnapshotRejectsExitedObservationWithoutExitCode),
    ("Supervisor snapshot creation is deterministic", SupervisorSnapshotCreationIsDeterministic),
    ("Supervisor decision continues monitoring running healthy snapshot", SupervisorDecisionContinuesMonitoringRunningHealthySnapshot),
    ("Supervisor decision remains stopped after successful exit", SupervisorDecisionRemainsStoppedAfterSuccessfulExit),
    ("Supervisor decision requires recovery after failed exit", SupervisorDecisionRequiresRecoveryAfterFailedExit),
    ("Supervisor decision evaluation is deterministic", SupervisorDecisionEvaluationIsDeterministic),
    ("Supervisor decision rejects running unhealthy snapshot", SupervisorDecisionRejectsRunningUnhealthySnapshot),
    ("Supervisor decision rejects successful exit healthy snapshot", SupervisorDecisionRejectsSuccessfulExitHealthySnapshot),
    ("Supervisor decision rejects failed exit healthy snapshot", SupervisorDecisionRejectsFailedExitHealthySnapshot),
    ("Supervisor decision rejects observation state disagreement", SupervisorDecisionRejectsObservationStateDisagreement),
    ("Supervisor decision preserves fail-closed observation semantics", SupervisorDecisionPreservesFailClosedObservationSemantics),
    ("Supervisor action continues monitoring for continue decision", SupervisorActionContinuesMonitoringForContinueDecision),
    ("Supervisor action performs no action for remain stopped decision", SupervisorActionPerformsNoActionForRemainStoppedDecision),
    ("Supervisor action requests recovery for recovery required decision", SupervisorActionRequestsRecoveryForRecoveryRequiredDecision),
    ("Supervisor action planning is deterministic", SupervisorActionPlanningIsDeterministic),
    ("Supervisor action rejects running unhealthy snapshot", SupervisorActionRejectsRunningUnhealthySnapshot),
    ("Supervisor action rejects successful exit healthy snapshot", SupervisorActionRejectsSuccessfulExitHealthySnapshot),
    ("Supervisor action rejects failed exit healthy snapshot", SupervisorActionRejectsFailedExitHealthySnapshot),
    ("Supervisor action rejects observation state disagreement", SupervisorActionRejectsObservationStateDisagreement),
    ("Supervisor action preserves fail-closed observation semantics", SupervisorActionPreservesFailClosedObservationSemantics),
    ("Supervisor recovery request is created for request recovery action", SupervisorRecoveryRequestIsCreatedForRequestRecoveryAction),
    ("Supervisor recovery request is absent for continue monitoring action", SupervisorRecoveryRequestIsAbsentForContinueMonitoringAction),
    ("Supervisor recovery request is absent for no action", SupervisorRecoveryRequestIsAbsentForNoAction),
    ("Supervisor recovery request preserves originating snapshot", SupervisorRecoveryRequestPreservesOriginatingSnapshot),
    ("Supervisor recovery request preserves request recovery action", SupervisorRecoveryRequestPreservesRequestRecoveryAction),
    ("Supervisor recovery request creation is deterministic", SupervisorRecoveryRequestCreationIsDeterministic),
    ("Supervisor recovery request rejects running unhealthy snapshot", SupervisorRecoveryRequestRejectsRunningUnhealthySnapshot),
    ("Supervisor recovery request rejects observation state disagreement", SupervisorRecoveryRequestRejectsObservationStateDisagreement),
    ("Supervisor recovery request preserves fail-closed observation semantics", SupervisorRecoveryRequestPreservesFailClosedObservationSemantics),
    ("Supervisor recovery authorization reports not requested when recovery request is absent", SupervisorRecoveryAuthorizationReportsNotRequestedWhenRecoveryRequestIsAbsent),
    ("Supervisor recovery authorization denies valid recovery request", SupervisorRecoveryAuthorizationDeniesValidRecoveryRequest),
    ("Supervisor recovery authorization is deterministic", SupervisorRecoveryAuthorizationIsDeterministic),
    ("Supervisor recovery authorization rejects request carrying continue monitoring action", SupervisorRecoveryAuthorizationRejectsRequestCarryingContinueMonitoringAction),
    ("Supervisor recovery authorization rejects request carrying no action", SupervisorRecoveryAuthorizationRejectsRequestCarryingNoAction),
    ("Supervisor recovery authorization rejects snapshot that would not naturally request recovery", SupervisorRecoveryAuthorizationRejectsSnapshotThatWouldNotNaturallyRequestRecovery),
    ("Supervisor recovery authorization rejects observation state disagreement", SupervisorRecoveryAuthorizationRejectsObservationStateDisagreement),
    ("Supervisor recovery authorization rejects process state health disagreement", SupervisorRecoveryAuthorizationRejectsProcessStateHealthDisagreement),
    ("Supervisor recovery authorization preserves fail-closed malformed observation semantics", SupervisorRecoveryAuthorizationPreservesFailClosedMalformedObservationSemantics),
};

var failures = 0;
foreach (var test in tests)
{
    try
    {
        test.Body();
        Console.WriteLine($"PASS {test.Name}");
    }
    catch (Exception exception)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {test.Name}: {exception.Message}");
    }
}

Console.WriteLine($"TOTAL={tests.Length} PASSED={tests.Length - failures} FAILED={failures}");
return failures == 0 ? 0 : 1;

static void SupervisorObservationReportsRunningProcess()
{
    using var process =
        CreateRunningObservationFixture();

    var observation =
        SupervisorFoundation.ObserveIsolatedProcess(
            process);

    Assert.True(observation.Running);
    Assert.False(observation.ExitCode.HasValue);
}

static void SupervisorObservationReportsExitedProcess()
{
    using var process =
        CreateCompletedObservationFixture();

    Assert.True(
        process.WaitForExit(
            TimeSpan.FromSeconds(5)));

    var observation =
        SupervisorFoundation.ObserveIsolatedProcess(
            process);

    Assert.False(observation.Running);
    Assert.True(observation.ExitCode.HasValue);
}

static void SupervisorObservationPreservesObservedExitCode()
{
    using var process =
        CreateCompletedObservationFixture();

    Assert.True(
        process.WaitForExit(
            TimeSpan.FromSeconds(5)));

    var observation =
        SupervisorFoundation.ObserveIsolatedProcess(
            process);

    Assert.True(observation.ExitCode.HasValue);
    Assert.Equal(
        (uint)37,
        observation.ExitCode.GetValueOrDefault());
    Assert.Equal(
        process.GetExitCode(),
        observation.ExitCode.GetValueOrDefault());
}

static void SupervisorObservationRejectsDisposedProcess()
{
    var process =
        CreateCompletedObservationFixture();

    process.Dispose();

    Assert.Throws<ObjectDisposedException>(
        () =>
            SupervisorFoundation.ObserveIsolatedProcess(
                process));
}

static void SupervisorStateClassifiesRunningProcess()
{
    var state =
        SupervisorFoundation.ClassifyProcessState(
            new IsolatedProcessObservation(
                Running: true,
                ExitCode: null));

    Assert.Equal(
        SupervisorProcessState.Running,
        state);
}

static void SupervisorStateClassifiesSuccessfulExit()
{
    var state =
        SupervisorFoundation.ClassifyProcessState(
            new IsolatedProcessObservation(
                Running: false,
                ExitCode: 0));

    Assert.Equal(
        SupervisorProcessState.ExitedSuccessfully,
        state);
}

static void SupervisorStateClassifiesFailedExit()
{
    var state =
        SupervisorFoundation.ClassifyProcessState(
            new IsolatedProcessObservation(
                Running: false,
                ExitCode: 37));

    Assert.Equal(
        SupervisorProcessState.ExitedWithFailure,
        state);
}

static void SupervisorStateRejectsRunningObservationWithExitCode()
{
    Assert.Throws<ArgumentException>(
        () =>
            SupervisorFoundation.ClassifyProcessState(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: 37)));
}

static void SupervisorStateRejectsExitedObservationWithoutExitCode()
{
    Assert.Throws<ArgumentException>(
        () =>
            SupervisorFoundation.ClassifyProcessState(
                new IsolatedProcessObservation(
                    Running: false,
                    ExitCode: null)));
}

static void SupervisorSnapshotRepresentsRunningProcess()
{
    var observation = new IsolatedProcessObservation(
        Running: true,
        ExitCode: null);

    var snapshot = SupervisorFoundation.CreateSnapshot(observation);

    Assert.Equal(
        new SupervisorSnapshot(
            observation,
            SupervisorProcessState.Running,
            SupervisorHealth.Healthy),
        snapshot);
}

static void SupervisorSnapshotReportsRunningProcessHealthy()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: true,
            ExitCode: null));

    Assert.Equal(SupervisorHealth.Healthy, snapshot.Health);
}

static void SupervisorSnapshotRepresentsSuccessfulExit()
{
    var observation = new IsolatedProcessObservation(
        Running: false,
        ExitCode: 0);

    var snapshot = SupervisorFoundation.CreateSnapshot(observation);

    Assert.Equal(
        new SupervisorSnapshot(
            observation,
            SupervisorProcessState.ExitedSuccessfully,
            SupervisorHealth.Unhealthy),
        snapshot);
}

static void SupervisorSnapshotReportsSuccessfulExitUnhealthy()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 0));

    Assert.Equal(SupervisorHealth.Unhealthy, snapshot.Health);
}

static void SupervisorSnapshotRepresentsFailedExit()
{
    var observation = new IsolatedProcessObservation(
        Running: false,
        ExitCode: 37);

    var snapshot = SupervisorFoundation.CreateSnapshot(observation);

    Assert.Equal(
        new SupervisorSnapshot(
            observation,
            SupervisorProcessState.ExitedWithFailure,
            SupervisorHealth.Unhealthy),
        snapshot);
}

static void SupervisorSnapshotReportsFailedExitUnhealthy()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    Assert.Equal(SupervisorHealth.Unhealthy, snapshot.Health);
}

static void SupervisorSnapshotPreservesProcessObservation()
{
    var observation = new IsolatedProcessObservation(
        Running: false,
        ExitCode: 37);

    var snapshot = SupervisorFoundation.CreateSnapshot(observation);

    Assert.Equal(observation, snapshot.Observation);
}

static void SupervisorSnapshotPreservesSemanticProcessState()
{
    var observation = new IsolatedProcessObservation(
        Running: false,
        ExitCode: 37);
    var expectedState =
        SupervisorFoundation.ClassifyProcessState(observation);

    var snapshot = SupervisorFoundation.CreateSnapshot(observation);

    Assert.Equal(expectedState, snapshot.ProcessState);
}

static void SupervisorSnapshotRejectsRunningObservationWithExitCode()
{
    Assert.Throws<ArgumentException>(
        () =>
            SupervisorFoundation.CreateSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: 37)));
}

static void SupervisorSnapshotRejectsExitedObservationWithoutExitCode()
{
    Assert.Throws<ArgumentException>(
        () =>
            SupervisorFoundation.CreateSnapshot(
                new IsolatedProcessObservation(
                    Running: false,
                    ExitCode: null)));
}

static void SupervisorSnapshotCreationIsDeterministic()
{
    var observation = new IsolatedProcessObservation(
        Running: false,
        ExitCode: 37);

    var first = SupervisorFoundation.CreateSnapshot(observation);
    var second = SupervisorFoundation.CreateSnapshot(observation);

    Assert.Equal(first, second);
}

static void SupervisorDecisionContinuesMonitoringRunningHealthySnapshot()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: true,
            ExitCode: null));

    Assert.Equal(
        SupervisorDecision.ContinueMonitoring,
        SupervisorFoundation.EvaluateDecision(snapshot));
}

static void SupervisorDecisionRemainsStoppedAfterSuccessfulExit()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 0));

    Assert.Equal(
        SupervisorDecision.RemainStopped,
        SupervisorFoundation.EvaluateDecision(snapshot));
}

static void SupervisorDecisionRequiresRecoveryAfterFailedExit()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    Assert.Equal(
        SupervisorDecision.RecoveryRequired,
        SupervisorFoundation.EvaluateDecision(snapshot));
}

static void SupervisorDecisionEvaluationIsDeterministic()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    var first = SupervisorFoundation.EvaluateDecision(snapshot);
    var second = SupervisorFoundation.EvaluateDecision(snapshot);

    Assert.Equal(first, second);
}

static void SupervisorDecisionRejectsRunningUnhealthySnapshot()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateDecision(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: null),
                SupervisorProcessState.Running,
                SupervisorHealth.Unhealthy)));
}

static void SupervisorDecisionRejectsSuccessfulExitHealthySnapshot()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateDecision(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: false,
                    ExitCode: 0),
                SupervisorProcessState.ExitedSuccessfully,
                SupervisorHealth.Healthy)));
}

static void SupervisorDecisionRejectsFailedExitHealthySnapshot()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateDecision(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: false,
                    ExitCode: 37),
                SupervisorProcessState.ExitedWithFailure,
                SupervisorHealth.Healthy)));
}

static void SupervisorDecisionRejectsObservationStateDisagreement()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateDecision(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: null),
                SupervisorProcessState.ExitedSuccessfully,
                SupervisorHealth.Unhealthy)));
}

static void SupervisorDecisionPreservesFailClosedObservationSemantics()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateDecision(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: 37),
                SupervisorProcessState.Running,
                SupervisorHealth.Healthy)));
}

static void SupervisorActionContinuesMonitoringForContinueDecision()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: true,
            ExitCode: null));

    Assert.Equal(
        SupervisorDecision.ContinueMonitoring,
        SupervisorFoundation.EvaluateDecision(snapshot));
    Assert.Equal(
        SupervisorAction.ContinueMonitoring,
        SupervisorFoundation.PlanAction(snapshot));
}

static void SupervisorActionPerformsNoActionForRemainStoppedDecision()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 0));

    Assert.Equal(
        SupervisorDecision.RemainStopped,
        SupervisorFoundation.EvaluateDecision(snapshot));
    Assert.Equal(
        SupervisorAction.NoAction,
        SupervisorFoundation.PlanAction(snapshot));
}

static void SupervisorActionRequestsRecoveryForRecoveryRequiredDecision()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    Assert.Equal(
        SupervisorDecision.RecoveryRequired,
        SupervisorFoundation.EvaluateDecision(snapshot));
    Assert.Equal(
        SupervisorAction.RequestRecovery,
        SupervisorFoundation.PlanAction(snapshot));
}

static void SupervisorActionPlanningIsDeterministic()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    var first = SupervisorFoundation.PlanAction(snapshot);
    var second = SupervisorFoundation.PlanAction(snapshot);

    Assert.Equal(first, second);
}

static void SupervisorActionRejectsRunningUnhealthySnapshot()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.PlanAction(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: null),
                SupervisorProcessState.Running,
                SupervisorHealth.Unhealthy)));
}

static void SupervisorActionRejectsSuccessfulExitHealthySnapshot()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.PlanAction(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: false,
                    ExitCode: 0),
                SupervisorProcessState.ExitedSuccessfully,
                SupervisorHealth.Healthy)));
}

static void SupervisorActionRejectsFailedExitHealthySnapshot()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.PlanAction(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: false,
                    ExitCode: 37),
                SupervisorProcessState.ExitedWithFailure,
                SupervisorHealth.Healthy)));
}

static void SupervisorActionRejectsObservationStateDisagreement()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.PlanAction(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: null),
                SupervisorProcessState.ExitedSuccessfully,
                SupervisorHealth.Unhealthy)));
}

static void SupervisorActionPreservesFailClosedObservationSemantics()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.PlanAction(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: 37),
                SupervisorProcessState.Running,
                SupervisorHealth.Healthy)));
}

static void SupervisorRecoveryRequestIsCreatedForRequestRecoveryAction()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    var request = SupervisorFoundation.CreateRecoveryRequest(snapshot);

    Assert.True(request.HasValue);
}

static void SupervisorRecoveryRequestIsAbsentForContinueMonitoringAction()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: true,
            ExitCode: null));

    var request = SupervisorFoundation.CreateRecoveryRequest(snapshot);

    Assert.False(request.HasValue);
}

static void SupervisorRecoveryRequestIsAbsentForNoAction()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 0));

    var request = SupervisorFoundation.CreateRecoveryRequest(snapshot);

    Assert.False(request.HasValue);
}

static void SupervisorRecoveryRequestPreservesOriginatingSnapshot()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    var request = SupervisorFoundation.CreateRecoveryRequest(snapshot);

    Assert.True(request.HasValue);
    Assert.Equal(snapshot, request.GetValueOrDefault().Snapshot);
}

static void SupervisorRecoveryRequestPreservesRequestRecoveryAction()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    var request = SupervisorFoundation.CreateRecoveryRequest(snapshot);

    Assert.True(request.HasValue);
    Assert.Equal(
        SupervisorAction.RequestRecovery,
        request.GetValueOrDefault().Action);
}

static void SupervisorRecoveryRequestCreationIsDeterministic()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    var first = SupervisorFoundation.CreateRecoveryRequest(snapshot);
    var second = SupervisorFoundation.CreateRecoveryRequest(snapshot);

    Assert.True(first.HasValue);
    Assert.True(second.HasValue);
    Assert.Equal(
        first.GetValueOrDefault(),
        second.GetValueOrDefault());
}

static void SupervisorRecoveryRequestRejectsRunningUnhealthySnapshot()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.CreateRecoveryRequest(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: null),
                SupervisorProcessState.Running,
                SupervisorHealth.Unhealthy)));
}

static void SupervisorRecoveryRequestRejectsObservationStateDisagreement()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.CreateRecoveryRequest(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: null),
                SupervisorProcessState.ExitedSuccessfully,
                SupervisorHealth.Unhealthy)));
}

static void SupervisorRecoveryRequestPreservesFailClosedObservationSemantics()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.CreateRecoveryRequest(
            new SupervisorSnapshot(
                new IsolatedProcessObservation(
                    Running: true,
                    ExitCode: 37),
                SupervisorProcessState.Running,
                SupervisorHealth.Healthy)));
}

static void SupervisorRecoveryAuthorizationReportsNotRequestedWhenRecoveryRequestIsAbsent()
{
    Assert.Equal(
        SupervisorRecoveryAuthorization.NotRequested,
        SupervisorFoundation.EvaluateRecoveryAuthorization(null));
}

static void SupervisorRecoveryAuthorizationDeniesValidRecoveryRequest()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));
    var request = SupervisorFoundation.CreateRecoveryRequest(snapshot);

    Assert.True(request.HasValue);
    Assert.Equal(
        SupervisorRecoveryAuthorization.Denied,
        SupervisorFoundation.EvaluateRecoveryAuthorization(request));
}

static void SupervisorRecoveryAuthorizationIsDeterministic()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));
    var request = SupervisorFoundation.CreateRecoveryRequest(snapshot);

    var first = SupervisorFoundation.EvaluateRecoveryAuthorization(request);
    var second = SupervisorFoundation.EvaluateRecoveryAuthorization(request);

    Assert.Equal(first, second);
}

static void SupervisorRecoveryAuthorizationRejectsRequestCarryingContinueMonitoringAction()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateRecoveryAuthorization(
            new SupervisorRecoveryRequest(
                snapshot,
                SupervisorAction.ContinueMonitoring)));
}

static void SupervisorRecoveryAuthorizationRejectsRequestCarryingNoAction()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 37));

    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateRecoveryAuthorization(
            new SupervisorRecoveryRequest(
                snapshot,
                SupervisorAction.NoAction)));
}

static void SupervisorRecoveryAuthorizationRejectsSnapshotThatWouldNotNaturallyRequestRecovery()
{
    var snapshot = SupervisorFoundation.CreateSnapshot(
        new IsolatedProcessObservation(
            Running: false,
            ExitCode: 0));

    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateRecoveryAuthorization(
            new SupervisorRecoveryRequest(
                snapshot,
                SupervisorAction.RequestRecovery)));
}

static void SupervisorRecoveryAuthorizationRejectsObservationStateDisagreement()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateRecoveryAuthorization(
            new SupervisorRecoveryRequest(
                new SupervisorSnapshot(
                    new IsolatedProcessObservation(
                        Running: true,
                        ExitCode: null),
                    SupervisorProcessState.ExitedSuccessfully,
                    SupervisorHealth.Unhealthy),
                SupervisorAction.RequestRecovery)));
}

static void SupervisorRecoveryAuthorizationRejectsProcessStateHealthDisagreement()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateRecoveryAuthorization(
            new SupervisorRecoveryRequest(
                new SupervisorSnapshot(
                    new IsolatedProcessObservation(
                        Running: false,
                        ExitCode: 37),
                    SupervisorProcessState.ExitedWithFailure,
                    SupervisorHealth.Healthy),
                SupervisorAction.RequestRecovery)));
}

static void SupervisorRecoveryAuthorizationPreservesFailClosedMalformedObservationSemantics()
{
    Assert.Throws<ArgumentException>(
        () => SupervisorFoundation.EvaluateRecoveryAuthorization(
            new SupervisorRecoveryRequest(
                new SupervisorSnapshot(
                    new IsolatedProcessObservation(
                        Running: true,
                        ExitCode: 37),
                    SupervisorProcessState.Running,
                    SupervisorHealth.Healthy),
                SupervisorAction.RequestRecovery)));
}

static void ProjectFilesTargetWindowsX64NativeAot()
{
    var sourceRoot = FindSupervisorRoot();
    using var sdk = JsonDocument.Parse(File.ReadAllText(Path.Combine(sourceRoot, "global.json")));
    var props = XDocument.Load(Path.Combine(sourceRoot, "Directory.Build.props"));
    var project = XDocument.Load(Path.Combine(sourceRoot, "src", "Genesis.GLW.RuntimeSupervisor", "Genesis.GLW.RuntimeSupervisor.csproj"));
    var testProject = XDocument.Load(Path.Combine(sourceRoot, "tests", "Genesis.GLW.RuntimeSupervisor.Tests", "Genesis.GLW.RuntimeSupervisor.Tests.csproj"));

    var sdkElement = sdk.RootElement.GetProperty("sdk");
    Assert.Equal("10.0.100", sdkElement.GetProperty("version").GetString()!);
    Assert.Equal("disable", sdkElement.GetProperty("rollForward").GetString()!);
    Assert.False(sdkElement.GetProperty("allowPrerelease").GetBoolean());
    Assert.Equal("net10.0-windows", PropertyValue(props, "TargetFramework"));
    Assert.Equal("win-x64", PropertyValue(props, "RuntimeIdentifier"));
    Assert.Equal("x64", PropertyValue(props, "PlatformTarget"));
    Assert.Equal("true", PropertyValue(project, "SelfContained"));
    Assert.Equal("true", PropertyValue(project, "PublishAot"));
    Assert.Equal("true", PropertyValue(project, "PublishSingleFile"));
    Assert.Equal("enable", PropertyValue(props, "Nullable"));
    Assert.Equal("true", PropertyValue(props, "TreatWarningsAsErrors"));
    Assert.Equal("true", PropertyValue(props, "AllowUnsafeBlocks"));
    Assert.Equal("true", PropertyValue(props, "Deterministic"));
    Assert.Equal("true", PropertyValue(props, "ContinuousIntegrationBuild"));

    var forbiddenOverrides = new[] { "TargetFramework", "RuntimeIdentifier", "PlatformTarget" };
    foreach (var propertyName in forbiddenOverrides)
    {
        Assert.False(project.Descendants(propertyName).Any());
        Assert.False(testProject.Descendants(propertyName).Any());
    }
}

static void PlatformGuardAcceptsWindowsX64() => PlatformGuard.EnsureSupported(true, Architecture.X64);

static void PlatformGuardRejectsUnsupportedTargets()
{
    Assert.Throws<PlatformNotSupportedException>(() => PlatformGuard.EnsureSupported(false, Architecture.X64));
    Assert.Throws<PlatformNotSupportedException>(() => PlatformGuard.EnsureSupported(true, Architecture.Arm64));
}

static void SafeHandleOwnsAndReleasesFixture()
{
    var rawHandle = CreateIsolatedEvent();
    var handle = new TestSafeKernelObjectHandle(rawHandle);
    Assert.False(handle.IsInvalid);
    handle.Dispose();
    var waitResult = TestNativeMethods.WaitForSingleObject(rawHandle, 0);
    var errorCode = Marshal.GetLastWin32Error();
    Assert.Equal(uint.MaxValue, waitResult);
    Assert.Equal(6, errorCode);
}

static void SafeHandleDisposalIsIdempotent()
{
    var rawHandle = CreateIsolatedEvent();
    var handle = new TestSafeKernelObjectHandle(rawHandle);
    Assert.False(handle.IsInvalid);
    handle.Dispose();
    handle.Dispose();
    Assert.True(handle.IsClosed);
    var waitResult = TestNativeMethods.WaitForSingleObject(rawHandle, 0);
    var errorCode = Marshal.GetLastWin32Error();
    Assert.Equal(uint.MaxValue, waitResult);
    Assert.Equal(6, errorCode);
}

static void InvalidSafeHandlesRemainInvalid()
{
    using var job = new SafeJobHandle();
    using var process = new Genesis.GLW.RuntimeSupervisor.Interop.SafeProcessHandle();
    using var thread = new SafeThreadHandle();
    using var token = new SafeTokenHandle();
    using var completionPort = new SafeIoCompletionPortHandle();
    using var mutex = new SafeMutexHandle();
    using var pipe = new Genesis.GLW.RuntimeSupervisor.Interop.SafePipeHandle();
    using var localAlloc = new SafeLocalAllocHandle();
    using var attributeList = new SafeProcThreadAttributeList();
    using var certificate = new SafeCertContextHandle();

    Assert.True(new SafeHandle[] { job, process, thread, token, completionPort, mutex, pipe, localAlloc, attributeList, certificate }.All(handle => handle.IsInvalid));
}

static void ReleaseHandleIsNonThrowing()
{
    using var handle = CreateIsolatedEventHandle();
    handle.Dispose();
    handle.Dispose();
}

static void HandleInheritanceDefaultsOff() => Assert.False(BuildContract.InheritHandles);

static void NativeErrorCaptureIsImmediate()
{
    const int expected = 1234;
    TestNativeMethods.SetLastError((uint)expected);
    var error = Win32Error.CaptureImmediate("SUP_M1_TEST");
    Assert.Equal(expected, error.Code);
    Assert.Equal("SUP_M1_TEST", error.ApiName);
}

static void SafeFileHandleUsesFrameworkImplementation()
{
    Assert.Equal(typeof(SafeFileHandle), FrameworkSafeHandlePolicy.FileHandleType);
}

static void LeaseBasicAcquireAndRelease()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var lease = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    handle.Dispose();
    Assert.Equal(0, handle.ReleaseCount);
    lease.Dispose();
    Assert.Equal(1, handle.ReleaseCount);
}

static void LeaseRepeatedDisposeReleasesOnce()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var lease = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    handle.Dispose();
    lease.Dispose();
    lease.Dispose();
    Assert.Equal(1, handle.ReleaseCount);
}

static void LeaseAliasesShareOneReleaseObligation()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var first = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    var second = first;
    handle.Dispose();
    first.Dispose();
    second.Dispose();
    Assert.Equal(1, handle.ReleaseCount);
}

static void LeaseConcurrentDisposeReleasesOnce()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var lease = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    handle.Dispose();
    Parallel.For(0, 32, _ => lease.Dispose());
    Assert.Equal(1, handle.ReleaseCount);
}

static void LeaseExposesNoRawHandleAuthority()
{
    var leaseType = typeof(SafeHandleLease<SafeJobHandle>);
    var members = leaseType.GetMembers(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);

    Assert.False(members.OfType<FieldInfo>().Any(field => ContainsRawHandleType(field.FieldType)));
    Assert.False(members.OfType<PropertyInfo>().Any(property => ContainsRawHandleType(property.PropertyType)));
    Assert.False(members.OfType<MethodInfo>().Any(method =>
        ContainsRawHandleType(method.ReturnType) ||
        method.GetParameters().Any(parameter => ContainsRawHandleType(parameter.ParameterType))));
    Assert.False(members.OfType<ConstructorInfo>().Any(constructor =>
        constructor.GetParameters().Any(parameter => ContainsRawHandleType(parameter.ParameterType))));
}

static void LeaseRejectsInvalidAndClosedHandles()
{
    using var invalid = new CountingSafeKernelObjectHandle(0);
    Assert.Throws<ObjectDisposedException>(() => SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(invalid));

    var closed = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    closed.Dispose();
    Assert.Throws<ObjectDisposedException>(() => SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(closed));
}

static void LeaseRetainsUnderlyingSafeHandle()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var lease = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    handle.Dispose();
    Assert.Equal(0, handle.ReleaseCount);
    lease.Dispose();
    Assert.Equal(1, handle.ReleaseCount);
}

static void FailedLeaseAcquisitionRequiresNoRelease()
{
    using var invalid = new CountingSafeKernelObjectHandle(0);
    Assert.Throws<ObjectDisposedException>(() => SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(invalid));
    Assert.Equal(0, invalid.ReleaseCount);
}

static void LeaseHasNoFinalizer()
{
    var finalizer = typeof(SafeHandleLease<SafeJobHandle>).GetMethod(
        "Finalize",
        BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
    Assert.True(finalizer is null);
}

static void LocalAllocWrapperFreesIsolatedMemory()
{
    var memory = TestNativeMethods.LocalAlloc(0, 128);
    if (memory == 0)
    {
        throw new InvalidOperationException("LocalAlloc failed.");
    }

    var ownedMemory = new SafeLocalAllocHandle(memory);

    Assert.False(ownedMemory.IsInvalid);
    Assert.True(TestNativeMethods.LocalSize(ownedMemory.DangerousGetHandle()) >= 128);

    ownedMemory.Dispose();

    Assert.True(ownedMemory.IsClosed);
}
static void InitializedAttributeListReachesDisposedState()
{
    nuint bytes = 0;
    _ = TestNativeMethods.InitializeProcThreadAttributeList(0, 1, 0, ref bytes);
    var allocation = Marshal.AllocHGlobal(checked((nint)bytes));
    var attributeList = new SafeProcThreadAttributeList(allocation);

    if (!TestNativeMethods.InitializeProcThreadAttributeList(allocation, 1, 0, ref bytes))
    {
        var errorCode = Marshal.GetLastWin32Error();
        attributeList.Dispose();
        throw new InvalidOperationException($"InitializeProcThreadAttributeList failed with error {errorCode}.");
    }

    attributeList.MarkInitialized();
    attributeList.Dispose();
    Assert.True(attributeList.IsClosed);
}

static void CertificateContextReachesDisposedState()
{
    using var key = RSA.Create(2048);
    var request = new CertificateRequest("CN=SUP-M1 Fixture", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddMinutes(5));
    var duplicate = TestNativeMethods.CertDuplicateCertificateContext(certificate.Handle);
    if (duplicate == 0)
    {
        throw new InvalidOperationException("CertDuplicateCertificateContext failed.");
    }

    var context = new SafeCertContextHandle(duplicate);
    Assert.False(context.IsInvalid);
    context.Dispose();
    Assert.True(context.IsClosed);
}

static void ApprovedIsolatedRuntimeObservationSurface()
{
    var sourceRoot = FindSupervisorRoot();

    var nativeMethodsPath = Path.Combine(
        sourceRoot,
        "src",
        "Genesis.GLW.RuntimeSupervisor",
        "Interop",
        "NativeMethods.cs");

    var factoryPath = Path.Combine(
        sourceRoot,
        "src",
        "Genesis.GLW.RuntimeSupervisor",
        "Foundation",
        "IsolatedTestProcessFactory.cs");

    var productionText = File.ReadAllText(nativeMethodsPath);
    var factoryText = File.ReadAllText(factoryPath);

    Assert.Equal(
        7,
        productionText.Split(
            "[LibraryImport(",
            StringSplitOptions.None).Length - 1);

    Assert.True(
        productionText.Contains(
            "CreateProcessW",
            StringComparison.Ordinal));

    Assert.True(
        productionText.Contains(
            "WaitForSingleObject",
            StringComparison.Ordinal));

    Assert.True(
        productionText.Contains(
            "GetExitCodeProcess",
            StringComparison.Ordinal));

    Assert.True(
        factoryText.Contains(
            "public bool IsRunning",
            StringComparison.Ordinal));

    Assert.True(
        factoryText.Contains(
            "public bool WaitForExit",
            StringComparison.Ordinal));

    Assert.True(
        factoryText.Contains(
            "public uint GetExitCode",
            StringComparison.Ordinal));

    Assert.False(
        productionText.Contains(
            "OpenProcess",
            StringComparison.Ordinal));

    Assert.True(
        productionText.Contains(
            "partial bool TerminateProcess(",
            StringComparison.Ordinal));

    Assert.True(
        productionText.Contains(
            "SafeProcessHandle process",
            StringComparison.Ordinal));

    Assert.True(
        factoryText.Contains(
            "public void Terminate(uint exitCode)",
            StringComparison.Ordinal));

    Assert.True(
        factoryText.Contains(
            "NativeMethods.TerminateProcess(",
            StringComparison.Ordinal));

    Assert.True(
        factoryText.Contains(
            "Process,",
            StringComparison.Ordinal));

    Assert.True(
        factoryText.Contains(
            "exitCode",
            StringComparison.Ordinal));

    Assert.False(
        factoryText.Contains(
            "Process.GetProcessById",
            StringComparison.Ordinal));

    Assert.False(
        factoryText.Contains(
            "Process.GetProcesses",
            StringComparison.Ordinal));

    Assert.False(
        factoryText.Contains(
            "Process.Start",
            StringComparison.Ordinal));
}

static void IsolatedProcessReportsRunningState()
{
    using var process = CreateRunningObservationFixture();

    Assert.True(process.IsRunning);
}

static void IsolatedProcessZeroTimeoutReportsRunning()
{
    using var process = CreateRunningObservationFixture();

    Assert.False(process.WaitForExit(TimeSpan.Zero));
    Assert.True(process.IsRunning);
}

static void IsolatedProcessBoundedWaitObservesExit()
{
    using var process = CreateCompletedObservationFixture();

    Assert.True(
        process.WaitForExit(TimeSpan.FromSeconds(5)));

    Assert.False(process.IsRunning);
}

static void IsolatedProcessExposesExitCodeAfterExit()
{
    using var process = CreateCompletedObservationFixture();

    Assert.True(
        process.WaitForExit(TimeSpan.FromSeconds(5)));

    Assert.Equal((uint)37, process.GetExitCode());
}

static void IsolatedProcessRejectsExitCodeWhileRunning()
{
    using var process = CreateRunningObservationFixture();

    Assert.Throws<InvalidOperationException>(
        () => process.GetExitCode());
}

static void IsolatedProcessRejectsInvalidTimeout()
{
    using var process = CreateRunningObservationFixture();

    Assert.Throws<ArgumentOutOfRangeException>(
        () => process.WaitForExit(
            TimeSpan.FromMilliseconds(-2)));
}

static void DisposedIsolatedProcessRejectsObservation()
{
    var process = CreateCompletedObservationFixture();

    process.Dispose();

    Assert.Throws<ObjectDisposedException>(
        () => _ = process.IsRunning);

    Assert.Throws<ObjectDisposedException>(
        () => process.WaitForExit(TimeSpan.Zero));

    Assert.Throws<ObjectDisposedException>(
        () => process.GetExitCode());
}

static void OwnedIsolatedProcessCanBeTerminated()
{
    using var process = CreateRunningObservationFixture();

    Assert.True(process.IsRunning);

    process.Terminate(71);

    Assert.True(
        process.WaitForExit(TimeSpan.FromSeconds(5)));

    Assert.False(process.IsRunning);
}

static void OwnedTerminationPreservesRequestedExitCode()
{
    using var process = CreateRunningObservationFixture();

    process.Terminate(73);

    Assert.True(
        process.WaitForExit(TimeSpan.FromSeconds(5)));

    Assert.Equal((uint)73, process.GetExitCode());
}

static void OwnedTerminationRejectsAlreadyExitedProcess()
{
    using var process = CreateCompletedObservationFixture();

    Assert.True(
        process.WaitForExit(TimeSpan.FromSeconds(5)));

    Assert.Throws<InvalidOperationException>(
        () => process.Terminate(75));
}

static void DisposedIsolatedProcessRejectsTermination()
{
    var process = CreateCompletedObservationFixture();

    process.Dispose();

    Assert.Throws<ObjectDisposedException>(
        () => process.Terminate(77));
}
static void OwnedTerminateAndWaitObservesExit()
{
    using var process =
        CreateRunningObservationFixture();

    var exited = process.TerminateAndWait(
        81,
        TimeSpan.FromSeconds(5));

    Assert.True(exited);
    Assert.False(process.IsRunning);
}

static void OwnedTerminateAndWaitPreservesRequestedExitCode()
{
    using var process =
        CreateRunningObservationFixture();

    var exited = process.TerminateAndWait(
        82,
        TimeSpan.FromSeconds(5));

    Assert.True(exited);
    Assert.Equal(
        (uint)82,
        process.GetExitCode());
}

static void OwnedTerminateAndWaitRejectsAlreadyExitedProcess()
{
    using var process =
        CreateCompletedObservationFixture();

    Assert.True(
        process.WaitForExit(TimeSpan.FromSeconds(5)));

    Assert.Throws<InvalidOperationException>(
        () => process.TerminateAndWait(
            83,
            TimeSpan.FromSeconds(1)));
}

static void OwnedTerminateAndWaitRejectsInvalidTimeout()
{
    using var process =
        CreateRunningObservationFixture();

    Assert.Throws<ArgumentOutOfRangeException>(
        () => process.TerminateAndWait(
            84,
            TimeSpan.FromMilliseconds(-2)));
}

static void DisposedIsolatedProcessRejectsTerminateAndWait()
{
    var process =
        CreateCompletedObservationFixture();

    process.Dispose();

    Assert.Throws<ObjectDisposedException>(
        () => process.TerminateAndWait(
            85,
            TimeSpan.FromSeconds(1)));
}

static void OwnedResultCoordinationObservesExit()
{
    using var process =
        CreateRunningObservationFixture();

    var result =
        process.TerminateAndWaitForResult(
            91,
            TimeSpan.FromSeconds(5));

    Assert.True(result.Exited);
    Assert.False(process.IsRunning);
}

static void OwnedResultCoordinationReportsObservedExitCode()
{
    using var process =
        CreateRunningObservationFixture();

    var result =
        process.TerminateAndWaitForResult(
            92,
            TimeSpan.FromSeconds(5));

    Assert.True(result.Exited);
    Assert.True(result.ExitCode.HasValue);
    Assert.Equal(
        (uint)92,
        result.ExitCode.GetValueOrDefault());
    Assert.Equal(
        process.GetExitCode(),
        result.ExitCode.GetValueOrDefault());
}

static void OwnedResultCoordinationReportsTimeoutWithoutExitCode()
{
    using var process =
        CreateRunningObservationFixture();

    var result =
        process.TerminateAndWaitForResult(
            93,
            TimeSpan.Zero);

    if (result.Exited)
    {
        Assert.True(result.ExitCode.HasValue);
        Assert.Equal(
            process.GetExitCode(),
            result.ExitCode.GetValueOrDefault());
        return;
    }

    Assert.False(result.ExitCode.HasValue);

    Assert.True(
        process.WaitForExit(
            TimeSpan.FromSeconds(5)));
}

static void OwnedResultCoordinationRejectsAlreadyExitedProcess()
{
    using var process =
        CreateCompletedObservationFixture();

    Assert.True(
        process.WaitForExit(
            TimeSpan.FromSeconds(5)));

    Assert.Throws<InvalidOperationException>(
        () => process.TerminateAndWaitForResult(
            94,
            TimeSpan.FromSeconds(1)));
}

static void OwnedResultCoordinationRejectsInvalidTimeout()
{
    using var process =
        CreateRunningObservationFixture();

    Assert.Throws<ArgumentOutOfRangeException>(
        () => process.TerminateAndWaitForResult(
            95,
            TimeSpan.FromMilliseconds(-2)));
}

static void DisposedIsolatedProcessRejectsResultCoordination()
{
    var process =
        CreateCompletedObservationFixture();

    process.Dispose();

    Assert.Throws<ObjectDisposedException>(
        () => process.TerminateAndWaitForResult(
            96,
            TimeSpan.FromSeconds(1)));
}
static void OwnedWaitForResultObservesExit()
{
    using var process =
        CreateCompletedObservationFixture();

    var result =
        process.WaitForResult(
            TimeSpan.FromSeconds(5));

    Assert.True(result.Exited);
    Assert.False(process.IsRunning);
}

static void OwnedWaitForResultReportsObservedExitCode()
{
    using var process =
        CreateCompletedObservationFixture();

    var result =
        process.WaitForResult(
            TimeSpan.FromSeconds(5));

    Assert.True(result.Exited);
    Assert.True(result.ExitCode.HasValue);
    Assert.Equal(
        process.GetExitCode(),
        result.ExitCode.GetValueOrDefault());
}

static void OwnedWaitForResultReportsTimeoutWithoutExitCode()
{
    using var process =
        CreateRunningObservationFixture();

    var result =
        process.WaitForResult(
            TimeSpan.Zero);

    Assert.False(result.Exited);
    Assert.False(result.ExitCode.HasValue);
}

static void OwnedWaitForResultRejectsInvalidTimeout()
{
    using var process =
        CreateRunningObservationFixture();

    Assert.Throws<ArgumentOutOfRangeException>(
        () => process.WaitForResult(
            TimeSpan.FromMilliseconds(-2)));
}

static void DisposedIsolatedProcessRejectsWaitForResult()
{
    var process =
        CreateCompletedObservationFixture();

    process.Dispose();

    Assert.Throws<ObjectDisposedException>(
        () => process.WaitForResult(
            TimeSpan.FromSeconds(1)));
}
static IsolatedTestProcess CreateRunningObservationFixture()
{
    var executablePath =
        Path.Combine(
            AppContext.BaseDirectory,
            "Genesis.GLW.RuntimeSupervisor.Tests.exe");

    if (!File.Exists(executablePath))
    {
        throw new FileNotFoundException(
            "Current test executable was not found.",
            executablePath);
    }

    Environment.SetEnvironmentVariable(
        "GENESIS_SUP_M3_FIXTURE_MODE",
        "RUNNING");

    try
    {
        return IsolatedTestProcessFactory.Create(
            executablePath);
    }
    finally
    {
        Environment.SetEnvironmentVariable(
            "GENESIS_SUP_M3_FIXTURE_MODE",
            null);
    }
}

static IsolatedTestProcess CreateCompletedObservationFixture()
{
    var executablePath =
        Path.Combine(
            AppContext.BaseDirectory,
            "Genesis.GLW.RuntimeSupervisor.Tests.exe");

    if (!File.Exists(executablePath))
    {
        throw new FileNotFoundException(
            "Current test executable was not found.",
            executablePath);
    }

    Environment.SetEnvironmentVariable(
        "GENESIS_SUP_M3_FIXTURE_MODE",
        "COMPLETED");

    try
    {
        return IsolatedTestProcessFactory.Create(
            executablePath);
    }
    finally
    {
        Environment.SetEnvironmentVariable(
            "GENESIS_SUP_M3_FIXTURE_MODE",
            null);
    }
}

static nint CreateIsolatedEvent()
{
    var rawHandle = TestNativeMethods.CreateEventW(0, false, false, null);
    if (rawHandle == 0 || rawHandle == -1)
    {
        throw new InvalidOperationException($"CreateEventW failed with error {Marshal.GetLastWin32Error()}.");
    }

    return rawHandle;
}

static TestSafeKernelObjectHandle CreateIsolatedEventHandle()
{
    var rawHandle = CreateIsolatedEvent();

    try
    {
        return new TestSafeKernelObjectHandle(rawHandle);
    }
    catch
    {
        _ = TestNativeMethods.CloseHandle(rawHandle);
        throw;
    }
}

static string FindSupervisorRoot()
{
    var directory = new DirectoryInfo(AppContext.BaseDirectory);
    while (directory is not null)
    {
        if (File.Exists(Path.Combine(directory.FullName, "global.json")) &&
            File.Exists(Path.Combine(directory.FullName, "Directory.Build.props")))
        {
            return directory.FullName;
        }

        directory = directory.Parent;
    }

    throw new DirectoryNotFoundException("Supervisor source root was not found.");
}

static string PropertyValue(XDocument document, string name)
{
    return document.Descendants(name).Single().Value;
}

static bool ContainsRawHandleType(Type type)
{
    if (type == typeof(nint) || type == typeof(nuint) || type == typeof(IntPtr) || type == typeof(UIntPtr))
    {
        return true;
    }

    if (type.IsByRef || type.IsPointer || type.IsArray)
    {
        return ContainsRawHandleType(type.GetElementType()!);
    }

    return type.IsGenericType && type.GetGenericArguments().Any(ContainsRawHandleType);
}

internal static partial class TestNativeMethods
{
    [LibraryImport("kernel32.dll", EntryPoint = "CreateEventW", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    internal static partial nint CreateEventW(
        nint eventAttributes,
        [MarshalAs(UnmanagedType.Bool)] bool manualReset,
        [MarshalAs(UnmanagedType.Bool)] bool initialState,
        string? name);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    internal static partial uint WaitForSingleObject(nint handle, uint milliseconds);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    internal static partial void SetLastError(uint errorCode);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    internal static partial nint LocalAlloc(uint flags, nuint bytes);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    internal static partial nuint LocalSize(nint memory);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool InitializeProcThreadAttributeList(
        nint attributeList,
        uint attributeCount,
        uint flags,
        ref nuint size);

    [LibraryImport("crypt32.dll")]
    internal static partial nint CertDuplicateCertificateContext(nint certificateContext);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool CloseHandle(nint handle);
}

internal sealed class TestSafeKernelObjectHandle(nint ownedHandle) : SafeKernelObjectHandle(ownedHandle);

internal sealed class CountingSafeKernelObjectHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    private int releaseCount;

    internal CountingSafeKernelObjectHandle(nint ownedHandle)
        : base(ownsHandle: true)
    {
        SetHandle(ownedHandle);
    }

    internal int ReleaseCount => Volatile.Read(ref releaseCount);

    protected override bool ReleaseHandle()
    {
        Interlocked.Increment(ref releaseCount);
        return TestNativeMethods.CloseHandle(handle);
    }
}

internal static class Assert
{
    internal static void True(bool condition)
    {
        if (!condition)
        {
            throw new InvalidOperationException("Expected true.");
        }
    }

    internal static void False(bool condition) => True(!condition);

    internal static void Equal<T>(T expected, T actual) where T : notnull
    {
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
        {
            throw new InvalidOperationException($"Expected '{expected}', actual '{actual}'.");
        }
    }

    internal static void Throws<TException>(Action action) where TException : Exception
    {
        try
        {
            action();
        }
        catch (TException)
        {
            return;
        }

        throw new InvalidOperationException($"Expected {typeof(TException).Name}.");
    }
}


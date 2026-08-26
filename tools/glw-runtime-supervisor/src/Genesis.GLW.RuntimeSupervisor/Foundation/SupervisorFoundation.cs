namespace Genesis.GLW.RuntimeSupervisor.Foundation;

public readonly record struct IsolatedProcessObservation(
    bool Running,
    uint? ExitCode);

public enum SupervisorProcessState
{
    Running,
    ExitedSuccessfully,
    ExitedWithFailure
}

public enum SupervisorHealth
{
    Healthy,
    Unhealthy
}

public enum SupervisorDecision
{
    ContinueMonitoring,
    RemainStopped,
    RecoveryRequired
}

public enum SupervisorAction
{
    ContinueMonitoring,
    NoAction,
    RequestRecovery
}

public enum SupervisorRecoveryAuthorization
{
    NotRequested,
    Denied
}

public readonly record struct SupervisorSnapshot(
    IsolatedProcessObservation Observation,
    SupervisorProcessState ProcessState,
    SupervisorHealth Health);

public readonly record struct SupervisorRecoveryRequest(
    SupervisorSnapshot Snapshot,
    SupervisorAction Action);

internal static class SupervisorFoundation
{
    internal static int Run()
    {
        try
        {
            PlatformGuard.EnsureSupported();
            Console.WriteLine("Genesis GLW Runtime Supervisor SUP-M1 foundation. Runtime lifecycle is not implemented.");
            return 0;
        }
        catch (PlatformNotSupportedException exception)
        {
            Console.Error.WriteLine(exception.Message);
            return 2;
        }
    }

    internal static IsolatedProcessObservation ObserveIsolatedProcess(
        IsolatedTestProcess process)
    {
        ArgumentNullException.ThrowIfNull(process);

        if (process.IsRunning)
        {
            return new IsolatedProcessObservation(
                Running: true,
                ExitCode: null);
        }

        return new IsolatedProcessObservation(
            Running: false,
            ExitCode: process.GetExitCode());
    }

    internal static SupervisorProcessState ClassifyProcessState(
        IsolatedProcessObservation observation)
    {
        if (observation.Running)
        {
            if (observation.ExitCode.HasValue)
            {
                throw new ArgumentException(
                    "A running process observation cannot have an exit code.",
                    nameof(observation));
            }

            return SupervisorProcessState.Running;
        }

        if (!observation.ExitCode.HasValue)
        {
            throw new ArgumentException(
                "An exited process observation must have an exit code.",
                nameof(observation));
        }

        return observation.ExitCode.GetValueOrDefault() == 0
            ? SupervisorProcessState.ExitedSuccessfully
            : SupervisorProcessState.ExitedWithFailure;
    }

    internal static SupervisorSnapshot CreateSnapshot(
        IsolatedProcessObservation observation)
    {
        var processState = ClassifyProcessState(observation);
        var health = processState == SupervisorProcessState.Running
            ? SupervisorHealth.Healthy
            : SupervisorHealth.Unhealthy;

        return new SupervisorSnapshot(
            observation,
            processState,
            health);
    }

    internal static SupervisorDecision EvaluateDecision(
        SupervisorSnapshot snapshot)
    {
        var certifiedSnapshot = CreateSnapshot(snapshot.Observation);
        if (snapshot != certifiedSnapshot)
        {
            throw new ArgumentException(
                "The supervisor snapshot is inconsistent with its process observation.",
                nameof(snapshot));
        }

        return snapshot.ProcessState switch
        {
            SupervisorProcessState.Running =>
                SupervisorDecision.ContinueMonitoring,
            SupervisorProcessState.ExitedSuccessfully =>
                SupervisorDecision.RemainStopped,
            SupervisorProcessState.ExitedWithFailure =>
                SupervisorDecision.RecoveryRequired,
            _ => throw new ArgumentException(
                "The supervisor snapshot contains an unsupported process state.",
                nameof(snapshot))
        };
    }

    internal static SupervisorAction PlanAction(
        SupervisorSnapshot snapshot)
    {
        var decision = EvaluateDecision(snapshot);

        return decision switch
        {
            SupervisorDecision.ContinueMonitoring =>
                SupervisorAction.ContinueMonitoring,
            SupervisorDecision.RemainStopped =>
                SupervisorAction.NoAction,
            SupervisorDecision.RecoveryRequired =>
                SupervisorAction.RequestRecovery,
            _ => throw new ArgumentException(
                "The supervisor decision is unsupported.",
                nameof(snapshot))
        };
    }

    internal static SupervisorRecoveryRequest? CreateRecoveryRequest(
        SupervisorSnapshot snapshot)
    {
        var action = PlanAction(snapshot);

        return action switch
        {
            SupervisorAction.RequestRecovery =>
                new SupervisorRecoveryRequest(snapshot, action),
            SupervisorAction.ContinueMonitoring or SupervisorAction.NoAction =>
                null,
            _ => throw new ArgumentException(
                "The supervisor action is unsupported.",
                nameof(snapshot))
        };
    }

    internal static SupervisorRecoveryAuthorization EvaluateRecoveryAuthorization(
        SupervisorRecoveryRequest? request)
    {
        if (!request.HasValue)
        {
            return SupervisorRecoveryAuthorization.NotRequested;
        }

        var certifiedRequest = CreateRecoveryRequest(request.Value.Snapshot);
        if (!certifiedRequest.HasValue || certifiedRequest.Value != request.Value)
        {
            throw new ArgumentException(
                "The recovery request is inconsistent with the certified supervisor action chain.",
                nameof(request));
        }

        return SupervisorRecoveryAuthorization.Denied;
    }
}

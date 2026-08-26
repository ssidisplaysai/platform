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

public readonly record struct SupervisorSnapshot(
    IsolatedProcessObservation Observation,
    SupervisorProcessState ProcessState,
    SupervisorHealth Health);

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
}

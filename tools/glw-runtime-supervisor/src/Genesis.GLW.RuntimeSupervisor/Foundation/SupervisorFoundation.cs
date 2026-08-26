namespace Genesis.GLW.RuntimeSupervisor.Foundation;

public readonly record struct IsolatedProcessObservation(
    bool Running,
    uint? ExitCode);

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
}

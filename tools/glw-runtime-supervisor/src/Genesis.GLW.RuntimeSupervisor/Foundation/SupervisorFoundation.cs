namespace Genesis.GLW.RuntimeSupervisor.Foundation;

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
}

using System.Runtime.InteropServices;

namespace Genesis.GLW.RuntimeSupervisor.Foundation;

public static class PlatformGuard
{
    public static void EnsureSupported()
    {
        EnsureSupported(OperatingSystem.IsWindows(), RuntimeInformation.ProcessArchitecture);
    }

    internal static void EnsureSupported(bool isWindows, Architecture processArchitecture)
    {
        if (!isWindows || processArchitecture != Architecture.X64)
        {
            throw new PlatformNotSupportedException(
                "Genesis GLW Runtime Supervisor requires a Windows x64 process.");
        }
    }
}

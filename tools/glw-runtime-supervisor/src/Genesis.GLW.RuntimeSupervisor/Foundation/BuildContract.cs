using System.Runtime.InteropServices;

namespace Genesis.GLW.RuntimeSupervisor.Foundation;

public static class BuildContract
{
    public const string TargetFramework = "net10.0-windows";
    public const string RuntimeIdentifier = "win-x64";
    public const Architecture TargetArchitecture = Architecture.X64;
    public const bool SelfContained = true;
    public const bool PublishAot = true;
    public const bool InheritHandles = false;
}

using System.ComponentModel;
using System.Runtime.InteropServices;

namespace Genesis.GLW.RuntimeSupervisor.Interop;

public readonly record struct Win32Error(string ApiName, int Code)
{
    public static Win32Error CaptureImmediate(string apiName)
    {
        var errorCode = Marshal.GetLastWin32Error();
        ArgumentException.ThrowIfNullOrWhiteSpace(apiName);
        return new Win32Error(apiName, errorCode);
    }

    public Win32Exception ToException()
    {
        return new Win32Exception(Code, $"{ApiName} failed with Win32 error {Code}.");
    }
}

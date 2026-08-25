using Genesis.GLW.RuntimeSupervisor.Interop;
using System.Runtime.InteropServices;

namespace Genesis.GLW.RuntimeSupervisor.Foundation;

public sealed class IsolatedTestProcess : IDisposable
{
    private int disposed;

    internal IsolatedTestProcess(
        SafeProcessHandle process,
        SafeThreadHandle thread,
        uint processId,
        uint threadId)
    {
        Process = process;
        Thread = thread;
        ProcessId = processId;
        ThreadId = threadId;
    }

    public SafeProcessHandle Process { get; }
    public SafeThreadHandle Thread { get; }
    public uint ProcessId { get; }
    public uint ThreadId { get; }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref disposed, 1) != 0)
        {
            return;
        }

        Thread.Dispose();
        Process.Dispose();
    }
}

public static class IsolatedTestProcessFactory
{
    public static IsolatedTestProcess Create(string applicationPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(applicationPath);

        PlatformGuard.EnsureSupported();

        var fullPath = Path.GetFullPath(applicationPath);

        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException(
                "The isolated test executable was not found.",
                fullPath);
        }

        var startupInfo = new STARTUPINFO
        {
            cb = checked((uint)Marshal.SizeOf<STARTUPINFO>()),
        };

        if (!NativeMethods.CreateProcessW(
            fullPath,
            0,
            0,
            0,
            BuildContract.InheritHandles,
            0,
            0,
            Path.GetDirectoryName(fullPath),
            ref startupInfo,
            out var processInformation))
        {
            throw Win32Error.CaptureImmediate("CreateProcessW").ToException();
        }

        SafeProcessHandle? process = null;
        SafeThreadHandle? thread = null;

        try
        {
            process = new SafeProcessHandle(processInformation.hProcess);
            thread = new SafeThreadHandle(processInformation.hThread);

            var result = new IsolatedTestProcess(
                process,
                thread,
                processInformation.dwProcessId,
                processInformation.dwThreadId);

            process = null;
            thread = null;

            return result;
        }
        finally
        {
            thread?.Dispose();
            process?.Dispose();
        }
    }
}

using Genesis.GLW.RuntimeSupervisor.Interop;
using System.Runtime.InteropServices;

namespace Genesis.GLW.RuntimeSupervisor.Foundation;

public readonly record struct IsolatedTestProcessResult(
    bool Exited,
    uint? ExitCode);
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
    public bool IsRunning
    {
        get
        {
            ThrowIfDisposed();

            var waitResult = NativeMethods.WaitForSingleObject(Process, 0);

            return waitResult switch
            {
                0x00000102 => true,
                0x00000000 => false,
                0xFFFFFFFF => throw Win32Error.CaptureImmediate(
                    "WaitForSingleObject").ToException(),
                _ => throw new InvalidOperationException(
                    $"WaitForSingleObject returned unexpected result 0x{waitResult:X8}."),
            };
        }
    }

    public bool WaitForExit(TimeSpan timeout)
    {
        ThrowIfDisposed();

        if (timeout < TimeSpan.Zero &&
            timeout != Timeout.InfiniteTimeSpan)
        {
            throw new ArgumentOutOfRangeException(nameof(timeout));
        }

        uint milliseconds;

        if (timeout == Timeout.InfiniteTimeSpan)
        {
            milliseconds = uint.MaxValue;
        }
        else
        {
            var totalMilliseconds = timeout.TotalMilliseconds;

            if (double.IsNaN(totalMilliseconds) ||
                totalMilliseconds > uint.MaxValue - 1)
            {
                throw new ArgumentOutOfRangeException(nameof(timeout));
            }

            milliseconds = checked(
                (uint)Math.Ceiling(totalMilliseconds));
        }

        var waitResult = NativeMethods.WaitForSingleObject(
            Process,
            milliseconds);

        return waitResult switch
        {
            0x00000000 => true,
            0x00000102 => false,
            0xFFFFFFFF => throw Win32Error.CaptureImmediate(
                "WaitForSingleObject").ToException(),
            _ => throw new InvalidOperationException(
                $"WaitForSingleObject returned unexpected result 0x{waitResult:X8}."),
        };
    }

    public uint GetExitCode()
    {
        ThrowIfDisposed();

        if (IsRunning)
        {
            throw new InvalidOperationException(
                "The isolated test process has not exited.");
        }

        if (!NativeMethods.GetExitCodeProcess(
            Process,
            out var exitCode))
        {
            throw Win32Error.CaptureImmediate(
                "GetExitCodeProcess").ToException();
        }

        return exitCode;
    }

    public void Terminate(uint exitCode)
    {
        ThrowIfDisposed();

        if (!IsRunning)
        {
            throw new InvalidOperationException(
                "The isolated test process has already exited.");
        }

        if (!NativeMethods.TerminateProcess(
            Process,
            exitCode))
        {
            throw Win32Error.CaptureImmediate(
                "TerminateProcess").ToException();
        }
    }

    public IsolatedTestProcessResult WaitForResult(
        TimeSpan timeout)
    {
        var exited = WaitForExit(timeout);

        if (!exited)
        {
            return new IsolatedTestProcessResult(
                false,
                null);
        }

        return new IsolatedTestProcessResult(
            true,
            GetExitCode());
    }
    public bool TerminateAndWait(
        uint exitCode,
        TimeSpan timeout)
    {
        ThrowIfDisposed();

        if (timeout < TimeSpan.Zero &&
            timeout != Timeout.InfiniteTimeSpan)
        {
            throw new ArgumentOutOfRangeException(
                nameof(timeout));
        }

        if (timeout != Timeout.InfiniteTimeSpan)
        {
            var totalMilliseconds = timeout.TotalMilliseconds;

            if (double.IsNaN(totalMilliseconds) ||
                totalMilliseconds > uint.MaxValue - 1)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(timeout));
            }
        }

        if (!IsRunning)
        {
            throw new InvalidOperationException(
                "The isolated test process has already exited.");
        }

        Terminate(exitCode);

        return WaitForExit(timeout);
    }

    public IsolatedTestProcessResult TerminateAndWaitForResult(
        uint exitCode,
        TimeSpan timeout)
    {
        ThrowIfDisposed();

        var exited =
            TerminateAndWait(
                exitCode,
                timeout);

        if (!exited)
        {
            return new IsolatedTestProcessResult(
                false,
                null);
        }

        return new IsolatedTestProcessResult(
            true,
            GetExitCode());
    }
    private void ThrowIfDisposed()
    {
        if (Volatile.Read(ref disposed) != 0)
        {
            throw new ObjectDisposedException(
                nameof(IsolatedTestProcess));
        }
    }

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

using Microsoft.Win32.SafeHandles;
using System.Runtime.InteropServices;

namespace Genesis.GLW.RuntimeSupervisor.Interop;

public abstract class SafeKernelObjectHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    protected SafeKernelObjectHandle()
        : base(ownsHandle: true)
    {
    }

    protected SafeKernelObjectHandle(nint ownedHandle)
        : base(ownsHandle: true)
    {
        SetHandle(ownedHandle);
    }

    protected sealed override bool ReleaseHandle()
    {
        try
        {
            return NativeMethods.CloseHandle(handle);
        }
        catch
        {
            return false;
        }
    }
}

public sealed class SafeJobHandle : SafeKernelObjectHandle
{
    public SafeJobHandle() { }
    internal SafeJobHandle(nint ownedHandle) : base(ownedHandle) { }
}

public sealed class SafeProcessHandle : SafeKernelObjectHandle
{
    public SafeProcessHandle() { }
    internal SafeProcessHandle(nint ownedHandle) : base(ownedHandle) { }
}

public sealed class SafeThreadHandle : SafeKernelObjectHandle
{
    public SafeThreadHandle() { }
    internal SafeThreadHandle(nint ownedHandle) : base(ownedHandle) { }
}

public sealed class SafeTokenHandle : SafeKernelObjectHandle
{
    public SafeTokenHandle() { }
    internal SafeTokenHandle(nint ownedHandle) : base(ownedHandle) { }
}

public sealed class SafeIoCompletionPortHandle : SafeKernelObjectHandle
{
    public SafeIoCompletionPortHandle() { }
    internal SafeIoCompletionPortHandle(nint ownedHandle) : base(ownedHandle) { }
}

public sealed class SafeMutexHandle : SafeKernelObjectHandle
{
    public SafeMutexHandle() { }
    internal SafeMutexHandle(nint ownedHandle) : base(ownedHandle) { }
}

public sealed class SafePipeHandle : SafeKernelObjectHandle
{
    public SafePipeHandle() { }
    internal SafePipeHandle(nint ownedHandle) : base(ownedHandle) { }
}

public sealed class SafeLocalAllocHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeLocalAllocHandle() : base(ownsHandle: true) { }
    internal SafeLocalAllocHandle(nint ownedHandle) : base(ownsHandle: true) => SetHandle(ownedHandle);

    protected override bool ReleaseHandle()
    {
        try
        {
            return NativeMethods.LocalFree(handle) == 0;
        }
        catch
        {
            return false;
        }
    }
}

public sealed class SafeProcThreadAttributeList : SafeHandleZeroOrMinusOneIsInvalid
{
    private bool initialized;

    public SafeProcThreadAttributeList() : base(ownsHandle: true) { }
    internal SafeProcThreadAttributeList(nint ownedAllocation) : base(ownsHandle: true) => SetHandle(ownedAllocation);

    internal void MarkInitialized() => initialized = true;

    protected override bool ReleaseHandle()
    {
        var deleted = true;

        try
        {
            if (initialized)
            {
                NativeMethods.DeleteProcThreadAttributeList(handle);
            }
        }
        catch
        {
            deleted = false;
        }

        try
        {
            Marshal.FreeHGlobal(handle);
            return deleted;
        }
        catch
        {
            return false;
        }
    }
}

public sealed class SafeCertContextHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeCertContextHandle() : base(ownsHandle: true) { }
    internal SafeCertContextHandle(nint ownedHandle) : base(ownsHandle: true) => SetHandle(ownedHandle);

    protected override bool ReleaseHandle()
    {
        try
        {
            return NativeMethods.CertFreeCertificateContext(handle);
        }
        catch
        {
            return false;
        }
    }
}

public static class FrameworkSafeHandlePolicy
{
    public static Type FileHandleType => typeof(SafeFileHandle);
}

using System.Runtime.InteropServices;

namespace Genesis.GLW.RuntimeSupervisor.Interop;

internal sealed class SafeHandleLease<THandle> : IDisposable where THandle : SafeHandle
{
    private THandle? owner;
    private int disposed;

    private SafeHandleLease(THandle owner)
    {
        this.owner = owner;
    }

    internal static SafeHandleLease<THandle> Acquire(THandle owner)
    {
        ArgumentNullException.ThrowIfNull(owner);
        if (owner.IsInvalid || owner.IsClosed)
        {
            throw new ObjectDisposedException(typeof(THandle).Name);
        }

        var referenceAdded = false;

        try
        {
            owner.DangerousAddRef(ref referenceAdded);
            if (!referenceAdded)
            {
                throw new InvalidOperationException("SafeHandle did not grant a dangerous reference.");
            }

            return new SafeHandleLease<THandle>(owner);
        }
        catch
        {
            if (referenceAdded)
            {
                owner.DangerousRelease();
            }

            throw;
        }
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref disposed, 1) != 0)
        {
            return;
        }

        Release(Interlocked.Exchange(ref owner, null));
    }

    private static void Release(THandle? retainedOwner)
    {
        if (retainedOwner is null)
        {
            return;
        }

        try
        {
            retainedOwner.DangerousRelease();
        }
        catch
        {
            // Dispose must not leak an exception into a native cleanup path.
        }
    }
}

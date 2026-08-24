using System.Runtime.InteropServices;

namespace Genesis.GLW.RuntimeSupervisor.Interop;

internal static partial class NativeMethods
{
    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool CloseHandle(nint handle);

    [LibraryImport("kernel32.dll")]
    internal static partial nint LocalFree(nint memory);

    [LibraryImport("kernel32.dll")]
    internal static partial void DeleteProcThreadAttributeList(nint attributeList);

    [LibraryImport("crypt32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool CertFreeCertificateContext(nint certificateContext);
}

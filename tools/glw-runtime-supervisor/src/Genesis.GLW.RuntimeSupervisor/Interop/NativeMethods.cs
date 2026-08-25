using System.Runtime.InteropServices;

namespace Genesis.GLW.RuntimeSupervisor.Interop;

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
internal struct STARTUPINFO
{
    internal uint cb;
    internal string? lpReserved;
    internal string? lpDesktop;
    internal string? lpTitle;
    internal uint dwX;
    internal uint dwY;
    internal uint dwXSize;
    internal uint dwYSize;
    internal uint dwXCountChars;
    internal uint dwYCountChars;
    internal uint dwFillAttribute;
    internal uint dwFlags;
    internal ushort wShowWindow;
    internal ushort cbReserved2;
    internal nint lpReserved2;
    internal nint hStdInput;
    internal nint hStdOutput;
    internal nint hStdError;
}

[StructLayout(LayoutKind.Sequential)]
internal struct PROCESS_INFORMATION
{
    internal nint hProcess;
    internal nint hThread;
    internal uint dwProcessId;
    internal uint dwThreadId;
}

internal static partial class NativeMethods
{
    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool CloseHandle(nint handle);
    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool GetExitCodeProcess(
        SafeProcessHandle process,
        out uint exitCode);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    internal static partial uint WaitForSingleObject(
        SafeProcessHandle handle,
        uint milliseconds);

    [LibraryImport("kernel32.dll")]
    internal static partial nint LocalFree(nint memory);

    [LibraryImport("kernel32.dll")]
    internal static partial void DeleteProcThreadAttributeList(nint attributeList);

    [LibraryImport("crypt32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool CertFreeCertificateContext(nint certificateContext);

    [DllImport(
        "kernel32.dll",
        EntryPoint = "CreateProcessW",
        SetLastError = true,
        CharSet = CharSet.Unicode,
        ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool CreateProcessW(
        string applicationName,
        nint commandLine,
        nint processAttributes,
        nint threadAttributes,
        [MarshalAs(UnmanagedType.Bool)] bool inheritHandles,
        uint creationFlags,
        nint environment,
        string? currentDirectory,
        ref STARTUPINFO startupInfo,
        out PROCESS_INFORMATION processInformation);
}

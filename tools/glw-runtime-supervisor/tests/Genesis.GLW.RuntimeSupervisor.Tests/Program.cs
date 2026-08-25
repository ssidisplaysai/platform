using Genesis.GLW.RuntimeSupervisor.Foundation;
using Genesis.GLW.RuntimeSupervisor.Interop;
using Microsoft.Win32.SafeHandles;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using System.Xml.Linq;

var tests = new (string Name, Action Body)[]
{
    ("Project files target Windows x64 NativeAOT", ProjectFilesTargetWindowsX64NativeAot),
    ("Platform guard accepts Windows x64", PlatformGuardAcceptsWindowsX64),
    ("Platform guard rejects unsupported targets", PlatformGuardRejectsUnsupportedTargets),
    ("SafeHandle owns and releases an isolated handle", SafeHandleOwnsAndReleasesFixture),
    ("SafeHandle disposal is idempotent", SafeHandleDisposalIsIdempotent),
    ("Invalid SafeHandles remain invalid", InvalidSafeHandlesRemainInvalid),
    ("ReleaseHandle is non-throwing", ReleaseHandleIsNonThrowing),
    ("Handle inheritance defaults off", HandleInheritanceDefaultsOff),
    ("Native error capture is immediate", NativeErrorCaptureIsImmediate),
    ("Safe file handle uses framework implementation", SafeFileHandleUsesFrameworkImplementation),
    ("Lease basic acquire and release", LeaseBasicAcquireAndRelease),
    ("Lease repeated disposal releases once", LeaseRepeatedDisposeReleasesOnce),
    ("Lease aliases share one release obligation", LeaseAliasesShareOneReleaseObligation),
    ("Lease concurrent disposal releases once", LeaseConcurrentDisposeReleasesOnce),
    ("Lease exposes no raw handle authority", LeaseExposesNoRawHandleAuthority),
    ("Lease rejects invalid and closed handles", LeaseRejectsInvalidAndClosedHandles),
    ("Lease retains the underlying SafeHandle", LeaseRetainsUnderlyingSafeHandle),
    ("Failed lease acquisition requires no release", FailedLeaseAcquisitionRequiresNoRelease),
    ("Lease has no finalizer", LeaseHasNoFinalizer),
    ("LocalAlloc wrapper frees isolated memory", LocalAllocWrapperFreesIsolatedMemory),
    ("Initialized attribute list reaches disposed state", InitializedAttributeListReachesDisposedState),
    ("Certificate context reaches disposed state", CertificateContextReachesDisposedState),
    ("Runtime functionality is absent", RuntimeFunctionalityIsAbsent),
};

var failures = 0;
foreach (var test in tests)
{
    try
    {
        test.Body();
        Console.WriteLine($"PASS {test.Name}");
    }
    catch (Exception exception)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {test.Name}: {exception.Message}");
    }
}

Console.WriteLine($"TOTAL={tests.Length} PASSED={tests.Length - failures} FAILED={failures}");
return failures == 0 ? 0 : 1;

static void ProjectFilesTargetWindowsX64NativeAot()
{
    var sourceRoot = FindSupervisorRoot();
    using var sdk = JsonDocument.Parse(File.ReadAllText(Path.Combine(sourceRoot, "global.json")));
    var props = XDocument.Load(Path.Combine(sourceRoot, "Directory.Build.props"));
    var project = XDocument.Load(Path.Combine(sourceRoot, "src", "Genesis.GLW.RuntimeSupervisor", "Genesis.GLW.RuntimeSupervisor.csproj"));
    var testProject = XDocument.Load(Path.Combine(sourceRoot, "tests", "Genesis.GLW.RuntimeSupervisor.Tests", "Genesis.GLW.RuntimeSupervisor.Tests.csproj"));

    var sdkElement = sdk.RootElement.GetProperty("sdk");
    Assert.Equal("10.0.100", sdkElement.GetProperty("version").GetString()!);
    Assert.Equal("disable", sdkElement.GetProperty("rollForward").GetString()!);
    Assert.False(sdkElement.GetProperty("allowPrerelease").GetBoolean());
    Assert.Equal("net10.0-windows", PropertyValue(props, "TargetFramework"));
    Assert.Equal("win-x64", PropertyValue(props, "RuntimeIdentifier"));
    Assert.Equal("x64", PropertyValue(props, "PlatformTarget"));
    Assert.Equal("true", PropertyValue(project, "SelfContained"));
    Assert.Equal("true", PropertyValue(project, "PublishAot"));
    Assert.Equal("true", PropertyValue(project, "PublishSingleFile"));
    Assert.Equal("enable", PropertyValue(props, "Nullable"));
    Assert.Equal("true", PropertyValue(props, "TreatWarningsAsErrors"));
    Assert.Equal("true", PropertyValue(props, "AllowUnsafeBlocks"));
    Assert.Equal("true", PropertyValue(props, "Deterministic"));
    Assert.Equal("true", PropertyValue(props, "ContinuousIntegrationBuild"));

    var forbiddenOverrides = new[] { "TargetFramework", "RuntimeIdentifier", "PlatformTarget" };
    foreach (var propertyName in forbiddenOverrides)
    {
        Assert.False(project.Descendants(propertyName).Any());
        Assert.False(testProject.Descendants(propertyName).Any());
    }
}

static void PlatformGuardAcceptsWindowsX64() => PlatformGuard.EnsureSupported(true, Architecture.X64);

static void PlatformGuardRejectsUnsupportedTargets()
{
    Assert.Throws<PlatformNotSupportedException>(() => PlatformGuard.EnsureSupported(false, Architecture.X64));
    Assert.Throws<PlatformNotSupportedException>(() => PlatformGuard.EnsureSupported(true, Architecture.Arm64));
}

static void SafeHandleOwnsAndReleasesFixture()
{
    var rawHandle = CreateIsolatedEvent();
    var handle = new TestSafeKernelObjectHandle(rawHandle);
    Assert.False(handle.IsInvalid);
    handle.Dispose();
    var waitResult = TestNativeMethods.WaitForSingleObject(rawHandle, 0);
    var errorCode = Marshal.GetLastWin32Error();
    Assert.Equal(uint.MaxValue, waitResult);
    Assert.Equal(6, errorCode);
}

static void SafeHandleDisposalIsIdempotent()
{
    var rawHandle = CreateIsolatedEvent();
    var handle = new TestSafeKernelObjectHandle(rawHandle);
    Assert.False(handle.IsInvalid);
    handle.Dispose();
    handle.Dispose();
    Assert.True(handle.IsClosed);
    var waitResult = TestNativeMethods.WaitForSingleObject(rawHandle, 0);
    var errorCode = Marshal.GetLastWin32Error();
    Assert.Equal(uint.MaxValue, waitResult);
    Assert.Equal(6, errorCode);
}

static void InvalidSafeHandlesRemainInvalid()
{
    using var job = new SafeJobHandle();
    using var process = new Genesis.GLW.RuntimeSupervisor.Interop.SafeProcessHandle();
    using var thread = new SafeThreadHandle();
    using var token = new SafeTokenHandle();
    using var completionPort = new SafeIoCompletionPortHandle();
    using var mutex = new SafeMutexHandle();
    using var pipe = new Genesis.GLW.RuntimeSupervisor.Interop.SafePipeHandle();
    using var localAlloc = new SafeLocalAllocHandle();
    using var attributeList = new SafeProcThreadAttributeList();
    using var certificate = new SafeCertContextHandle();

    Assert.True(new SafeHandle[] { job, process, thread, token, completionPort, mutex, pipe, localAlloc, attributeList, certificate }.All(handle => handle.IsInvalid));
}

static void ReleaseHandleIsNonThrowing()
{
    using var handle = CreateIsolatedEventHandle();
    handle.Dispose();
    handle.Dispose();
}

static void HandleInheritanceDefaultsOff() => Assert.False(BuildContract.InheritHandles);

static void NativeErrorCaptureIsImmediate()
{
    const int expected = 1234;
    TestNativeMethods.SetLastError((uint)expected);
    var error = Win32Error.CaptureImmediate("SUP_M1_TEST");
    Assert.Equal(expected, error.Code);
    Assert.Equal("SUP_M1_TEST", error.ApiName);
}

static void SafeFileHandleUsesFrameworkImplementation()
{
    Assert.Equal(typeof(SafeFileHandle), FrameworkSafeHandlePolicy.FileHandleType);
}

static void LeaseBasicAcquireAndRelease()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var lease = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    handle.Dispose();
    Assert.Equal(0, handle.ReleaseCount);
    lease.Dispose();
    Assert.Equal(1, handle.ReleaseCount);
}

static void LeaseRepeatedDisposeReleasesOnce()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var lease = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    handle.Dispose();
    lease.Dispose();
    lease.Dispose();
    Assert.Equal(1, handle.ReleaseCount);
}

static void LeaseAliasesShareOneReleaseObligation()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var first = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    var second = first;
    handle.Dispose();
    first.Dispose();
    second.Dispose();
    Assert.Equal(1, handle.ReleaseCount);
}

static void LeaseConcurrentDisposeReleasesOnce()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var lease = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    handle.Dispose();
    Parallel.For(0, 32, _ => lease.Dispose());
    Assert.Equal(1, handle.ReleaseCount);
}

static void LeaseExposesNoRawHandleAuthority()
{
    var leaseType = typeof(SafeHandleLease<SafeJobHandle>);
    var members = leaseType.GetMembers(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);

    Assert.False(members.OfType<FieldInfo>().Any(field => ContainsRawHandleType(field.FieldType)));
    Assert.False(members.OfType<PropertyInfo>().Any(property => ContainsRawHandleType(property.PropertyType)));
    Assert.False(members.OfType<MethodInfo>().Any(method =>
        ContainsRawHandleType(method.ReturnType) ||
        method.GetParameters().Any(parameter => ContainsRawHandleType(parameter.ParameterType))));
    Assert.False(members.OfType<ConstructorInfo>().Any(constructor =>
        constructor.GetParameters().Any(parameter => ContainsRawHandleType(parameter.ParameterType))));
}

static void LeaseRejectsInvalidAndClosedHandles()
{
    using var invalid = new CountingSafeKernelObjectHandle(0);
    Assert.Throws<ObjectDisposedException>(() => SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(invalid));

    var closed = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    closed.Dispose();
    Assert.Throws<ObjectDisposedException>(() => SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(closed));
}

static void LeaseRetainsUnderlyingSafeHandle()
{
    var handle = new CountingSafeKernelObjectHandle(CreateIsolatedEvent());
    var lease = SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(handle);
    handle.Dispose();
    Assert.Equal(0, handle.ReleaseCount);
    lease.Dispose();
    Assert.Equal(1, handle.ReleaseCount);
}

static void FailedLeaseAcquisitionRequiresNoRelease()
{
    using var invalid = new CountingSafeKernelObjectHandle(0);
    Assert.Throws<ObjectDisposedException>(() => SafeHandleLease<CountingSafeKernelObjectHandle>.Acquire(invalid));
    Assert.Equal(0, invalid.ReleaseCount);
}

static void LeaseHasNoFinalizer()
{
    var finalizer = typeof(SafeHandleLease<SafeJobHandle>).GetMethod(
        "Finalize",
        BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
    Assert.True(finalizer is null);
}

static void LocalAllocWrapperFreesIsolatedMemory()
{
    var memory = TestNativeMethods.LocalAlloc(0, 128);
    if (memory == 0)
    {
        throw new InvalidOperationException("LocalAlloc failed.");
    }

    var ownedMemory = new SafeLocalAllocHandle(memory);

    Assert.False(ownedMemory.IsInvalid);
    Assert.True(TestNativeMethods.LocalSize(ownedMemory.DangerousGetHandle()) >= 128);

    ownedMemory.Dispose();

    Assert.True(ownedMemory.IsClosed);
}
static void InitializedAttributeListReachesDisposedState()
{
    nuint bytes = 0;
    _ = TestNativeMethods.InitializeProcThreadAttributeList(0, 1, 0, ref bytes);
    var allocation = Marshal.AllocHGlobal(checked((nint)bytes));
    var attributeList = new SafeProcThreadAttributeList(allocation);

    if (!TestNativeMethods.InitializeProcThreadAttributeList(allocation, 1, 0, ref bytes))
    {
        var errorCode = Marshal.GetLastWin32Error();
        attributeList.Dispose();
        throw new InvalidOperationException($"InitializeProcThreadAttributeList failed with error {errorCode}.");
    }

    attributeList.MarkInitialized();
    attributeList.Dispose();
    Assert.True(attributeList.IsClosed);
}

static void CertificateContextReachesDisposedState()
{
    using var key = RSA.Create(2048);
    var request = new CertificateRequest("CN=SUP-M1 Fixture", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddMinutes(5));
    var duplicate = TestNativeMethods.CertDuplicateCertificateContext(certificate.Handle);
    if (duplicate == 0)
    {
        throw new InvalidOperationException("CertDuplicateCertificateContext failed.");
    }

    var context = new SafeCertContextHandle(duplicate);
    Assert.False(context.IsInvalid);
    context.Dispose();
    Assert.True(context.IsClosed);
}

static void RuntimeFunctionalityIsAbsent()
{
    Assert.True(RuntimeCapabilityBoundary.CanCreateIsolatedTestProcess);
    Assert.False(RuntimeCapabilityBoundary.CanCreateRuntimeProcess);
    Assert.False(RuntimeCapabilityBoundary.CanCreateProductionJob);
    Assert.False(RuntimeCapabilityBoundary.CanResumeRuntimeThread);
    Assert.False(RuntimeCapabilityBoundary.CanTerminateRuntime);
    Assert.False(RuntimeCapabilityBoundary.CanControlPort3001);
    Assert.False(RuntimeCapabilityBoundary.CanAccessProductionJournal);
    Assert.False(RuntimeCapabilityBoundary.CanHostProductionControlPipe);
    Assert.False(RuntimeCapabilityBoundary.CanModifyTaskScheduler);

    var forbiddenMethods = new HashSet<string>(StringComparer.Ordinal)
    {
        "AssignProcessToJobObject",
        "CreateJobObjectW",
        "CreateNamedPipeW",
        "CreateProcessAsUserW",
        "CreateRestrictedToken",
        "GetExtendedTcpTable",
        "ResumeThread",
        "TerminateProcess",
        "TerminateJobObject",
        "UpdateProcThreadAttribute",
    };

    var declaredMethods = typeof(BuildContract).Assembly
        .GetTypes()
        .SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance))
        .Select(method => method.Name);

    Assert.False(declaredMethods.Any(forbiddenMethods.Contains));

    var sourceRoot = FindSupervisorRoot();
    var productionSource = Directory.GetFiles(
        Path.Combine(sourceRoot, "src", "Genesis.GLW.RuntimeSupervisor"),
        "*.cs",
        SearchOption.AllDirectories);
    var productionText = string.Join('\n', productionSource.Select(File.ReadAllText));
    Assert.Equal(4, productionText.Split("[LibraryImport(", StringSplitOptions.None).Length - 1);
    Assert.Equal(1, productionText.Split("[DllImport(", StringSplitOptions.None).Length - 1);
    Assert.True(productionText.Contains("CreateProcessW", StringComparison.Ordinal));
    Assert.False(productionText.Contains("CreateProcessAsUserW", StringComparison.Ordinal));
    Assert.False(productionText.Contains("CreateJobObject", StringComparison.Ordinal));
    Assert.False(productionText.Contains("TerminateJobObject", StringComparison.Ordinal));
}

static nint CreateIsolatedEvent()
{
    var rawHandle = TestNativeMethods.CreateEventW(0, false, false, null);
    if (rawHandle == 0 || rawHandle == -1)
    {
        throw new InvalidOperationException($"CreateEventW failed with error {Marshal.GetLastWin32Error()}.");
    }

    return rawHandle;
}

static TestSafeKernelObjectHandle CreateIsolatedEventHandle()
{
    var rawHandle = CreateIsolatedEvent();

    try
    {
        return new TestSafeKernelObjectHandle(rawHandle);
    }
    catch
    {
        _ = TestNativeMethods.CloseHandle(rawHandle);
        throw;
    }
}

static string FindSupervisorRoot()
{
    var directory = new DirectoryInfo(AppContext.BaseDirectory);
    while (directory is not null)
    {
        if (File.Exists(Path.Combine(directory.FullName, "global.json")) &&
            File.Exists(Path.Combine(directory.FullName, "Directory.Build.props")))
        {
            return directory.FullName;
        }

        directory = directory.Parent;
    }

    throw new DirectoryNotFoundException("Supervisor source root was not found.");
}

static string PropertyValue(XDocument document, string name)
{
    return document.Descendants(name).Single().Value;
}

static bool ContainsRawHandleType(Type type)
{
    if (type == typeof(nint) || type == typeof(nuint) || type == typeof(IntPtr) || type == typeof(UIntPtr))
    {
        return true;
    }

    if (type.IsByRef || type.IsPointer || type.IsArray)
    {
        return ContainsRawHandleType(type.GetElementType()!);
    }

    return type.IsGenericType && type.GetGenericArguments().Any(ContainsRawHandleType);
}

internal static partial class TestNativeMethods
{
    [LibraryImport("kernel32.dll", EntryPoint = "CreateEventW", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    internal static partial nint CreateEventW(
        nint eventAttributes,
        [MarshalAs(UnmanagedType.Bool)] bool manualReset,
        [MarshalAs(UnmanagedType.Bool)] bool initialState,
        string? name);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    internal static partial uint WaitForSingleObject(nint handle, uint milliseconds);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    internal static partial void SetLastError(uint errorCode);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    internal static partial nint LocalAlloc(uint flags, nuint bytes);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    internal static partial nuint LocalSize(nint memory);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool InitializeProcThreadAttributeList(
        nint attributeList,
        uint attributeCount,
        uint flags,
        ref nuint size);

    [LibraryImport("crypt32.dll")]
    internal static partial nint CertDuplicateCertificateContext(nint certificateContext);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool CloseHandle(nint handle);
}

internal sealed class TestSafeKernelObjectHandle(nint ownedHandle) : SafeKernelObjectHandle(ownedHandle);

internal sealed class CountingSafeKernelObjectHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    private int releaseCount;

    internal CountingSafeKernelObjectHandle(nint ownedHandle)
        : base(ownsHandle: true)
    {
        SetHandle(ownedHandle);
    }

    internal int ReleaseCount => Volatile.Read(ref releaseCount);

    protected override bool ReleaseHandle()
    {
        Interlocked.Increment(ref releaseCount);
        return TestNativeMethods.CloseHandle(handle);
    }
}

internal static class Assert
{
    internal static void True(bool condition)
    {
        if (!condition)
        {
            throw new InvalidOperationException("Expected true.");
        }
    }

    internal static void False(bool condition) => True(!condition);

    internal static void Equal<T>(T expected, T actual) where T : notnull
    {
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
        {
            throw new InvalidOperationException($"Expected '{expected}', actual '{actual}'.");
        }
    }

    internal static void Throws<TException>(Action action) where TException : Exception
    {
        try
        {
            action();
        }
        catch (TException)
        {
            return;
        }

        throw new InvalidOperationException($"Expected {typeof(TException).Name}.");
    }
}

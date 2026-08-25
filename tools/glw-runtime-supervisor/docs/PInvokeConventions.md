# P/Invoke conventions

All future native declarations must follow these rules:

1. Use `LibraryImport` with exact Unicode entry points and `StringMarshalling.Utf16` for Win32 string APIs.
2. Set `SetLastError = true` only when the native contract defines last-error information, and capture it immediately.
3. Represent pointer-sized values with `nint` or `nuint`; use explicitly sized integer types for `BOOL`, `DWORD`, and other fixed-width values.
4. Declare structures with explicit `StructLayout`, field widths, unions, and packing required by the Windows SDK contract.
5. Check every native `BOOL`, `DWORD`, pointer, null handle, and `INVALID_HANDLE_VALUE` result before use.
6. Return owned handles as typed `SafeHandle` instances. Handle inheritance is disabled unless a later approved phase proves an explicit requirement.
7. Do not persist or export raw handle values. `SafeHandleLease<T>` retains lifetime only and exposes no `nint`, `IntPtr`, pointer, delegate, callback, property, or method that can reveal native handle authority. Future native operations must be implemented as narrow interop-boundary operations that consume the retained SafeHandle internally rather than returning raw authority to callers.
8. `ReleaseHandle` performs only the matching native close/free operation, never waits, and never throws.
9. Do not invoke a shell, PowerShell, `cmd.exe`, npm wrapper, or implicit process launcher from interop code.
10. Add only declarations required by the current authorized implementation phase.

SUP-M1 declares only the close/free operations needed by its SafeHandle ownership foundation.

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$supervisorRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$productionRoot = Join-Path $supervisorRoot 'src\Genesis.GLW.RuntimeSupervisor'
$relevantFiles = @(
    Get-ChildItem -LiteralPath $supervisorRoot -Recurse -File |
        Where-Object {
            $_.Extension -in @('.cs', '.csproj', '.props', '.targets') -and
            $_.FullName -notmatch '[\\/](bin|obj|artifacts)[\\/]'
        }
)
$productionFiles = @(
    $relevantFiles |
        Where-Object { $_.FullName.StartsWith($productionRoot, [StringComparison]::OrdinalIgnoreCase) }
)
$csharpFiles = @($relevantFiles | Where-Object { $_.Extension -eq '.cs' })
$buildFiles = @($relevantFiles | Where-Object { $_.Extension -in @('.csproj', '.props', '.targets') })

$productionLifecyclePatterns = @(
    'AssignProcessToJobObject',
    'CreateJobObjectW',
    'CreateNamedPipeW',
    'CreateProcessAsUserW',
    'CreateRestrictedToken',
    'GetExtendedTcpTable',
    'HttpClient',
    'PROC_THREAD_ATTRIBUTE_JOB_LIST',
    'Register-ScheduledTask',
    'ResumeThread',
    'TerminateJobObject',
    'TerminateProcess',
    'UpdateProcThreadAttribute'
)

$allCsharpExecutionPatterns = @(
    'Assembly\.Load',
    'GetProcAddress',
    'Marshal\.GetDelegateForFunctionPointer',
    'NativeLibrary\.(GetExport|Load|TryGetExport|TryLoad)',
    '\b(?:System\.Diagnostics\.)?Process\.Start\s*\(',
    '\bnew\s+(?:System\.Diagnostics\.)?Process(?:StartInfo)?\s*\(',
    'powershell(?:\.exe)?',
    'pwsh(?:\.exe)?',
    'cmd(?:\.exe)?',
    'ShellExecute',
    'schtasks(?:\.exe)?',
    'Start-(?:Job|Process|ScheduledTask)',
    'Stop-(?:Process|ScheduledTask)',
    'taskkill(?:\.exe)?',
    'C:\\ProgramData\\Genesis\\GLW',
    'Start-GenesisGlw\.ps1'
)

$buildExecutionPatterns = @(
    'CodeTaskFactory',
    'RoslynCodeTaskFactory',
    '<Exec\b',
    '<UsingTask\b',
    'powershell(?:\.exe)?',
    'pwsh(?:\.exe)?',
    'cmd(?:\.exe)?',
    'schtasks(?:\.exe)?',
    'C:\\ProgramData\\Genesis\\GLW'
)

$violations = @(
    $productionFiles |
        Select-String -Pattern ($productionLifecyclePatterns -join '|')
    $csharpFiles |
        Select-String -Pattern ($allCsharpExecutionPatterns -join '|')
    $buildFiles |
        Select-String -Pattern ($buildExecutionPatterns -join '|')
)

if ($violations.Count -ne 0) {
    $violations | ForEach-Object {
        Write-Error "$($_.Path):$($_.LineNumber): $($_.Line.Trim())"
    }

    throw "SUP-M1 production boundary violation count: $($violations.Count)"
}

$allText = ($relevantFiles | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n"

$productionText = ($productionFiles | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n"

$dllImportPattern = '(?m)^\s*\[(?:(?:global::)?System\.Runtime\.InteropServices\.)?DllImport(?:Attribute)?\s*\('
$dllImportCount = [regex]::Matches($productionText, $dllImportPattern).Count
$approvedDllImports = @(
    'CreateProcessW'
)

if ($dllImportCount -ne $approvedDllImports.Count) {
    throw "SUP-M3 production DllImport count is not approved: $dllImportCount."
}

$dllImportMethodPattern = '(?ms)^\s*\[(?:(?:global::)?System\.Runtime\.InteropServices\.)?DllImport(?:Attribute)?\s*\(.*?\)\]\s*(?:\[[^\]]+\]\s*)*internal\s+static\s+extern\s+[^\r\n(]+\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\('
$dllImportNames = @(
    [regex]::Matches($productionText, $dllImportMethodPattern) |
        ForEach-Object { $_.Groups['name'].Value }
)

if (Compare-Object ($dllImportNames | Sort-Object) ($approvedDllImports | Sort-Object)) {
    throw "SUP-M3 production DllImport set is not approved: $($dllImportNames -join ',')."
}
$libraryImportPattern = '(?m)^\s*\[(?:(?:global::)?System\.Runtime\.InteropServices\.)?LibraryImport(?:Attribute)?\s*\('
$importCount = [regex]::Matches($productionText, $libraryImportPattern).Count
$approvedImports = @(
    'CertFreeCertificateContext',
    'CloseHandle',
    'DeleteProcThreadAttributeList',
    'GetExitCodeProcess',
    'LocalFree',
    'WaitForSingleObject'
)

if ($importCount -ne $approvedImports.Count) {
    throw "SUP-M3 production LibraryImport count is not approved: $importCount."
}

$partialMethodPattern = '(?m)^\s*(?=[^\r\n]*\bstatic\b)(?=[^\r\n]*\bpartial\b)[^\r\n(]*\b(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\('
$importNames = @(
    [regex]::Matches($productionText, $partialMethodPattern) |
        ForEach-Object { $_.Groups['name'].Value }
)

if (Compare-Object ($importNames | Sort-Object) ($approvedImports | Sort-Object)) {
    throw "SUP-M3 production LibraryImport set is not approved: $($importNames -join ',')."
}

$interopAliasPattern = '(?m)^\s*using\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:global::)?System\.Runtime\.InteropServices\.(?:DllImport|LibraryImport)(?:Attribute)?\s*;'
if ($allText -match $interopAliasPattern) {
    throw 'SUP-M1 does not permit aliases for native import attributes.'
}

'SUP_M1_BOUNDARY_ROLE=DEFENSE_IN_DEPTH'
'SUP_M1_BOUNDARY=PASS'

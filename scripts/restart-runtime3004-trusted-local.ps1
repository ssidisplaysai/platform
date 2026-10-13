param(
    [Parameter(Mandatory = $false)]
    [string]$Worktree = "",

    [Parameter(Mandatory = $false)]
    [string]$PersistenceDir = "C:\Users\rober\Documents\Stoner Platform\worktrees\glw-site-onboarding\.gcp-foundation-data",

    [Parameter(Mandatory = $true)]
    [string]$GitCommit,

    [Parameter(Mandatory = $false)]
    [int]$Port = 3004
)

$ErrorActionPreference = "Stop"

if (-not $Worktree) {
    $Worktree = (Get-Location).Path
}

$Worktree = (Resolve-Path -LiteralPath $Worktree).Path
if (-not (Test-Path -LiteralPath $PersistenceDir)) {
    throw "PERSISTENCE_DIR_NOT_FOUND"
}

$resolvedGitCommit = ((git -C $Worktree rev-parse --verify "$GitCommit^{commit}" 2>$null) | Select-Object -First 1)
if (-not $resolvedGitCommit) {
    throw "GIT_COMMIT_INVALID_OR_UNRESOLVABLE"
}

$resolvedGitCommit = $resolvedGitCommit.Trim().ToLower()
if ($resolvedGitCommit -notmatch '^[0-9a-f]{40}$') {
    throw "GIT_COMMIT_EXACT_SHA_REQUIRED"
}

$openAiKey = [Environment]::GetEnvironmentVariable("GENESIS_OPENAI_API_KEY", "User")
$operatorDirectoryJson = [Environment]::GetEnvironmentVariable("GENESIS_OPERATOR_DIRECTORY_JSON", "User")

if (-not $openAiKey) {
    throw "MISSING_GENESIS_OPENAI_API_KEY"
}

if (-not $operatorDirectoryJson) {
    throw "MISSING_GENESIS_OPERATOR_DIRECTORY_JSON"
}

$current3001 = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess
$currentTargetPort = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

if ($currentTargetPort) {
    Stop-Process -Id $currentTargetPort -Force
}

$stdout = Join-Path $Worktree "runtime${Port}.stdout.log"
$stderr = Join-Path $Worktree "runtime${Port}.stderr.log"

$command = @(
    "Set-Location -LiteralPath '$Worktree'",
    "`$env:GCP_FOUNDATION_PERSISTENCE_DIR='$PersistenceDir'",
    "`$env:GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR='$PersistenceDir'",
    "`$env:GENESIS_TRUSTED_LOCAL_OPERATOR='true'",
    "`$env:GENESIS_RENDER_CAPTURE_INTERNAL_ORIGIN='http://localhost:$Port'",
    "`$env:GIT_COMMIT='$resolvedGitCommit'",
    "`$env:GENESIS_OPENAI_API_KEY=[Environment]::GetEnvironmentVariable('GENESIS_OPENAI_API_KEY','User')",
    "`$env:GENESIS_OPERATOR_DIRECTORY_JSON=[Environment]::GetEnvironmentVariable('GENESIS_OPERATOR_DIRECTORY_JSON','User')",
    "node .\node_modules\next\dist\bin\next start -p $Port -H 127.0.0.1 1>> '$stdout' 2>> '$stderr'"
) -join "; "

$launcher = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-Command",
    $command
) -PassThru

$listenerPid = $null
for ($i = 0; $i -lt 60; $i++) {
    $listenerPid = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty OwningProcess
    if ($listenerPid) { break }
    Start-Sleep -Milliseconds 500
}

if (-not $listenerPid) {
    throw "RUNTIME_START_FAILED"
}

$post3001 = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

Write-Output "RUNTIME_PORT=$Port"
Write-Output "RUNTIME_PID=$listenerPid"
Write-Output "LAUNCHER_PID=$($launcher.Id)"
Write-Output "GIT_COMMIT_INPUT=$GitCommit"
Write-Output "GIT_COMMIT=$resolvedGitCommit"
Write-Output "TRUSTED_LOCAL_OPERATOR=true"
Write-Output "RENDER_CAPTURE_ORIGIN=http://localhost:$Port"
Write-Output "PERSISTENCE_DIR_CONFIGURED=$([bool](Test-Path -LiteralPath $PersistenceDir))"
Write-Output "RUNTIME3001_BEFORE=$current3001"
Write-Output "RUNTIME3001_AFTER=$post3001"

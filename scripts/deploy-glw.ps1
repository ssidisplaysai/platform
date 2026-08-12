param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$PublicBaseUrl = "https://app.ssiai.app"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-Step([string]$message) {
  Write-Host "[deploy] $message"
}

function Load-DotEnv([string]$path) {
  if (-not (Test-Path $path)) {
    return
  }

  Get-Content $path | ForEach-Object {
    if ($_ -match '^[A-Za-z_][A-Za-z0-9_]*=') {
      $parts = $_ -split '=', 2
      $name = $parts[0]
      $value = $parts[1].Trim()
      if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      Set-Item -Path ("Env:" + $name) -Value $value
    }
  }
}

function Get-ListenerInfo() {
  return Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Get-BuildId() {
  $path = Join-Path $repoRoot ".next/BUILD_ID"
  if (-not (Test-Path $path)) {
    return "unknown"
  }

  $value = (Get-Content -Path $path -TotalCount 1).Trim()
  if ([string]::IsNullOrWhiteSpace($value)) {
    return "unknown"
  }

  return $value
}

function Wait-ForCondition([scriptblock]$Condition, [int]$TimeoutSeconds, [string]$FailureMessage) {
  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds) {
    if (& $Condition) {
      return
    }
    Start-Sleep -Seconds 1
  }

  throw $FailureMessage
}

$startedAt = Get-Date
$oldBuildId = "unknown"
$newBuildId = "unknown"
$oldPid = $null
$newPid = $null
$healthStatus = "UNKNOWN"
$cloudflareStatus = "UNKNOWN"
$runtimeVersion = $null
$qaVersion = $null
$callbackVersion = $null
$deploymentStatus = "FAIL"
$failureMessage = ""

try {
  Load-DotEnv (Join-Path $repoRoot ".env")

  Write-Step "Step 1: Discover current runtime and attempt graceful stop"
  $oldBuildId = Get-BuildId
  $listener = Get-ListenerInfo
  if ($listener) {
    $oldPid = $listener.OwningProcess
    Stop-Process -Id $oldPid -ErrorAction Stop
    Wait-ForCondition { -not (Get-Process -Id $oldPid -ErrorAction SilentlyContinue) } 45 "Runtime process $oldPid did not exit."
  }

  Write-Step "Step 2: Verify process is exited"
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    throw "Runtime process $oldPid is still running after stop request."
  }

  Write-Step "Step 3: Verify port 3001 is released"
  Wait-ForCondition { -not (Get-ListenerInfo) } 30 "Port 3001 was not released."

  Write-Step "Step 4: Build production"
  npm run build | Out-Host

  Write-Step "Step 5: Start production runtime"
  $nextBin = Join-Path $repoRoot "node_modules/next/dist/bin/next"
  if (-not (Test-Path $nextBin)) {
    throw "Next runtime binary was not found at $nextBin"
  }

  $startProcess = Start-Process -FilePath "node" -ArgumentList @($nextBin, "start", "--hostname", "0.0.0.0", "--port", "3001") -WorkingDirectory $repoRoot -PassThru
  Wait-ForCondition { Get-ListenerInfo } 90 "Runtime did not bind to port 3001 after start."

  $listener = Get-ListenerInfo
  $newPid = $listener.OwningProcess
  if (-not $newPid) {
    throw "Failed to detect new runtime PID."
  }

  Write-Step "Step 6: Verify BUILD_ID changed"
  $newBuildId = Get-BuildId
  if ($oldBuildId -eq "unknown") {
    throw "Old BUILD_ID was unknown; cannot verify deployment determinism."
  }
  if ($newBuildId -eq "unknown") {
    throw "New BUILD_ID was unknown after build/start."
  }
  if ($newBuildId -eq $oldBuildId) {
    throw "BUILD_ID did not change after deployment (old=$oldBuildId new=$newBuildId)."
  }

  Write-Step "Step 7: Verify health endpoint"
  $healthResponse = Invoke-RestMethod -Uri ("$BaseUrl/api/glw/health") -Method Get -ErrorAction Stop
  $healthStatus = "PASS"

  Write-Step "Step 8: Verify callback endpoint"
  try {
    Invoke-WebRequest -Uri ("$BaseUrl/api/glw/jobs/callback") -Method Post -ContentType "application/json" -Body "{}" -ErrorAction Stop | Out-Null
    throw "Callback endpoint accepted unauthenticated payload."
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -ne 401) {
      throw "Callback endpoint expected 401 but received $statusCode"
    }
  }

  Write-Step "Step 9: Verify QA contract version"
  $versionResponse = Invoke-RestMethod -Uri ("$BaseUrl/api/glw/version") -Method Get -ErrorAction Stop
  $runtimeVersion = $versionResponse.build_id
  $qaVersion = [int]$versionResponse.qa_contract_version
  $callbackVersion = [int]$versionResponse.callback_contract_version

  if ($qaVersion -ne 16) {
    throw "Runtime qa_contract_version must be 16 but was $qaVersion"
  }
  if ($callbackVersion -ne 16) {
    throw "Runtime callback_contract_version must be 16 but was $callbackVersion"
  }

  Write-Step "Step 10: Verify Cloudflare health"
  $publicHealthResponse = Invoke-RestMethod -Uri ("$PublicBaseUrl/api/glw/health") -Method Get -ErrorAction Stop
  if (-not $publicHealthResponse) {
    throw "Cloudflare health probe returned empty payload."
  }
  $cloudflareStatus = "PASS"

  $deploymentStatus = "PASS"
} catch {
  $deploymentStatus = "FAIL"
  $failureMessage = $_.Exception.Message
  Write-Error $failureMessage
} finally {
  $endedAt = Get-Date
  $durationSeconds = [Math]::Round((New-TimeSpan -Start $startedAt -End $endedAt).TotalSeconds, 2)

  $report = @"
# DeploymentReport

- status: $deploymentStatus
- started_at: $($startedAt.ToString("o"))
- completed_at: $($endedAt.ToString("o"))
- deployment_duration_seconds: $durationSeconds
- old_BUILD_ID: $oldBuildId
- new_BUILD_ID: $newBuildId
- old_PID: $oldPid
- new_PID: $newPid
- runtime_version: $runtimeVersion
- qa_version: $qaVersion
- callback_version: $callbackVersion
- health: $healthStatus
- cloudflare: $cloudflareStatus
- failure_message: $failureMessage
"@

  Set-Content -Path (Join-Path $repoRoot "DeploymentReport.md") -Value $report
  Write-Step "Deployment report written to DeploymentReport.md"
}

if ($deploymentStatus -ne "PASS") {
  throw "Deployment failed. See DeploymentReport.md"
}

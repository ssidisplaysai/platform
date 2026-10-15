[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,
  [Parameter(Mandatory = $true)]
  [string]$RunId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runIdPattern = "^s2g-dbdiag-[a-z0-9-]{3,55}$"

function Fail([string]$Code, [string]$Message) {
  throw "$Code $Message"
}

function Assert-True([bool]$Condition, [string]$Code, [string]$Message) {
  if (-not $Condition) {
    Fail $Code $Message
  }
}

try {
  Assert-True ($RunId -match $runIdPattern) "INVOKE_BODY_RUN_ID_INVALID" "RunId must match $runIdPattern."

  $payload = [ordered]@{
    runId = $RunId
  }
  $json = ConvertTo-Json -InputObject $payload -Compress

  $outputDirectory = [System.IO.Path]::GetDirectoryName($OutputPath)
  if ($outputDirectory -and -not [System.IO.Directory]::Exists($outputDirectory)) {
    [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($OutputPath, $json, $utf8NoBom)

  $bytes = [System.IO.File]::ReadAllBytes($OutputPath)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Fail "INVOKE_BODY_HAS_BOM" "Invocation request body must not have a UTF-8 BOM."
  }

  $jsonText = [System.Text.Encoding]::UTF8.GetString($bytes)
  $parsed = ConvertFrom-Json -InputObject $jsonText
  $keys = @($parsed.PSObject.Properties.Name)
  Assert-True ($keys.Count -eq 1 -and $keys[0] -eq "runId") "INVOKE_BODY_SCHEMA_INVALID" "Invocation request body must contain only runId."
  Assert-True ([string]$parsed.runId -eq $RunId) "INVOKE_BODY_RUN_ID_MISMATCH" "runId in output does not match input RunId."

  $result = [ordered]@{
    outputPath = (Resolve-Path -LiteralPath $OutputPath).Path
    outputHasUtf8Bom = $false
    runId = [string]$parsed.runId
    payloadOnlyRunId = $true
    outputByteLength = $bytes.Length
  }
  $result | ConvertTo-Json -Depth 10
} catch {
  Write-Error $_.Exception.Message
  exit 1
}

param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$PublicBaseUrl = "https://app.ssiai.app",
  [string]$WorkflowId = "bIDXxyWnY22G8zJC",
  [int]$DallasPageId = 18846,
  [bool]$RecoverQueue = $true
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-Step([string]$message) {
  Write-Host "[certify] $message"
}

function To-PassFail([bool]$value) {
  if ($value) { return "PASS" }
  return "FAIL"
}

function Write-ListSection([string]$title, [string[]]$lines) {
  $output = @("## $title")
  $output += $lines
  $output += ""
  return $output
}

Write-Step "Collecting certification telemetry"
$json = npx tsx scripts/glw-certify-data.mts --base-url=$BaseUrl --public-base-url=$PublicBaseUrl --workflow-id=$WorkflowId --dallas-page-id=$DallasPageId --recover-queue=$RecoverQueue
$data = $json | ConvertFrom-Json
Set-Content -Path (Join-Path $repoRoot "Genesis-Platform-v1.2-Certification-Telemetry.json") -Value $json

$runtimeVersion = $data.runtime.version
$runtimeQaVersion = [int]$runtimeVersion.qa_contract_version
$runtimeCallbackVersion = [int]$runtimeVersion.callback_contract_version
$runtimeBuildId = [string]$runtimeVersion.build_id

$workflowStatus = [string]$data.workflow.status
$workflowPass = $workflowStatus -eq "PASS"
$workflowFoundCount = @($data.workflow.foundKeys).Count

$persistedDallasQaCount = [int]$data.dallas.qaCheckCount
$dallasPageStatus = [int]$data.dallas.pageProbe.status
$dallasH1Count = [int]$data.dallas.pageProbe.h1Count
$dallasDuplicateHeadings = [int]$data.dallas.pageProbe.duplicateSectionHeadings
$dallasPlaceholderLinks = [int]$data.dallas.pageProbe.placeholderResourceLabelCount
$dallasDuplicateParagraphs = [int]$data.dallas.pageProbe.duplicateParagraphCount
$dallasWordCount = [int]$data.dallas.pageProbe.bodyWordCount

$queueStartingAfter = [int]$data.queue.after.summary.totalStartingJobs
$queueRecoverableAfter = [int]$data.queue.after.summary.recoverable

$infrastructurePass = [bool]$data.infrastructure.databaseConnected -and [bool]$data.infrastructure.runtimeReachable
$cloudflarePass = [int]$data.cloudflare.publicHealthStatus -eq 200
$runtimePass = [int]$data.runtime.healthStatus -eq 200 -and [int]$data.runtime.versionStatus -eq 200 -and -not [string]::IsNullOrWhiteSpace($runtimeBuildId) -and $runtimeBuildId -ne "unknown"
$queuePass = $queueStartingAfter -eq 0 -and $queueRecoverableAfter -eq 0
$plannerPass = -not [string]::IsNullOrWhiteSpace([string]$runtimeVersion.planner_version)
$publishingPass = -not [string]::IsNullOrWhiteSpace([string]$runtimeVersion.publishing_engine_version)
$recoveryPass = $queuePass
$callbackPass = [int]$data.runtime.callbackUnauthorizedStatus -eq 401
$qaContractPass = $runtimeQaVersion -eq 16 -and $runtimeCallbackVersion -eq 16 -and $workflowPass -and $workflowFoundCount -eq 16
$persistencePass = $persistedDallasQaCount -eq 16
$wordpressPass = $dallasPageStatus -eq 200
$duplicateDetectionPass = $dallasDuplicateHeadings -eq 0 -and $dallasDuplicateParagraphs -eq 0
$headingValidationPass = $dallasH1Count -eq 1
$contentValidationPass = $dallasPlaceholderLinks -eq 0 -and $dallasWordCount -ge 1000
$dallasValidationPass = $wordpressPass -and $headingValidationPass -and $duplicateDetectionPass -and $contentValidationPass -and $persistencePass
$versionSyncPass = $runtimeQaVersion -eq 16 -and $runtimeCallbackVersion -eq 16 -and $workflowPass -and $persistedDallasQaCount -eq 16
$deploymentPass = $false
$deploymentReportPath = Join-Path $repoRoot "DeploymentReport.md"
if (Test-Path $deploymentReportPath) {
  $deploymentReport = Get-Content -Path $deploymentReportPath -Raw
  $deploymentPass = $deploymentReport -match "(?m)^- status:\s*PASS\s*$"
}

$allPass = @(
  $infrastructurePass,
  $cloudflarePass,
  $runtimePass,
  $queuePass,
  $plannerPass,
  $publishingPass,
  $recoveryPass,
  $callbackPass,
  $qaContractPass,
  $persistencePass,
  $wordpressPass,
  $dallasValidationPass,
  $versionSyncPass,
  $deploymentPass
) -notcontains $false

Write-Step "Writing QueueCleanlinessReport.md"
$queueReportLines = @(
  "# QueueCleanlinessReport",
  "",
  "- generated_at: $($data.generatedAt)",
  "- before_total_starting: $($data.queue.before.summary.totalStartingJobs)",
  "- before_recoverable: $($data.queue.before.summary.recoverable)",
  "- after_total_starting: $($data.queue.after.summary.totalStartingJobs)",
  "- after_recoverable: $($data.queue.after.summary.recoverable)",
  "- queue_status: $(To-PassFail $queuePass)",
  ""
)
Set-Content -Path (Join-Path $repoRoot "QueueCleanlinessReport.md") -Value ($queueReportLines -join "`n")

Write-Step "Writing Genesis Platform v1.2 Certification Report"
$reportLines = @(
  "# Genesis Platform v1.2 Certification Report",
  "",
  "- generated_at: $($data.generatedAt)",
  "- runtime_build_id: $runtimeBuildId",
  "- runtime_qa_contract_version: $runtimeQaVersion",
  "- runtime_callback_contract_version: $runtimeCallbackVersion",
  "- workflow_qa_keys_found: $workflowFoundCount",
  "- dallas_page_id: $DallasPageId",
  "- dallas_persisted_qa_checks: $persistedDallasQaCount",
  "",
  "## Category Results",
  "- Infrastructure: $(To-PassFail $infrastructurePass)",
  "- Cloudflare: $(To-PassFail $cloudflarePass)",
  "- Runtime: $(To-PassFail $runtimePass)",
  "- Queue: $(To-PassFail $queuePass)",
  "- Publishing: $(To-PassFail $publishingPass)",
  "- Planner: $(To-PassFail $plannerPass)",
  "- Recovery: $(To-PassFail $recoveryPass)",
  "- Callback: $(To-PassFail $callbackPass)",
  "- QA: $(To-PassFail $qaContractPass)",
  "- Persistence: $(To-PassFail $persistencePass)",
  "- WordPress: $(To-PassFail $wordpressPass)",
  "- Dallas Validation: $(To-PassFail $dallasValidationPass)",
  "- Version Synchronization: $(To-PassFail $versionSyncPass)",
  "- Deployment: $(To-PassFail $deploymentPass)",
  "",
  "## Final Summary",
  "- Deployment: $(To-PassFail $deploymentPass)",
  "- Version Synchronization: $(To-PassFail $versionSyncPass)",
  "- QA Contract: $runtimeQaVersion / $(To-PassFail ($runtimeQaVersion -eq 16))",
  "- Callback Persistence: $(To-PassFail $persistencePass)",
  "- Dallas Validation: $(To-PassFail $dallasValidationPass)",
  "- Queue: $(To-PassFail $queuePass)",
  "- Infrastructure: $(To-PassFail $infrastructurePass)",
  "",
  "- Certification: $(if ($allPass) { 'GENESIS PLATFORM v1.2 CERTIFIED' } else { 'NOT CERTIFIED' })"
)
Set-Content -Path (Join-Path $repoRoot "Genesis-Platform-v1.2-Certification-Report.md") -Value ($reportLines -join "`n")

if ($allPass) {
  Write-Step "All categories passed, writing certification/baseline artifacts"

  $certifiedLines = @(
    "# Genesis-Platform-v1.2-CERTIFIED",
    "",
    "Genesis Platform v1.2 is certified for controlled rollout.",
    "",
    "- certified_at: $(Get-Date -Format o)",
    "- qa_contract_version: $runtimeQaVersion",
    "- callback_contract_version: $runtimeCallbackVersion",
    "- runtime_build_id: $runtimeBuildId"
  )
  Set-Content -Path (Join-Path $repoRoot "Genesis-Platform-v1.2-CERTIFIED.md") -Value ($certifiedLines -join "`n")

  $baselineLines = @(
    "# Genesis-v1.2-Operations-Baseline",
    "",
    "- generated_at: $(Get-Date -Format o)",
    "- runtime_build_id: $runtimeBuildId",
    "- qa_contract_version: $runtimeQaVersion",
    "- callback_contract_version: $runtimeCallbackVersion",
    "- queue_starting_jobs: $queueStartingAfter",
    "- dallas_persisted_qa_checks: $persistedDallasQaCount"
  )
  Set-Content -Path (Join-Path $repoRoot "Genesis-v1.2-Operations-Baseline.md") -Value ($baselineLines -join "`n")

  if (-not (git tag --list genesis-platform-v1.2)) {
    git tag genesis-platform-v1.2
  }
}

if (-not $allPass) {
  throw "Genesis Platform v1.2 certification failed. See Genesis-Platform-v1.2-Certification-Report.md"
}

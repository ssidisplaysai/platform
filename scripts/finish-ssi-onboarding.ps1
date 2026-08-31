param(
    [string]$SourceWorktree = "",
    [string]$JobId = "13ae4e9e-e305-4c6b-b3d0-0da7905fa745",
    [int]$Port = 3002
)

$ErrorActionPreference = "Stop"

if (-not $SourceWorktree) {
    $SourceWorktree = (Get-Location).Path
}

$SourceWorktree = (Resolve-Path -LiteralPath $SourceWorktree).Path
$worktreesRoot = Split-Path -Parent $SourceWorktree
$target = Join-Path $worktreesRoot "glw-site-media-pipeline-run"
$branch = "origin/feature/glw-site-media-pipeline"

Write-Host "=== SSI ONBOARDING AUTOMATED FINISH ==="
Write-Host "SOURCE=$SourceWorktree"
Write-Host "TARGET=$target"
Write-Host "JOB_ID=$JobId"
Write-Host "PORT=$Port"

Write-Host "`n=== FETCH IMPLEMENTATION ==="
git -C $SourceWorktree fetch origin feature/glw-site-media-pipeline
if ($LASTEXITCODE -ne 0) { throw "FETCH_FAILED" }

if (Test-Path -LiteralPath $target) {
    Write-Host "Removing prior automation worktree..."
    git -C $SourceWorktree worktree remove --force $target 2>$null
    Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n=== CREATE CLEAN AUTOMATION WORKTREE ==="
git -C $SourceWorktree worktree add --force $target $branch
if ($LASTEXITCODE -ne 0) { throw "WORKTREE_CREATE_FAILED" }

$sourceEnv = Join-Path $SourceWorktree ".env.local"
$targetEnv = Join-Path $target ".env.local"
if (Test-Path -LiteralPath $sourceEnv) {
    Copy-Item -LiteralPath $sourceEnv -Destination $targetEnv -Force
    Write-Host "ENV_LOCAL=COPIED"
}

$sourcePersistence = Join-Path $SourceWorktree ".gcp-foundation-data"
if (Test-Path -LiteralPath $sourcePersistence) {
    $env:GCP_FOUNDATION_PERSISTENCE_DIR = $sourcePersistence
    Write-Host "PERSISTENCE=$sourcePersistence"
}

Write-Host "`n=== INSTALL ISOLATED DEPENDENCIES ==="
Push-Location $target
try {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "NPM_CI_FAILED" }
}
finally {
    Pop-Location
}

Write-Host "`n=== ONE-COMMAND CERTIFICATION ==="
Push-Location $target
try {
    npm run certify:glw
    if ($LASTEXITCODE -ne 0) { throw "GLW_CERTIFICATION_FAILED" }
}
finally {
    Pop-Location
}

Write-Host "`n=== START ISOLATED CERTIFIED RUNTIME ==="
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $existing | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

$stdout = Join-Path $target "ssi-onboarding.stdout.log"
$stderr = Join-Path $target "ssi-onboarding.stderr.log"
$launcher = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev -- -p $Port > `"$stdout`" 2> `"$stderr`"" `
    -WorkingDirectory $target `
    -PassThru

Write-Host "LAUNCHER_PID=$($launcher.Id)"

$listener = $null
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) { break }
}

if (-not $listener) {
    Get-Content $stderr -Tail 80 -ErrorAction SilentlyContinue
    throw "CERTIFIED_RUNTIME_START_FAILED"
}

Write-Host "RUNTIME_READY=True"
Write-Host "RUNTIME_PID=$($listener.OwningProcess)"

$headers = @{
    "x-gcp-roles" = "platform_admin"
    "x-gcp-organization-id" = "ssi"
}

Write-Host "`n=== REPAIR SSI FEATURED IMAGE ==="
$repairUri = "http://localhost:$Port/api/glw/page-generation/media"
$repairBody = @{ jobId = $JobId } | ConvertTo-Json -Compress

try {
    $repair = Invoke-RestMethod `
        -Method POST `
        -Uri $repairUri `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $repairBody
}
catch {
    Write-Host "SSI_MEDIA_REPAIR_FAILED"
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    Get-Content $stderr -Tail 80 -ErrorAction SilentlyContinue
    throw
}

Write-Host "REPAIRED=$($repair.repaired)"
Write-Host "ALREADY_COMPLETE=$($repair.alreadyComplete)"
Write-Host "MEDIA_ID=$($repair.media.mediaId)"
Write-Host "MEDIA_URL=$($repair.media.mediaUrl)"

Write-Host "`n=== VERIFY SSI JOB ==="
$jobResult = Invoke-RestMethod `
    -Method GET `
    -Uri "http://localhost:$Port/api/glw/page-generation?jobId=$JobId" `
    -Headers $headers

$job = $jobResult.job
Write-Host "STATUS=$($job.status)"
Write-Host "WORDPRESS_ID=$($job.wordpressObjectId)"
Write-Host "WORDPRESS_STATUS=$($job.wordpressStatus)"
Write-Host "FEATURED_IMAGE_PRESENT=$($job.featuredImagePresent)"
Write-Host "WORDPRESS_URL=$($job.wordpressUrl)"

if ($job.status -ne "COMPLETE") { throw "SSI_JOB_NOT_COMPLETE" }
if ($job.wordpressStatus -ne "draft") { throw "SSI_WORDPRESS_NOT_DRAFT" }
if ($job.featuredImagePresent -ne $true) { throw "SSI_FEATURED_IMAGE_NOT_VERIFIED" }

Write-Host "`n=== SSI ONBOARDING RESULT ==="
Write-Host "SSI_ONBOARDING=PASS"
Write-Host "PAGE_STUDIO=http://localhost:$Port/glw/pages"
Write-Host "WORDPRESS_URL=$($job.wordpressUrl)"
Write-Host "MEDIA_URL=$($repair.media.mediaUrl)"
Write-Host "`nCertified runtime remains available on port $Port for onboarding the second site."

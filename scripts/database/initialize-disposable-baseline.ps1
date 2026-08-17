[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Initialize", "Verify", "ResetSynthetic", "DropDatabase")]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedDatabaseName,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedServerSystemIdentifier,

    [Parameter(Mandatory = $true)]
    [string]$ProductionConnectionFingerprint,

    [Parameter(Mandatory = $true)]
    [ValidateSet("NO")]
    [string]$ProductionClassification,

    [Parameter(Mandatory = $true)]
    [ValidateSet("YES")]
    [string]$DisposableClassification,

    [Parameter(Mandatory = $true)]
    [ValidateSet("HR004_SLICE_B_TEST_ONLY")]
    [string]$EnvironmentClass,

    [Parameter(Mandatory = $true)]
    [switch]$ConfirmDisposable,

    [string]$ManifestPath,
    [string]$PsqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    [string]$DropDbPath = "C:\Program Files\PostgreSQL\16\bin\dropdb.exe",
    [string]$PrismaPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-Sha256([string]$Path) {
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToUpperInvariant()
}

function Get-TextSha256([string]$Value) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    return (-join ($hash | ForEach-Object { $_.ToString("x2") })).ToUpperInvariant()
}

function ConvertTo-PsqlUrl([string]$Value) {
    return ($Value -split "\?", 2)[0]
}

function Invoke-PsqlScalar([string]$Sql, [string]$Url = $script:PsqlUrl) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = $Sql | & $PsqlPath -w --dbname=$Url -v ON_ERROR_STOP=1 -Atq -f - 2>&1
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL command failed without exposing connection credentials: $($output -join ' ')"
    }
    return (($output | Where-Object { $_ -is [string] } | Select-Object -Last 1) -as [string]).Trim()
}

function Assert-TargetIdentity {
    if (-not $ConfirmDisposable) {
        throw "Explicit disposable confirmation is required."
    }
    if (-not (Test-Path -LiteralPath $PsqlPath)) {
        throw "psql is unavailable at the approved path."
    }

    $uri = [Uri]$DatabaseUrl
    $hostName = $uri.Host.ToLowerInvariant()
    $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    $databaseName = $uri.AbsolutePath.TrimStart("/")

    if ($hostName -notin @("127.0.0.1", "localhost")) {
        throw "Disposable authority must be loopback-only."
    }
    if ($port -eq 5432) {
        throw "The shared local PostgreSQL service port is forbidden."
    }
    if ($databaseName -ne $ExpectedDatabaseName) {
        throw "Connected database name does not match the explicit expected identity."
    }
    if ($databaseName -notmatch "^genesis_hr004_[a-z0-9_]+$") {
        throw "Database name does not match the certified HR-004 disposable pattern."
    }

    $targetFingerprint = Get-TextSha256 $script:PsqlUrl
    if ($targetFingerprint -eq $ProductionConnectionFingerprint.ToUpperInvariant()) {
        throw "Disposable connection fingerprint matches production."
    }

    $identity = Invoke-PsqlScalar @"
SELECT current_database() || '|' ||
       (SELECT system_identifier FROM pg_control_system()) || '|' ||
       COALESCE(shobj_description(oid, 'pg_database'), '')
FROM pg_database
WHERE datname = current_database()
"@
    $parts = $identity.Split("|", 3)
    if ($parts.Count -ne 3 -or $parts[0] -ne $ExpectedDatabaseName) {
        throw "PostgreSQL current database identity mismatch."
    }
    if ($parts[1] -ne $ExpectedServerSystemIdentifier) {
        throw "PostgreSQL server system identity mismatch."
    }
    $expectedMarker = "NON_PRODUCTION DISPOSABLE $EnvironmentClass"
    if (-not $parts[2].StartsWith($expectedMarker, [StringComparison]::Ordinal)) {
        throw "Database lacks the certified non-production disposable marker."
    }
}

function Assert-Manifest {
    if (-not (Test-Path -LiteralPath $ManifestPath)) {
        throw "Baseline manifest is missing."
    }
    $script:Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $manifestDirectory = Split-Path -Parent $ManifestPath
    $repoRoot = (Resolve-Path (Join-Path $manifestDirectory "..\..\..")).Path
    $script:RepoRoot = $repoRoot
    $script:BaselinePath = Join-Path $repoRoot $Manifest.baseline.path
    $schemaPath = Join-Path $repoRoot $Manifest.source.prismaSchemaPath

    if ((Get-Sha256 $BaselinePath) -ne $Manifest.baseline.sha256) {
        throw "Baseline SQL hash mismatch."
    }
    if ((Get-Sha256 $schemaPath) -ne $Manifest.source.prismaSchemaSha256) {
        throw "Prisma schema hash mismatch."
    }
    if ($Manifest.includedMigrations.Count -ne $Manifest.includedMigrationCount -or
        $Manifest.includedMigrationCount -ne 33) {
        throw "Migration marker manifest count mismatch."
    }
    foreach ($migration in $Manifest.includedMigrations) {
        $migrationPath = Join-Path $repoRoot "prisma\migrations\$($migration.name)\migration.sql"
        if (-not (Test-Path -LiteralPath $migrationPath) -or
            (Get-Sha256 $migrationPath) -ne $migration.sha256) {
            throw "Migration hash mismatch: $($migration.name)"
        }
    }
    if ($Manifest.includedMigrations[-1].name -ne $Manifest.migrationCutoff) {
        throw "Migration cutoff does not match the final included marker."
    }
}

function Assert-EmptyDatabase {
    $tableCount = [int](Invoke-PsqlScalar "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
    if ($tableCount -ne 0) {
        throw "Initialize requires an empty public schema."
    }
    $migrationTable = Invoke-PsqlScalar "SELECT COALESCE(to_regclass('public._prisma_migrations')::text, '')"
    if ($migrationTable) {
        throw "Initialize refuses a database with an existing migration ledger."
    }
}

function Assert-DataFree([switch]$AllowMigrationMarkers) {
    $exclude = if ($AllowMigrationMarkers) { "AND tablename <> '_prisma_migrations'" } else { "" }
    $sql = @"
DO `$baseline_data_free`$
DECLARE item record; row_count bigint;
BEGIN
  FOR item IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' $exclude LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', item.schemaname, item.tablename) INTO row_count;
    IF row_count <> 0 THEN
      RAISE EXCEPTION 'Non-empty baseline table: %', item.tablename;
    END IF;
  END LOOP;
END
`$baseline_data_free`$;
SELECT 'PASS';
"@
    if ((Invoke-PsqlScalar $sql) -ne "PASS") {
        throw "Data-free verification failed."
    }
}

function Assert-Authorities {
    $receiptTableCount = [int](Invoke-PsqlScalar @"
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'GlwCallbackReceipt'
"@)
    $authorityIndexCount = [int](Invoke-PsqlScalar @"
SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
    'GlwCallbackReceipt_idempotencyKey_key',
    'GlwCallbackReceipt_terminalScopeKey_key',
    'GopJobEvent_idempotencyKey_idx',
    'GopJobEvent_jobId_idempotencyKey_unique_when_not_null'
  )
"@)
    if ($receiptTableCount -ne 1 -or $authorityIndexCount -ne 4) {
        throw "Required Slice A database authorities are incomplete."
    }
    $legacyDefinition = Invoke-PsqlScalar @"
SELECT indexdef FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'GopJobEvent_jobId_idempotencyKey_unique_when_not_null'
"@
    if ($legacyDefinition -notmatch "CREATE UNIQUE INDEX" -or
        $legacyDefinition -notmatch 'WHERE \("idempotencyKey" IS NOT NULL\)') {
        throw "Legacy partial unique authority differs from the manifest contract."
    }
    $redundantCount = [int](Invoke-PsqlScalar @"
SELECT count(*) FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'GopJobEvent'
  AND indexdef LIKE '%UNIQUE INDEX%'
  AND indexdef LIKE '%"jobId", "idempotencyKey"%'
  AND indexname <> 'GopJobEvent_jobId_idempotencyKey_unique_when_not_null'
"@)
    if ($redundantCount -ne 0) {
        throw "Unexpected redundant GOP event uniqueness authority."
    }
}

function Invoke-DriftCheck {
    $previousUrl = $env:DATABASE_URL
    try {
        $env:DATABASE_URL = $DatabaseUrl
        Push-Location $RepoRoot
        & $PrismaPath migrate diff --from-config-datasource --to-schema (Join-Path $RepoRoot $Manifest.source.prismaSchemaPath) --exit-code | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Prisma schema drift detected."
        }
    } finally {
        if ((Get-Location).Path -eq $RepoRoot) { Pop-Location }
        if ($null -eq $previousUrl) { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
        else { $env:DATABASE_URL = $previousUrl }
    }
}

function Assert-MigrationLedger {
    $markerCount = [int](Invoke-PsqlScalar "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")
    if ($markerCount -ne $Manifest.includedMigrationCount) {
        throw "Migration marker count mismatch."
    }
    $actualNames = @(Invoke-PsqlScalar "SELECT string_agg(migration_name, ',' ORDER BY migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL") -split ","
    $expectedNames = @($Manifest.includedMigrations.name | Sort-Object)
    if (($actualNames -join "|") -ne ($expectedNames -join "|")) {
        throw "Migration marker names differ from the manifest."
    }
}

function Initialize-Baseline {
    Assert-EmptyDatabase
    Assert-DataFree
    & $PsqlPath -w --dbname=$PsqlUrl -v ON_ERROR_STOP=1 -f $BaselinePath | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Baseline SQL application failed." }
    Assert-DataFree
    Invoke-DriftCheck

    $previousUrl = $env:DATABASE_URL
    try {
        $env:DATABASE_URL = $DatabaseUrl
        Push-Location $RepoRoot
        foreach ($migration in $Manifest.includedMigrations) {
            & $PrismaPath migrate resolve --applied $migration.name --schema (Join-Path $RepoRoot $Manifest.source.prismaSchemaPath) | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Migration marker creation failed: $($migration.name)" }
        }
        & $PrismaPath migrate deploy --schema (Join-Path $RepoRoot $Manifest.source.prismaSchemaPath) | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "Post-baseline migrate deploy failed." }
    } finally {
        if ((Get-Location).Path -eq $RepoRoot) { Pop-Location }
        if ($null -eq $previousUrl) { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
        else { $env:DATABASE_URL = $previousUrl }
    }
    Assert-MigrationLedger
    Assert-Authorities
    Assert-DataFree -AllowMigrationMarkers
    Invoke-DriftCheck
}

function Verify-Baseline {
    Assert-MigrationLedger
    Assert-Authorities
    Invoke-DriftCheck
}

function Reset-SyntheticData {
    $sql = @"
DO `$reset_synthetic`$
BEGIN
  IF current_database() <> '$ExpectedDatabaseName' THEN
    RAISE EXCEPTION 'Disposable database identity changed before reset';
  END IF;
  DELETE FROM "GopExecutionSnapshot" WHERE "executionId" IN (
    SELECT "executionId" FROM "GopExecution" WHERE "jobId" LIKE 'test_hr004_%'
  );
  DELETE FROM "GopJobEvent" WHERE "jobId" LIKE 'test_hr004_%';
  DELETE FROM "GopExecution" WHERE "jobId" LIKE 'test_hr004_%';
  DELETE FROM "GlwCallbackReceipt" WHERE "jobId" LIKE 'test_hr004_%';
  DELETE FROM "GlwJob" WHERE "id" LIKE 'test_hr004_%';
END
`$reset_synthetic`$;
SELECT 'PASS';
"@
    if ((Invoke-PsqlScalar $sql) -ne "PASS") { throw "Synthetic reset failed." }
    Assert-MigrationLedger
    Assert-Authorities
}

function Drop-DisposableDatabase {
    if (-not (Test-Path -LiteralPath $DropDbPath)) {
        throw "dropdb is unavailable at the approved path."
    }
    $uri = [Uri]$PsqlUrl
    $adminUrl = "postgresql://$($uri.UserInfo)@$($uri.Host):$($uri.Port)/postgres"
    & $DropDbPath -w --force --maintenance-db=$adminUrl $ExpectedDatabaseName | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Disposable database drop failed." }
}

$script:PsqlUrl = ConvertTo-PsqlUrl $DatabaseUrl
if (-not $ManifestPath) {
    $repoRootFromScript = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
    $ManifestPath = Join-Path $repoRootFromScript "prisma\baselines\genesis-1.1.1-hr004-slice-a-e4231a8\manifest.json"
}
if (-not $PrismaPath) {
    $repoRootFromScript = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
    $PrismaPath = Join-Path $repoRootFromScript "node_modules\.bin\prisma.cmd"
}

Assert-Manifest
Assert-TargetIdentity

switch ($Action) {
    "Initialize" { Initialize-Baseline }
    "Verify" { Verify-Baseline }
    "ResetSynthetic" { Reset-SyntheticData }
    "DropDatabase" { Drop-DisposableDatabase }
}

[pscustomobject]@{
    action = $Action
    baselineId = $Manifest.baselineId
    databaseName = $ExpectedDatabaseName
    environmentClass = $EnvironmentClass
    productionClassification = $ProductionClassification
    disposableClassification = $DisposableClassification
    rawCredentialsPrinted = $false
    result = "PASS"
} | ConvertTo-Json -Compress
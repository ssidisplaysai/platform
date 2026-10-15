[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TemplatePath,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,
  [Parameter(Mandatory = $true)]
  [string]$RunId,
  [Parameter(Mandatory = $true)]
  [string]$AuthorizedOperatorArn,
  [Parameter(Mandatory = $true)]
  [string]$AuthorizationCreatorArn,
  [Parameter(Mandatory = $true)]
  [string]$ApprovalReference,
  [long]$CreatedAtEpoch = 0,
  [long]$ExpiresAtEpoch = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$EXPECTED_TABLE_NAME = "genesis-staging-s2g-db-admin-diagnostic-launches"
$EXPECTED_CONDITION_EXPRESSION = "attribute_not_exists(runId)"
$EXPECTED_TASK_DEFINITION_ARN = "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-s2g-db-admin-diagnostic:1"
$EXPECTED_CLUSTER_ARN = "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production"
$EXPECTED_IMAGE_DIGEST = "sha256:4603f32f34be3dcf4c4c80fee1c521d2427fc95b54d6e031fb0fa868143be7b5"
$EXPECTED_NETWORK_IDENTITY = "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production|subnet-0f303dea5f645e42d,subnet-00a0b287895a3b18c|sg-0e9dcd277642bdb63"
$EXPECTED_ACCOUNT_ID = "452630323448"
$EXPECTED_REGION = "us-west-2"
$EXPECTED_SCHEMA_VERSION = "2026-10-13"
$EXPECTED_PURPOSE = "STAGING_DB_ADMIN_READONLY_DIAGNOSTIC"
$EXPECTED_MAX_LAUNCH_ATTEMPTS = 1
$ownerApprovalReferencePattern = "^OWNER_APPROVAL:[A-Za-z0-9][A-Za-z0-9:_-]{5,}$"
$synthesizedOwnerApprovalPattern = "^OWNER_APPROVAL:OWNER_APPROVAL-"

$runIdPattern = "^s2g-dbdiag-[a-z0-9-]{3,55}$"
$stsAssumedRolePattern = "^arn:aws:sts::\d{12}:assumed-role\/[^\/]+\/[^\/]+$"
$placeholderPattern = "<<.+>>"

function Fail([string]$Code, [string]$Message) {
  throw "$Code $Message"
}

function Assert-True([bool]$Condition, [string]$Code, [string]$Message) {
  if (-not $Condition) {
    Fail $Code $Message
  }
}

function Get-ObjectProperty([object]$Object, [string]$Name, [string]$Code, [string]$Message) {
  $prop = $Object.PSObject.Properties[$Name]
  if (-not $prop) {
    Fail $Code $Message
  }
  return $prop.Value
}

function Read-JsonObject([string]$Path) {
  Assert-True ([System.IO.File]::Exists($Path)) "PREP_TEMPLATE_NOT_FOUND" "Template path not found: $Path"
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $hasUtf8Bom = $false
  if ($bytes.Length -ge 3) {
    $hasUtf8Bom = ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  }
  $jsonText = [System.Text.Encoding]::UTF8.GetString($bytes)
  if ($jsonText.Length -gt 0 -and [int][char]$jsonText[0] -eq 0xFEFF) {
    $jsonText = $jsonText.Substring(1)
  }
  try {
    return @{
      Object = ConvertFrom-Json -InputObject $jsonText
      HadUtf8Bom = $hasUtf8Bom
    }
  } catch {
    Fail "PREP_TEMPLATE_INVALID_JSON" "Template JSON parse failed: $($_.Exception.Message)"
  }
}

function Get-AttrValue([object]$Item, [string]$Key) {
  $prop = $Item.PSObject.Properties[$Key]
  if (-not $prop) {
    Fail "PREP_REQUIRED_ATTRIBUTE_MISSING" "Missing required Item.$Key attribute."
  }
  return $prop.Value
}

function Get-StringAttribute([object]$Item, [string]$Key) {
  $attr = Get-AttrValue $Item $Key
  $names = @($attr.PSObject.Properties.Name)
  Assert-True ($names.Count -eq 1 -and $names[0] -eq "S") "PREP_ATTRIBUTE_TYPE_INVALID" "Item.$Key must be DynamoDB string attribute {\"S\":\"...\"}."
  Assert-True ([string]::IsNullOrWhiteSpace($attr.S) -eq $false) "PREP_ATTRIBUTE_EMPTY" "Item.$Key must not be empty."
  return [string]$attr.S
}

function Get-NumberAttribute([object]$Item, [string]$Key) {
  $attr = Get-AttrValue $Item $Key
  $names = @($attr.PSObject.Properties.Name)
  Assert-True ($names.Count -eq 1 -and $names[0] -eq "N") "PREP_ATTRIBUTE_TYPE_INVALID" "Item.$Key must be DynamoDB number attribute {\"N\":\"...\"}."
  $text = [string]$attr.N
  Assert-True ($text -match "^-?\d+$") "PREP_ATTRIBUTE_NUMBER_INVALID" "Item.$Key must contain an integer number string."
  return [long]$text
}

function Set-StringAttribute([object]$Item, [string]$Key, [string]$Value) {
  Assert-True ([string]::IsNullOrWhiteSpace($Value) -eq $false) "PREP_ARGUMENT_INVALID" "$Key argument must not be empty."
  $current = Get-AttrValue $Item $Key
  Assert-True ($current.PSObject.Properties.Name -contains "S") "PREP_ATTRIBUTE_TYPE_INVALID" "Item.$Key must be string-typed in template."
  $current.S = $Value
}

function Set-NumberAttribute([object]$Item, [string]$Key, [long]$Value) {
  $current = Get-AttrValue $Item $Key
  Assert-True ($current.PSObject.Properties.Name -contains "N") "PREP_ATTRIBUTE_TYPE_INVALID" "Item.$Key must be number-typed in template."
  $current.N = [string]$Value
}

function Validate-Request([object]$Request, [long]$NowEpoch) {
  Assert-True ($Request -ne $null) "PREP_REQUEST_INVALID" "Request is null."
  $tableName = [string](Get-ObjectProperty -Object $Request -Name "TableName" -Code "PREP_TABLE_NAME_INVALID" -Message "TableName is required.")
  Assert-True ($tableName -eq $EXPECTED_TABLE_NAME) "PREP_TABLE_NAME_INVALID" "TableName must be $EXPECTED_TABLE_NAME."
  $conditionExpression = [string](Get-ObjectProperty -Object $Request -Name "ConditionExpression" -Code "PREP_CONDITION_INVALID" -Message "ConditionExpression is required.")
  Assert-True ($conditionExpression -eq $EXPECTED_CONDITION_EXPRESSION) "PREP_CONDITION_INVALID" "ConditionExpression must be $EXPECTED_CONDITION_EXPRESSION."
  $item = Get-ObjectProperty -Object $Request -Name "Item" -Code "PREP_ITEM_MISSING" -Message "Item object is required."
  Assert-True ($item -ne $null) "PREP_ITEM_MISSING" "Item object is required."

  $requiredAttributes = @(
    "runId",
    "launchState",
    "approvedDiagnosticTaskDefinitionArn",
    "approvedClusterArn",
    "approvedDiagnosticImageDigest",
    "approvedNetworkIdentity",
    "authorizedOperatorArn",
    "authorizationCreatorArn",
    "expectedAccountId",
    "expectedRegion",
    "createdAtEpoch",
    "expiresAtEpoch",
    "purpose",
    "schemaVersion",
    "maxLaunchAttempts",
    "approvalReference"
  )
  foreach ($required in $requiredAttributes) {
    $null = Get-AttrValue $item $required
  }

  $runId = Get-StringAttribute $item "runId"
  Assert-True ($runId -match $runIdPattern) "PREP_RUN_ID_INVALID" "runId must match $runIdPattern."

  $launchState = Get-StringAttribute $item "launchState"
  Assert-True ($launchState -eq "AUTHORIZED") "PREP_LAUNCH_STATE_INVALID" "launchState must be AUTHORIZED."

  $schemaVersion = Get-StringAttribute $item "schemaVersion"
  Assert-True ($schemaVersion -eq $EXPECTED_SCHEMA_VERSION) "PREP_SCHEMA_VERSION_INVALID" "schemaVersion must be $EXPECTED_SCHEMA_VERSION."

  $purpose = Get-StringAttribute $item "purpose"
  Assert-True ($purpose -eq $EXPECTED_PURPOSE) "PREP_PURPOSE_INVALID" "purpose must be $EXPECTED_PURPOSE."

  $maxLaunchAttempts = Get-NumberAttribute $item "maxLaunchAttempts"
  Assert-True ($maxLaunchAttempts -eq $EXPECTED_MAX_LAUNCH_ATTEMPTS) "PREP_MAX_ATTEMPTS_INVALID" "maxLaunchAttempts must be 1."

  $authorizedOperatorArn = Get-StringAttribute $item "authorizedOperatorArn"
  Assert-True ($authorizedOperatorArn -match $stsAssumedRolePattern) "PREP_OPERATOR_ARN_INVALID" "authorizedOperatorArn must be an STS assumed-role ARN."

  $authorizationCreatorArn = Get-StringAttribute $item "authorizationCreatorArn"
  Assert-True ($authorizationCreatorArn -match $stsAssumedRolePattern) "PREP_CREATOR_ARN_INVALID" "authorizationCreatorArn must be an STS assumed-role ARN."

  $approvalReference = Get-StringAttribute $item "approvalReference"
  Assert-True ($approvalReference -notmatch $placeholderPattern) "PREP_APPROVAL_REFERENCE_REQUIRED" "approvalReference must be a fresh independent approval reference."
  Assert-True ($approvalReference -match $ownerApprovalReferencePattern) "PREP_APPROVAL_REFERENCE_INVALID" "approvalReference must match canonical OWNER_APPROVAL:<unique-reference> format."
  Assert-True ($approvalReference -notmatch $synthesizedOwnerApprovalPattern) "PREP_APPROVAL_REFERENCE_SYNTHESIZED" "Synthesized approvalReference values are forbidden."

  $taskArn = Get-StringAttribute $item "approvedDiagnosticTaskDefinitionArn"
  Assert-True ($taskArn -eq $EXPECTED_TASK_DEFINITION_ARN) "PREP_TASK_ARN_INVALID" "approvedDiagnosticTaskDefinitionArn does not match approved value."

  $clusterArn = Get-StringAttribute $item "approvedClusterArn"
  Assert-True ($clusterArn -eq $EXPECTED_CLUSTER_ARN) "PREP_CLUSTER_ARN_INVALID" "approvedClusterArn does not match approved value."

  $imageDigest = Get-StringAttribute $item "approvedDiagnosticImageDigest"
  Assert-True ($imageDigest -eq $EXPECTED_IMAGE_DIGEST) "PREP_IMAGE_DIGEST_INVALID" "approvedDiagnosticImageDigest does not match approved value."

  $networkIdentity = Get-StringAttribute $item "approvedNetworkIdentity"
  Assert-True ($networkIdentity -eq $EXPECTED_NETWORK_IDENTITY) "PREP_NETWORK_IDENTITY_INVALID" "approvedNetworkIdentity does not match approved value."

  $expectedAccountId = Get-StringAttribute $item "expectedAccountId"
  Assert-True ($expectedAccountId -eq $EXPECTED_ACCOUNT_ID) "PREP_ACCOUNT_INVALID" "expectedAccountId must be $EXPECTED_ACCOUNT_ID."

  $expectedRegion = Get-StringAttribute $item "expectedRegion"
  Assert-True ($expectedRegion -eq $EXPECTED_REGION) "PREP_REGION_INVALID" "expectedRegion must be $EXPECTED_REGION."

  $createdAtEpoch = Get-NumberAttribute $item "createdAtEpoch"
  $expiresAtEpoch = Get-NumberAttribute $item "expiresAtEpoch"
  Assert-True ($createdAtEpoch -gt 0) "PREP_CREATED_AT_INVALID" "createdAtEpoch must be > 0."
  Assert-True ($expiresAtEpoch -gt $createdAtEpoch) "PREP_EXPIRY_INVALID" "expiresAtEpoch must be greater than createdAtEpoch."
  Assert-True (($expiresAtEpoch - $createdAtEpoch) -le 300) "PREP_EXPIRY_WINDOW_INVALID" "Authorization expiry window must be <= 300 seconds."
  Assert-True ($expiresAtEpoch -gt $NowEpoch) "PREP_EXPIRED" "Authorization already expired."
}

try {
  $templateResult = Read-JsonObject -Path $TemplatePath
  $request = $templateResult.Object
  $nowEpoch = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

  if ($CreatedAtEpoch -le 0) {
    $CreatedAtEpoch = $nowEpoch
  }
  if ($ExpiresAtEpoch -le 0) {
    $ExpiresAtEpoch = $CreatedAtEpoch + 300
  }

  Set-StringAttribute -Item $request.Item -Key "runId" -Value $RunId
  Set-StringAttribute -Item $request.Item -Key "authorizedOperatorArn" -Value $AuthorizedOperatorArn
  Set-StringAttribute -Item $request.Item -Key "authorizationCreatorArn" -Value $AuthorizationCreatorArn
  Set-StringAttribute -Item $request.Item -Key "approvalReference" -Value $ApprovalReference
  Set-NumberAttribute -Item $request.Item -Key "createdAtEpoch" -Value $CreatedAtEpoch
  Set-NumberAttribute -Item $request.Item -Key "expiresAtEpoch" -Value $ExpiresAtEpoch

  Validate-Request -Request $request -NowEpoch $nowEpoch

  $json = ConvertTo-Json -InputObject $request -Depth 100
  $outputDirectory = [System.IO.Path]::GetDirectoryName($OutputPath)
  if ($outputDirectory -and -not [System.IO.Directory]::Exists($outputDirectory)) {
    [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($OutputPath, $json, $utf8NoBom)

  $writtenBytes = [System.IO.File]::ReadAllBytes($OutputPath)
  if ($writtenBytes.Length -ge 3 -and $writtenBytes[0] -eq 0xEF -and $writtenBytes[1] -eq 0xBB -and $writtenBytes[2] -eq 0xBF) {
    Fail "PREP_OUTPUT_HAS_BOM" "Output file has UTF-8 BOM; refusing unsafe file."
  }

  $writtenText = [System.Text.Encoding]::UTF8.GetString($writtenBytes)
  $null = ConvertFrom-Json -InputObject $writtenText
  Validate-Request -Request $request -NowEpoch $nowEpoch

  $hash = Get-FileHash -Path $OutputPath -Algorithm SHA256
  $result = [ordered]@{
    mode = "offline-prepare-only"
    templatePath = (Resolve-Path -LiteralPath $TemplatePath).Path
    outputPath = (Resolve-Path -LiteralPath $OutputPath).Path
    templateHadUtf8Bom = [bool]$templateResult.HadUtf8Bom
    outputHasUtf8Bom = $false
    outputSha256 = $hash.Hash.ToLowerInvariant()
    tableName = $request.TableName
    conditionExpression = $request.ConditionExpression
    runId = $request.Item.runId.S
    authorizedOperatorArn = $request.Item.authorizedOperatorArn.S
    approvalReference = $request.Item.approvalReference.S
    createdAtEpoch = [long]$request.Item.createdAtEpoch.N
    expiresAtEpoch = [long]$request.Item.expiresAtEpoch.N
    expiryWindowSeconds = ([long]$request.Item.expiresAtEpoch.N - [long]$request.Item.createdAtEpoch.N)
    awsExecutionPermitted = $false
  }
  $result | ConvertTo-Json -Depth 10
} catch {
  Write-Error $_.Exception.Message
  exit 1
}

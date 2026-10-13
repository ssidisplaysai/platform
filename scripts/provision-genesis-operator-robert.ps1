param(
    [System.Security.SecureString]$SecurePassword,
    [ValidateSet("User", "Process")]
    [string]$EnvironmentTarget = "User"
)

$ErrorActionPreference = "Stop"

$principalId = "genesis-operator-robert"
$email = "rk@ssidisplays.com"
$role = "platform_admin"
$securePassword = if ($SecurePassword) { $SecurePassword } else { Read-Host "Set Robert Genesis operator password" -AsSecureString }
$credential = [System.Management.Automation.PSCredential]::new($principalId, $securePassword)
$plainPassword = $credential.GetNetworkCredential().Password

if ($plainPassword.Length -lt 12) {
    Remove-Variable plainPassword, credential, securePassword
    throw "Genesis operator passwords must contain at least 12 characters."
}

$nodeScript = @'
const crypto = require("node:crypto");
let password = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { password += chunk; });
process.stdin.on("end", () => {
  password = password.replace(/\r?\n$/, "");
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  process.stdout.write(`scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`);
  password = "";
});
'@

try {
    $nodeHelperPath = Join-Path ([System.IO.Path]::GetTempPath()) "genesis-scrypt-$([guid]::NewGuid().ToString('N')).cjs"
    [System.IO.File]::WriteAllText($nodeHelperPath, $nodeScript, [System.Text.UTF8Encoding]::new($false))
    $nodeArguments = @($nodeHelperPath)
    $passwordHash = $plainPassword | & node @nodeArguments
    $nodeExitCode = $LASTEXITCODE
    Remove-Variable plainPassword, credential, securePassword
    $passwordHash = ($passwordHash | Out-String).Trim()
    if ($nodeExitCode -ne 0 -or $passwordHash -notmatch '^scrypt\$[^$]+\$[^$]+$') {
        throw "Password hashing failed."
    }
} finally {
    if (Get-Variable plainPassword -ErrorAction SilentlyContinue) { Remove-Variable plainPassword }
    if (Get-Variable credential -ErrorAction SilentlyContinue) { Remove-Variable credential }
    if (Get-Variable securePassword -ErrorAction SilentlyContinue) { Remove-Variable securePassword }
    if (Get-Variable nodeHelperPath -ErrorAction SilentlyContinue) {
        if (Test-Path $nodeHelperPath) { Remove-Item $nodeHelperPath -Force }
        Remove-Variable nodeHelperPath
    }
}

$operator = [pscustomobject]@{
    principalId = $principalId
    email = $email
    roles = @($role)
    passwordHash = $passwordHash
    enabled = $true
}
$directory = ConvertTo-Json -InputObject @($operator) -Compress
[Environment]::SetEnvironmentVariable("GENESIS_OPERATOR_DIRECTORY_JSON", $directory, $EnvironmentTarget)
Remove-Variable passwordHash, operator, directory

[pscustomobject]@{
    DirectoryConfigured = $true
    OperatorRecordCount = 1
    PrincipalId = $principalId
    LoginIdentity = $email
    Role = $role
    PasswordHashPresent = $true
    PlaintextPasswordPersisted = $false
} | Format-List
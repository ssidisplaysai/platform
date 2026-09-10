import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { createNodeInstallerAdapters } from "./glw-immutable-installer.mjs";

function fail(message) { throw new Error(message); }
function sha256Text(value) { return createHash("sha256").update(value).digest("hex").toUpperCase(); }
function powershell(script, args = []) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script, ...args], { encoding: "utf8", windowsHide: true });
  if (result.error) fail(`PowerShell could not start: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr?.trim() || result.stdout?.trim() || `PowerShell failed with exit code ${result.status}.`);
  return result.stdout.trim();
}
function powershellJson(script, args = []) { const output = powershell(script, args); return output ? JSON.parse(output) : null; }
function persistenceSnapshot(root) {
  const campaignText = readFileSync(join(root, "glw-campaign-repository.json"), "utf8"); const targetText = readFileSync(join(root, "glw-campaign-target-repository.json"), "utf8"); const executionText = readFileSync(join(root, "glw-page-execution-repository.json"), "utf8");
  const campaigns = JSON.parse(campaignText).data.campaigns; const targets = JSON.parse(targetText).data.targets; const executions = JSON.parse(executionText).data.records;
  const ownershipKeys = targets.map((target) => { const campaign = campaigns.find((candidate) => candidate.campaignId === target.campaignId); return `${target.organizationId}::${target.siteId}::${target.productId}::${campaign?.pageType ?? ""}::${target.stateCode}::${target.citySlug ?? ""}`.toLowerCase(); });
  const collisions = ownershipKeys.length - new Set(ownershipKeys).size;
  const targetByJob = new Map(targets.filter((target) => target.jobId).map((target) => [target.jobId, target]));
  const unreconciled = executions.filter((execution) => { const target = targetByJob.get(execution.jobId); return execution.status === "COMPLETE" && execution.qaStatus === "COMPLETE" && execution.wordpressObjectId && execution.wordpressStatus === "draft" && ["queued", "running", "failed"].includes(target?.status); }).length;
  return { campaignHash: sha256Text(campaignText), targetHash: sha256Text(targetText), executionHash: sha256Text(executionText), campaignCount: campaigns.length, targetCount: targets.length, executionCount: executions.length, ownershipCollisionCount: collisions, unreconciledCount: unreconciled };
}
export function hasExactProtectedLauncherAuthority(security) {
  const rules = Array.isArray(security.rules) ? security.rules : [security.rules];
  return security.inheritanceProtected === true && /Administrators/iu.test(security.owner ?? "") && rules.length === 2 && rules.every((rule) => { const rights = String(rule.rights).split(/,\s*/u).sort(); return rule.inherited === false && rule.type === "Allow" && /^(NT AUTHORITY\\SYSTEM|BUILTIN\\Administrators)$/iu.test(rule.identity) && JSON.stringify(rights) === JSON.stringify(["ReadAndExecute", "Synchronize"]); });
}
async function getJson(url, headers = {}) { const response = await fetch(url, { method: "GET", headers }); if (!response.ok) fail(`GET ${url} returned HTTP ${response.status}.`); return response.json(); }
async function promotionState() {
  const response = await fetch("http://localhost:3001/api/glw/campaign-launch", { method: "GET", headers: { "x-gcp-roles": "administrator", "x-gcp-organization-id": "led-display-warehouse" } });
  if (response.status === 404) return { enabled: false, state: "ROUTE_UNAVAILABLE" };
  if (!response.ok) fail(`Promotion GET returned HTTP ${response.status}.`);
  const body = await response.json(); if (body.mutationPerformed !== false) fail("Promotion GET did not prove read-only behavior.");
  return { enabled: body.promotion?.state === "ENABLED_CERTIFIED_RELEASE", state: body.promotion?.state ?? "UNKNOWN" };
}
async function runtimeSnapshot(persistenceRoot) {
  const ports = powershellJson("$all=@(Get-CimInstance Win32_Process);$rows=@(foreach($port in 3001,3002){$l=Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue|Select-Object -First 1;$chain=@();$current=if($l){$l.OwningProcess}else{$null};for($i=0;$i-lt64-and$current;$i++){$p=$all|Where-Object ProcessId-eq$current|Select-Object -First 1;if(-not$p){break};$chain+=$p;$current=$p.ParentProcessId};$launcher=$chain|Where-Object{$_.Name-eq'powershell.exe'-and$_.CommandLine-like'*Start-GenesisGlw.ps1*'}|Select-Object -First 1;[pscustomobject]@{port=$port;pid=if($l){$l.OwningProcess}else{$null};launcherPid=$launcher.ProcessId;commandLine=($chain.CommandLine-join' | ')}});$rows|ConvertTo-Json -Compress");
  const production = ports.find((entry) => entry.port === 3001); const sidecar = ports.find((entry) => entry.port === 3002);
  if (!production?.pid || !sidecar?.pid) fail("Required production listeners are missing.");
  const version = await getJson("http://localhost:3001/api/glw/version"); const health = await getJson("http://localhost:3001/api/glw/health"); const capabilities = await getJson("http://localhost:3001/api/glw/capabilities"); const promotion = await promotionState(); const sidecarResponse = await fetch("http://localhost:3002/glw/campaigns", { method: "GET" });
  const statuses = capabilities.capabilities?.statuses ?? capabilities.record?.capabilities?.statuses ?? [];
  const healthy = health.record?.status?.state === "HEALTHY" && health.record?.status?.readiness === "READY" && health.record?.status?.liveness === "LIVE" && ["page-generation", "order-management"].every((capability) => statuses.some((status) => status.capability === capability && status.availability === "AVAILABLE"));
  const releaseMatch = production.commandLine?.match(/(C:\\ProgramData\\Genesis\\GLW\\releases\\[^"\\|]+)(?:\\|")/iu);
  return { healthy, health: `${health.record?.status?.state}/${health.record?.status?.readiness}/${health.record?.status?.liveness}`, port: 3001, pid: production.pid, launcherPid: production.launcherPid, expectedGenesisRuntime: /next.*start/iu.test(production.commandLine ?? "") && Boolean(production.launcherPid), sourceSha: version.git_commit, buildId: version.build_id, releasePath: releaseMatch?.[1].trim() ?? null, sidecarPid: sidecar.pid, sidecarHealthy: sidecarResponse.ok, promotionEnabled: promotion.enabled, promotionState: promotion.state, capabilities: statuses, persistence: persistenceSnapshot(persistenceRoot) };
}

export function createWindowsProductionAdapters({ persistenceRoot }) {
  let expectedSecurity = null;
  return createNodeInstallerAdapters({
    isElevatedAdministrator: () => powershell("$p=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent());if($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){'true'}else{'false'}") === "true",
    isPromotionEnvironmentSafe: () => process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED === undefined || process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED === "false",
    inspectProduction: async () => runtimeSnapshot(persistenceRoot),
    captureLauncherSecurity: (path) => { expectedSecurity = powershellJson("$acl=Get-Acl -LiteralPath $args[0];$rules=@($acl.Access|ForEach-Object{[pscustomobject]@{identity=$_.IdentityReference.Value;type=$_.AccessControlType.ToString();rights=$_.FileSystemRights.ToString();inherited=$_.IsInherited}});[pscustomobject]@{owner=$acl.Owner;sddl=$acl.Sddl;inheritanceProtected=$acl.AreAccessRulesProtected;rules=$rules;length=(Get-Item -LiteralPath $args[0]).Length;lastWriteTimeUtc=(Get-Item -LiteralPath $args[0]).LastWriteTimeUtc.ToString('o')}|ConvertTo-Json -Depth 5 -Compress", [path]); if (!hasExactProtectedLauncherAuthority(expectedSecurity)) fail("Protected launcher authority is invalid."); return expectedSecurity; },
    grantTemporaryLauncherWrite: (path, security) => { if (security.sddl !== expectedSecurity?.sddl) fail("Launcher security authority changed."); powershell("$path=$args[0];$expected=$args[1];$acl=Get-Acl -LiteralPath $path;if($acl.Sddl-ne$expected){throw 'Launcher SDDL drift.'};$rule=New-Object Security.AccessControl.FileSystemAccessRule('BUILTIN\\Administrators',[Security.AccessControl.FileSystemRights]::Write,[Security.AccessControl.AccessControlType]::Allow);$acl.AddAccessRule($rule)|Out-Null;Set-Acl -LiteralPath $path -AclObject $acl;$after=Get-Acl -LiteralPath $path;$writes=@($after.Access|Where-Object{$_.IdentityReference.Value-eq'BUILTIN\\Administrators'-and$_.AccessControlType-eq'Allow'-and($_.FileSystemRights-band[Security.AccessControl.FileSystemRights]::Write)});if($writes.Count-ne1){throw 'Transient launcher Write authority is not exact.'}", [path, security.sddl]); },
    replaceLauncher: (source, target) => copyFileSync(source, target),
    restoreLauncherSecurity: (path, security) => powershell("$acl=Get-Acl -LiteralPath $args[0];$acl.SetSecurityDescriptorSddlForm($args[1],[Security.AccessControl.AccessControlSections]::All);Set-Acl -LiteralPath $args[0] -AclObject $acl", [path, security.sddl]),
    verifyLauncherSecurity: (path, security) => { const current = powershellJson("$acl=Get-Acl -LiteralPath $args[0];$writeRules=@($acl.Access|Where-Object{$_.AccessControlType-eq'Allow'-and($_.FileSystemRights-band[Security.AccessControl.FileSystemRights]::Write)});[pscustomobject]@{owner=$acl.Owner;sddl=$acl.Sddl;inheritanceProtected=$acl.AreAccessRulesProtected;writeRuleCount=$writeRules.Count}|ConvertTo-Json -Compress", [path]); if (current.owner !== security.owner || current.sddl !== security.sddl || !current.inheritanceProtected || current.writeRuleCount !== 0) fail("Launcher owner or protected DACL was not restored exactly."); },
    writeText: (path, text) => writeFileSync(path, text, "utf8"),
    stopRuntimeOnce: async (before) => { if (!before.launcherPid) fail("Canonical production launcher process is unavailable."); powershell("$root=[int]$args[0];$all=@(Get-CimInstance Win32_Process);$ids=@($root);do{$children=@($all|Where-Object{$_.ParentProcessId-in$ids-and$_.ProcessId-notin$ids}|Select-Object -ExpandProperty ProcessId);$new=@($children|Where-Object{$_-notin$ids});$ids+=$new}while($new.Count-gt0);[array]::Reverse($ids);$ids|ForEach-Object{Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue};$deadline=(Get-Date).AddSeconds(45);while((Get-Date)-lt$deadline-and(Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue)){[Threading.Thread]::Sleep(250)};if(Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue){throw 'Port 3001 did not stop.'}", [String(before.launcherPid)]); },
    startProtectedLauncherOnce: async (launcher, port) => { const pid = Number(powershell("$p=Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$args[0],'-Port',$args[1]) -WorkingDirectory (Split-Path -Parent $args[0]) -PassThru;$p.Id", [launcher, String(port)])); if (!pid) fail("Protected launcher did not start."); return pid; },
    verifyInstalledRuntime: async (prepared) => { const deadline = Date.now() + 180_000; let lastError; while (Date.now() < deadline) { try { const snapshot = await runtimeSnapshot(persistenceRoot); if (snapshot.healthy && snapshot.sourceSha === prepared.plan.sourceSha && snapshot.buildId === prepared.plan.buildId) return snapshot; } catch (error) { lastError = error; } await new Promise((resolve) => setTimeout(resolve, 500)); } fail(`Installed runtime did not become healthy: ${lastError?.message ?? "identity mismatch"}`); },
  });
}

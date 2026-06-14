param(
  [string]$Root = "C:\LegalBahi",
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production",
  [switch]$RunSmoke
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\validate-production.ps1" -EnvironmentFile $EnvironmentFile -Root $Root -ValidateCaddy
$BuildMarker = Join-Path $Root "apps\web\.next\legalbahi-production-api.txt"
if (-not (Test-Path $BuildMarker) -or (Get-Content $BuildMarker -Raw).Trim() -ne $env:NEXT_PUBLIC_API_URL) {
  throw "Hosted web build does not match NEXT_PUBLIC_API_URL"
}

foreach ($Name in @("LegalBahiApi", "LegalBahiWorker", "LegalBahiWeb", "caddy")) {
  $Service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if (-not $Service -or $Service.Status -ne "Running") {
    throw "$Name service is not running"
  }
  if ($Name -ne "caddy") {
    $ServiceConfig = Get-CimInstance Win32_Service -Filter "Name='$Name'"
    if ($ServiceConfig.StartName -notin @("NT AUTHORITY\LocalService", "NT AUTHORITY\Local Service", "LocalService")) {
      throw "$Name must run as NT AUTHORITY\LocalService"
    }
  }
}

$Listeners = @(Get-NetTCPConnection -State Listen -LocalPort 3000,3001 -ErrorAction Stop)
foreach ($Port in @(3000, 3001)) {
  $PortListeners = @($Listeners | Where-Object LocalPort -eq $Port)
  if ($PortListeners.Count -eq 0) {
    throw "No service is listening on loopback port $Port"
  }
  if (@($PortListeners | Where-Object { $_.LocalAddress -notin @("127.0.0.1", "::1") }).Count -gt 0) {
    throw "Port $Port has a non-loopback listener"
  }
}

$BackupTask = Get-ScheduledTask -TaskName "LegalBahi PostgreSQL Backup" -ErrorAction SilentlyContinue
if (-not $BackupTask -or $BackupTask.State -eq "Disabled") {
  throw "LegalBahi PostgreSQL Backup scheduled task is missing or disabled"
}
$BackupTaskInfo = Get-ScheduledTaskInfo -TaskName "LegalBahi PostgreSQL Backup"
if ($BackupTaskInfo.LastRunTime -eq [DateTime]::MinValue -or $BackupTaskInfo.LastTaskResult -ne 0) {
  throw "LegalBahi PostgreSQL Backup has not completed successfully"
}

$ApiBaseUrl = $env:PUBLIC_API_URL.TrimEnd("/")
$WebBaseUrl = $env:PUBLIC_WEB_URL.TrimEnd("/")
$Ready = Invoke-WebRequest -Uri "$ApiBaseUrl/health/ready" -UseBasicParsing -TimeoutSec 20
if ($Ready.StatusCode -ne 200 -or $Ready.Content -notmatch '"ok"\s*:\s*true') {
  throw "Hosted API readiness check failed"
}
$Web = Invoke-WebRequest -Uri $WebBaseUrl -UseBasicParsing -TimeoutSec 20
if ($Web.StatusCode -ne 200 -or $Web.Content -notmatch "LegalBahi") {
  throw "Hosted LegalBahi web check failed"
}

$env:AWS_ACCESS_KEY_ID = $env:R2_BACKUP_ACCESS_KEY_ID
$env:AWS_SECRET_ACCESS_KEY = $env:R2_BACKUP_SECRET_ACCESS_KEY
$env:AWS_DEFAULT_REGION = "auto"
$ObjectsJson = aws s3api list-objects-v2 `
  --bucket $env:R2_BACKUP_BUCKET `
  --prefix "postgres/" `
  --endpoint-url "https://$env:R2_ACCOUNT_ID.r2.cloudflarestorage.com" `
  --output json
if ($LASTEXITCODE -ne 0) {
  throw "Unable to list PostgreSQL backups in R2"
}
$LatestBackup = ($ObjectsJson | ConvertFrom-Json).Contents |
  Where-Object { $_.Key.EndsWith(".dump.age") } |
  Sort-Object LastModified -Descending |
  Select-Object -First 1
if (-not $LatestBackup) {
  throw "No encrypted PostgreSQL backup exists in the R2 backup bucket"
}
if (([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse($LatestBackup.LastModified)) -gt [TimeSpan]::FromHours(26)) {
  throw "The latest encrypted PostgreSQL backup is older than 26 hours"
}

if ($RunSmoke) {
  & "$PSScriptRoot\run-production-smoke.ps1" -Root $Root -EnvironmentFile $EnvironmentFile
  if ($LASTEXITCODE -ne 0) {
    throw "Production smoke test failed"
  }
} else {
  Write-Host "Host checks passed. Re-run with -RunSmoke to execute real OTP, R2 document, Twilio, and Resend checks."
}

Write-Host "LegalBahi production host verification passed"

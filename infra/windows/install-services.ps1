param(
  [string]$Root = "C:\LegalBahi",
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production"
)

$ErrorActionPreference = "Stop"
$Nssm = "$Root\tools\nssm.exe"

if (-not (Test-Path $Nssm)) {
  throw "NSSM was not found at $Nssm"
}
if (-not (Test-Path $EnvironmentFile)) {
  throw "Production environment file was not found at $EnvironmentFile"
}
. "$PSScriptRoot\validate-production.ps1" -EnvironmentFile $EnvironmentFile -Root $Root -ValidateCaddy
$InvestorStaging = $env:INVESTOR_STAGING -eq "true"
$BuildMarker = Join-Path $Root "apps\web\.next\legalbahi-production-api.txt"
if (-not (Test-Path $BuildMarker) -or (Get-Content $BuildMarker -Raw).Trim() -ne $env:NEXT_PUBLIC_API_URL) {
  throw "Production web build is missing or was built for a different API URL; run infra\windows\build-web.ps1"
}

$Environment = @{}
Get-Content $EnvironmentFile | ForEach-Object {
  $Line = $_.Trim()
  if (-not $Line -or $Line.StartsWith("#")) {
    return
  }
  $Separator = $Line.IndexOf("=")
  if ($Separator -lt 1) {
    throw "Invalid environment line: $Line"
  }
  $Environment[$Line.Substring(0, $Separator).Trim()] = $Line.Substring($Separator + 1)
}
$Environment["NODE_ENV"] = "production"
$Environment["HOST"] = "127.0.0.1"
$Environment["PORT"] = "3001"

$Required = @(
  "JWT_SECRET", "CORS_ORIGINS", "DATABASE_URL", "PUBLIC_API_URL", "PUBLIC_WEB_URL",
  "PILOT_ADMIN_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY", "R2_DOCUMENT_BUCKET", "R2_BACKUP_BUCKET", "SENTRY_DSN",
  "IHC_SYNC_ENABLED"
)
if (-not $InvestorStaging) {
  $Required += @("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM")
}
$Missing = $Required | Where-Object { -not $Environment.ContainsKey($_) -or -not $Environment[$_].Trim() }
if ($Missing.Count -gt 0) {
  throw "Missing required production environment variables: $($Missing -join ', ')"
}
if ($Environment["ENABLE_DEMO_SURFACES"] -eq "true" -or $Environment["ENABLE_PRODUCT_SEED_DATA"] -eq "true") {
  throw "Demo surfaces and product seed data must remain disabled in production"
}
if ($Environment["R2_DOCUMENT_BUCKET"] -eq $Environment["R2_BACKUP_BUCKET"]) {
  throw "R2_DOCUMENT_BUCKET and R2_BACKUP_BUCKET must be separate buckets"
}

function ConvertTo-EnvironmentEntries {
  param([hashtable]$Values)
  return $Values.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }
}

$RuntimeNames = @(
  "NODE_ENV", "HOST", "PORT", "JWT_SECRET", "CORS_ORIGINS", "DATABASE_URL", "PUBLIC_API_URL", "PUBLIC_WEB_URL",
  "PILOT_ADMIN_SECRET", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM",
  "RESEND_API_KEY", "RESEND_FROM_EMAIL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
  "R2_DOCUMENT_BUCKET", "R2_BACKUP_BUCKET", "BACKUP_AGE_RECIPIENT", "SENTRY_DSN", "IHC_SYNC_ENABLED",
  "IHC_SYNC_INTERVAL_MINUTES", "TRUST_PROXY_LOOPBACK", "UPTIME_SECRET", "POSTGRES_SSL", "POSTGRES_POOL_SIZE",
  "POSTGRES_STATEMENT_TIMEOUT_MS", "GOOGLE_CLOUD_VISION_API_KEY", "ENABLE_DEMO_SURFACES", "ENABLE_PRODUCT_SEED_DATA",
  "INVESTOR_STAGING", "WAKEEL_DEV_OTP_CODE", "USE_POSTGRES_PRODUCT_STORE", "MALWARE_SCAN_ENABLED", "MALWARE_SCAN_PROVIDER"
)
$RuntimeEnvironment = @{}
foreach ($Name in $RuntimeNames) {
  if ($Environment.ContainsKey($Name)) {
    $RuntimeEnvironment[$Name] = $Environment[$Name]
  }
}
foreach ($Name in @("R2_BACKUP_ACCESS_KEY_ID", "R2_BACKUP_SECRET_ACCESS_KEY", "BACKUP_AGE_IDENTITY")) {
  if ($RuntimeEnvironment.ContainsKey($Name)) {
    throw "$Name must not be exposed to LegalBahi application services"
  }
}
$ApiEnvironmentEntries = ConvertTo-EnvironmentEntries $RuntimeEnvironment
$WebEnvironment = @{
  "NODE_ENV" = "production"
  "PORT" = "3000"
  "HOSTNAME" = "127.0.0.1"
  "ENABLE_DEMO_SURFACES" = "false"
  "NEXT_PUBLIC_ENABLE_DEMO_SURFACES" = "false"
  "NEXT_PUBLIC_API_URL" = $(if ($Environment.ContainsKey("NEXT_PUBLIC_API_URL")) { $Environment["NEXT_PUBLIC_API_URL"] } else { $Environment["PUBLIC_API_URL"] })
}
$WebEnvironmentEntries = ConvertTo-EnvironmentEntries $WebEnvironment

function Install-LegalBahiService {
  param(
    [string]$Name,
    [string]$Application = "C:\Program Files\nodejs\npm.cmd",
    [string]$Arguments,
    [string]$AppDirectory = $Root,
    [string[]]$EnvironmentEntries
  )

  if (-not (Get-Service -Name $Name -ErrorAction SilentlyContinue)) {
    & $Nssm install $Name $Application $Arguments
    if ($LASTEXITCODE -ne 0) { throw "NSSM failed to install $Name" }
  } else {
    & $Nssm set $Name Application $Application
    if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set the $Name application" }
    & $Nssm set $Name AppParameters $Arguments
    if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set the $Name arguments" }
  }
  & $Nssm set $Name AppDirectory $AppDirectory
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set the $Name directory" }
  & $Nssm set $Name AppEnvironmentExtra $EnvironmentEntries
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set the $Name environment" }
  & $Nssm set $Name ObjectName "LocalSystem"
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set the $Name service account" }
  & $Nssm set $Name AppExit Default Restart
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set the $Name restart policy" }
  & $Nssm set $Name AppRestartDelay 5000
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set the $Name restart delay" }

  $LogDirectory = Join-Path $Root "logs"
  if (-not (Test-Path $LogDirectory)) {
    New-Item -ItemType Directory -Path $LogDirectory | Out-Null
  }
  $StdoutLog = Join-Path $LogDirectory "$Name.stdout.log"
  $StderrLog = Join-Path $LogDirectory "$Name.stderr.log"
  & $Nssm set $Name AppStdout $StdoutLog
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set the $Name stdout log" }
  & $Nssm set $Name AppStderr $StderrLog
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set the $Name stderr log" }
  & $Nssm set $Name AppRotateFiles 1
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to enable log rotation for $Name" }
  & $Nssm set $Name AppRotateBytes 10485760
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to set log rotation size for $Name" }
}

$NodeExe = "C:\Program Files\nodejs\node.exe"
$ApiDirectory = Join-Path $Root "apps\api"

Install-LegalBahiService -Name "LegalBahiApi" -Application $NodeExe -Arguments "--import tsx src/server.ts" -AppDirectory $ApiDirectory -EnvironmentEntries $ApiEnvironmentEntries
Install-LegalBahiService -Name "LegalBahiWorker" -Application $NodeExe -Arguments "--import tsx src/worker.ts" -AppDirectory $ApiDirectory -EnvironmentEntries $ApiEnvironmentEntries
Install-LegalBahiService -Name "LegalBahiWeb" -Arguments "--workspace @wakeel/web run start" -EnvironmentEntries $WebEnvironmentEntries

foreach ($Name in @("LegalBahiApi", "LegalBahiWorker", "LegalBahiWeb")) {
  $Service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if ($Service) {
    $OldPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    & $Nssm stop $Name 2>$null | Out-Null
    $ErrorActionPreference = $OldPreference
  }
  Start-Sleep -Seconds 2
  & $Nssm start $Name
  if ($LASTEXITCODE -ne 0) { throw "NSSM failed to start $Name" }
}

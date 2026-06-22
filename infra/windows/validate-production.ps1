param(
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production",
  [string]$Root = "C:\LegalBahi",
  [switch]$ValidateCaddy
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\load-environment.ps1" -EnvironmentFile $EnvironmentFile

$InvestorStaging = $env:INVESTOR_STAGING -eq "true"

function Require-ProductionValue {
  param([string]$Name)
  $Value = [System.Environment]::GetEnvironmentVariable($Name, "Process")
  if (-not $Value -or -not $Value.Trim()) {
    throw "$Name is required in production"
  }
  return $Value.Trim()
}

function Get-ProductionOrigin {
  param(
    [string]$Name,
    [string]$Value,
    [switch]$AllowPath
  )
  $Uri = $null
  if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$Uri) -or $Uri.Scheme -ne "https") {
    throw "$Name must be an absolute HTTPS URL"
  }
  $ForbiddenHosts = @("localhost", "127.0.0.1", "::1", "legalbahi.example.com", "api.legalbahi.example.com")
  if (
    $ForbiddenHosts -contains $Uri.Host -or
    $Uri.Host.EndsWith(".example") -or
    $Uri.Host.EndsWith(".test") -or
    $Uri.Host.EndsWith(".invalid") -or
    $Uri.Host.EndsWith(".example.com")
  ) {
    throw "$Name must use a permanent production hostname"
  }
  if (-not $AllowPath -and ($Uri.AbsolutePath -ne "/" -or $Uri.Query -or $Uri.Fragment)) {
    throw "$Name must be an HTTPS origin without a path, query, or fragment"
  }
  return $Uri
}

$Required = @(
  "JWT_SECRET", "CORS_ORIGINS", "DATABASE_URL", "PUBLIC_API_URL", "PUBLIC_WEB_URL",
  "PILOT_ADMIN_SECRET", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY", "R2_DOCUMENT_BUCKET", "R2_BACKUP_BUCKET",
  "R2_BACKUP_ACCESS_KEY_ID", "R2_BACKUP_SECRET_ACCESS_KEY",
  "IHC_SYNC_ENABLED", "UPTIME_SECRET"
)
foreach ($Name in $Required) {
  Require-ProductionValue -Name $Name | Out-Null
}

$env:NODE_ENV = "production"
foreach ($Name in @("ENABLE_DEMO_SURFACES", "ENABLE_PRODUCT_SEED_DATA")) {
  if ([System.Environment]::GetEnvironmentVariable($Name, "Process") -eq "true") {
    throw "$Name must remain false in production"
  }
  [System.Environment]::SetEnvironmentVariable($Name, "false", "Process")
}
if ($env:IHC_SYNC_ENABLED -ne "true") {
  throw "IHC_SYNC_ENABLED must be true in production"
}
if ($env:TRUST_PROXY_LOOPBACK -ne "true") {
  throw "TRUST_PROXY_LOOPBACK must be true in production"
}

foreach ($Name in @("JWT_SECRET", "PILOT_ADMIN_SECRET", "UPTIME_SECRET")) {
  $Value = Require-ProductionValue -Name $Name
  if ($Value.Length -lt 32) {
    throw "$Name must be at least 32 characters in production"
  }
  if ($Value.ToLowerInvariant() -match "replace|change.?me|example|password|secret-at-least") {
    throw "$Name still contains a placeholder value"
  }
}

$ApiUri = Get-ProductionOrigin -Name "PUBLIC_API_URL" -Value $env:PUBLIC_API_URL
$WebUri = Get-ProductionOrigin -Name "PUBLIC_WEB_URL" -Value $env:PUBLIC_WEB_URL
if ($ApiUri.Host -eq $WebUri.Host) {
  throw "PUBLIC_API_URL and PUBLIC_WEB_URL must use separate hostnames"
}
if (-not $env:NEXT_PUBLIC_API_URL) {
  $env:NEXT_PUBLIC_API_URL = $ApiUri.GetLeftPart([UriPartial]::Authority)
}
$NextApiUri = Get-ProductionOrigin -Name "NEXT_PUBLIC_API_URL" -Value $env:NEXT_PUBLIC_API_URL
if ($NextApiUri.GetLeftPart([UriPartial]::Authority) -ne $ApiUri.GetLeftPart([UriPartial]::Authority)) {
  throw "NEXT_PUBLIC_API_URL must match PUBLIC_API_URL"
}

$CorsOrigins = @($env:CORS_ORIGINS.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($CorsOrigins.Count -eq 0) {
  throw "CORS_ORIGINS must contain at least one HTTPS origin"
}
foreach ($Origin in $CorsOrigins) {
  Get-ProductionOrigin -Name "CORS_ORIGINS" -Value $Origin | Out-Null
}

if ($env:DATABASE_URL -notmatch "^postgres(ql)?://") {
  throw "DATABASE_URL must be a PostgreSQL connection string"
}
if ($env:R2_DOCUMENT_BUCKET -eq $env:R2_BACKUP_BUCKET) {
  throw "R2_DOCUMENT_BUCKET and R2_BACKUP_BUCKET must be separate buckets"
}
if ($env:R2_ACCESS_KEY_ID -eq $env:R2_BACKUP_ACCESS_KEY_ID -or $env:R2_SECRET_ACCESS_KEY -eq $env:R2_BACKUP_SECRET_ACCESS_KEY) {
  throw "R2 backup credentials must be separate from document credentials"
}
if ($env:BACKUP_AGE_RECIPIENT -and $env:BACKUP_AGE_RECIPIENT -notmatch "placeholder" -and $env:BACKUP_AGE_RECIPIENT.Trim()) {
  if ($env:BACKUP_AGE_RECIPIENT -notmatch "^age1") {
    throw "BACKUP_AGE_RECIPIENT must be an age X25519 recipient"
  }
}
if ($InvestorStaging) {
  if (-not $env:WAKEEL_DEV_OTP_CODE) {
    throw "WAKEEL_DEV_OTP_CODE must be set when INVESTOR_STAGING=true"
  }
} else {
  if ($env:TWILIO_ACCOUNT_SID -and $env:TWILIO_ACCOUNT_SID -notmatch "placeholder" -and $env:TWILIO_ACCOUNT_SID.Trim()) {
    if ($env:TWILIO_ACCOUNT_SID -notmatch "^AC[A-Za-z0-9]+$") {
      throw "TWILIO_ACCOUNT_SID must be a Twilio account SID"
    }
  }
  if ($env:TWILIO_SMS_FROM -and $env:TWILIO_SMS_FROM -notmatch "placeholder" -and $env:TWILIO_SMS_FROM.Trim()) {
    if ($env:TWILIO_SMS_FROM -notmatch "^\+[1-9]\d{7,14}$") {
      throw "TWILIO_SMS_FROM must be an E.164 phone number"
    }
  }
}
if ($env:RESEND_FROM_EMAIL -and $env:RESEND_FROM_EMAIL -notmatch "placeholder" -and $env:RESEND_FROM_EMAIL.Trim()) {
  if ($env:RESEND_FROM_EMAIL -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") {
    throw "RESEND_FROM_EMAIL must be a valid email address"
  }
}
if ($env:SENTRY_DSN -and $env:SENTRY_DSN -notmatch "placeholder" -and $env:SENTRY_DSN.Trim()) {
  Get-ProductionOrigin -Name "SENTRY_DSN" -Value $env:SENTRY_DSN -AllowPath | Out-Null
}

$IhcInterval = 0
$IhcIntervalValue = if ($env:IHC_SYNC_INTERVAL_MINUTES) { $env:IHC_SYNC_INTERVAL_MINUTES } else { "60" }
if (-not [int]::TryParse($IhcIntervalValue, [ref]$IhcInterval) -or $IhcInterval -lt 5 -or $IhcInterval -gt 1440) {
  throw "IHC_SYNC_INTERVAL_MINUTES must be between 5 and 1440"
}

if ($ValidateCaddy) {
  $CaddyPath = Join-Path $Root "infra\windows\Caddyfile"
  if (-not (Test-Path $CaddyPath)) {
    throw "Caddyfile was not found at $CaddyPath"
  }
  $Caddy = Get-Content $CaddyPath -Raw
  if (-not $Caddy.Contains($WebUri.Host) -or -not $Caddy.Contains($ApiUri.Host)) {
    throw "Caddyfile does not contain the configured production hosts"
  }
}

Write-Host "LegalBahi production environment validation passed$(if ($InvestorStaging) { ' (investor staging)' })"

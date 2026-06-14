param(
  [string]$Root = "C:\LegalBahi",
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\validate-production.ps1" -EnvironmentFile $EnvironmentFile -Root $Root -ValidateCaddy

Push-Location $Root
try {
  npm --workspace @wakeel/web run build
  if ($LASTEXITCODE -ne 0) {
    throw "LegalBahi production web build failed"
  }
  $BuildMarker = Join-Path $Root "apps\web\.next\legalbahi-production-api.txt"
  Set-Content -Path $BuildMarker -Value $env:NEXT_PUBLIC_API_URL -NoNewline
} finally {
  Pop-Location
}

Write-Host "LegalBahi production web build passed for $env:NEXT_PUBLIC_API_URL"

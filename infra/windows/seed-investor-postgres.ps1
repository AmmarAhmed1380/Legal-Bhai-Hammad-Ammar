param(
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\load-environment.ps1" -EnvironmentFile $EnvironmentFile

if ($env:INVESTOR_STAGING -ne "true") {
  throw "INVESTOR_STAGING must be true before running the investor Postgres seed"
}

Push-Location "C:\LegalBahi"
try {
  npm run migrate
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL migration failed" }
  npm --workspace @wakeel/api run seed:investor
  if ($LASTEXITCODE -ne 0) { throw "Investor Postgres seed failed" }
} finally {
  Pop-Location
}

Write-Host "Investor Postgres seed passed"

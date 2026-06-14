param(
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\validate-production.ps1" -EnvironmentFile $EnvironmentFile
Push-Location "C:\LegalBahi"
try {
  npm run migrate
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL migration failed" }
} finally {
  Pop-Location
}

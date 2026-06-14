param(
  [string]$Root = "C:\LegalBahi",
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\validate-production.ps1" -EnvironmentFile $EnvironmentFile -Root $Root -ValidateCaddy
Push-Location $Root
try {
  npm run smoke:production
  if ($LASTEXITCODE -ne 0) { throw "Production smoke test failed" }
} finally {
  Pop-Location
}

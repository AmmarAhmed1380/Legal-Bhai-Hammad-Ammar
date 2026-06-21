param(
  [string]$HostName = "64.235.61.6",
  [string]$User = "Administrator",
  [string]$Password,
  [switch]$SkipWebRebuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if (-not $Password) {
  $Secure = Read-Host "VPS Administrator password" -AsSecureString
  $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($Bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
  }
}

$env:VPS_HOST = $HostName
$env:VPS_USER = $User
$env:VPS_SSH_PASSWORD = $Password
if ($SkipWebRebuild) {
  $env:VPS_SKIP_WEB_REBUILD = "true"
}

Push-Location $RepoRoot
try {
  node ".\scripts\vps-sync-config.mjs"
  if ($LASTEXITCODE -ne 0) {
    throw "Remote VPS config sync failed"
  }
} finally {
  Remove-Item Env:VPS_SSH_PASSWORD -ErrorAction SilentlyContinue
  Pop-Location
}

Write-Host "Remote config push finished."

param(
  [Parameter(Mandatory = $true)]
  [string]$EncryptedBackup,
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\load-environment.ps1" -EnvironmentFile $EnvironmentFile
$Dump = [System.IO.Path]::ChangeExtension($EncryptedBackup, ".dump")
try {
  age --decrypt --identity $env:BACKUP_AGE_IDENTITY --output $Dump $EncryptedBackup
  if ($LASTEXITCODE -ne 0) { throw "age decryption failed" }
  pg_restore --clean --if-exists --no-owner --dbname=$env:DATABASE_URL $Dump
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed" }
} finally {
  Remove-Item $Dump -ErrorAction SilentlyContinue
}

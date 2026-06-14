param(
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\load-environment.ps1" -EnvironmentFile $EnvironmentFile
foreach ($Name in @("DATABASE_URL", "BACKUP_AGE_RECIPIENT", "R2_ACCOUNT_ID", "R2_BACKUP_ACCESS_KEY_ID", "R2_BACKUP_SECRET_ACCESS_KEY", "R2_DOCUMENT_BUCKET", "R2_BACKUP_BUCKET")) {
  if (-not [System.Environment]::GetEnvironmentVariable($Name, "Process")) {
    throw "$Name is required for PostgreSQL backup"
  }
}
if ($env:R2_DOCUMENT_BUCKET -eq $env:R2_BACKUP_BUCKET) {
  throw "R2_DOCUMENT_BUCKET and R2_BACKUP_BUCKET must be separate buckets"
}
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = "C:\LegalBahi\backups"
$Dump = "$BackupDir\legalbahi-$Timestamp.dump"
$Encrypted = "$Dump.age"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$env:AWS_ACCESS_KEY_ID = $env:R2_BACKUP_ACCESS_KEY_ID
$env:AWS_SECRET_ACCESS_KEY = $env:R2_BACKUP_SECRET_ACCESS_KEY
$env:AWS_DEFAULT_REGION = "auto"

try {
  pg_dump --format=custom --no-owner --file=$Dump $env:DATABASE_URL
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
  age --recipient $env:BACKUP_AGE_RECIPIENT --output $Encrypted $Dump
  if ($LASTEXITCODE -ne 0) { throw "age encryption failed" }
  aws s3 cp $Encrypted "s3://$env:R2_BACKUP_BUCKET/postgres/" --endpoint-url "https://$env:R2_ACCOUNT_ID.r2.cloudflarestorage.com"
  if ($LASTEXITCODE -ne 0) { throw "R2 backup upload failed" }
} finally {
  Remove-Item $Dump -ErrorAction SilentlyContinue
}

Get-ChildItem $BackupDir -Filter "*.age" | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item

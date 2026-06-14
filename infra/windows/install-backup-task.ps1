param(
  [string]$Root = "C:\LegalBahi",
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production",
  [string]$DailyAt = "02:00"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\validate-production.ps1" -EnvironmentFile $EnvironmentFile -Root $Root

foreach ($Name in @("DATABASE_URL", "BACKUP_AGE_RECIPIENT", "R2_ACCOUNT_ID", "R2_BACKUP_ACCESS_KEY_ID", "R2_BACKUP_SECRET_ACCESS_KEY", "R2_DOCUMENT_BUCKET", "R2_BACKUP_BUCKET")) {
  if (-not [System.Environment]::GetEnvironmentVariable($Name, "Process")) {
    throw "$Name is required before installing the backup task"
  }
}
$Action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Root\infra\windows\backup-postgres.ps1`" -EnvironmentFile `"$EnvironmentFile`""
$Trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName "LegalBahi PostgreSQL Backup" `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -User "SYSTEM" `
  -RunLevel Highest `
  -Force | Out-Null

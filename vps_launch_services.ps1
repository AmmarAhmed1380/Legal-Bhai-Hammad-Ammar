$ErrorActionPreference = "Stop"

Set-Location "C:\LegalBahi"
Write-Host "Running install-services.ps1..."
.\infra\windows\install-services.ps1

Write-Host "Checking service status..."
Get-Service LegalBahiApi, LegalBahiWeb, LegalBahiWorker | Select-Object Name, Status

Write-Host "Deploy complete!"

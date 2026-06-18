$ErrorActionPreference = "Stop"

if (-not (Test-Path "C:\LegalBahi\tools\nssm.exe")) {
    Write-Host "Installing NSSM..."
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "C:\nssm.zip"
    Expand-Archive -Path "C:\nssm.zip" -DestinationPath "C:\nssm" -Force
    New-Item -ItemType Directory -Force -Path "C:\LegalBahi\tools" -ErrorAction SilentlyContinue
    Copy-Item "C:\nssm\nssm-2.24\win64\nssm.exe" "C:\LegalBahi\tools\nssm.exe"
}

Set-Location "C:\LegalBahi"
Write-Host "Running install-services.ps1..."
.\infra\windows\install-services.ps1

Write-Host "Checking service status..."
Get-Service LegalBahiApi, LegalBahiWeb, LegalBahiWorker | Select-Object Name, Status

Write-Host "Deploy complete!"

$ErrorActionPreference = "Stop"

if (-not (Test-Path "C:\LegalBahi\tools\nssm.exe")) {
    Write-Host "Installing NSSM from mirror..."
    Invoke-WebRequest -Uri "https://github.com/kirillkovalenko/nssm/releases/download/2.24-101-g897c7ad/nssm-2.24-101-g897c7ad.zip" -OutFile "C:\nssm.zip"
    Expand-Archive -Path "C:\nssm.zip" -DestinationPath "C:\nssm" -Force
    New-Item -ItemType Directory -Force -Path "C:\LegalBahi\tools" -ErrorAction SilentlyContinue
    Copy-Item "C:\nssm\nssm-2.24-101-g897c7ad\win64\nssm.exe" "C:\LegalBahi\tools\nssm.exe"
}

Set-Location "C:\LegalBahi"
Write-Host "Running install-services.ps1..."
.\infra\windows\install-services.ps1

Write-Host "Checking service status..."
Get-Service LegalBahiApi, LegalBahiWeb, LegalBahiWorker | Select-Object Name, Status

Write-Host "Deploy complete!"

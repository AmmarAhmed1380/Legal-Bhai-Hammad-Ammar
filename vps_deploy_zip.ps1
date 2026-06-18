$ErrorActionPreference = "Stop"

Write-Host "Cleaning up C:\LegalBahi..."
if (Test-Path "C:\LegalBahi") {
    Remove-Item "C:\LegalBahi" -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path "C:\LegalBahi"

Write-Host "Extracting code to C:\LegalBahi..."
Expand-Archive -Path "C:\legalbahi_deploy.zip" -DestinationPath "C:\LegalBahi" -Force

Write-Host "Ensuring postgres is started..."
Start-Process C:\pgsql\pgsql\bin\pg_ctl.exe -ArgumentList "-D C:\pgsql\data -l C:\pgsql\logfile start" -NoNewWindow -ErrorAction SilentlyContinue

Set-Location "C:\LegalBahi"
Write-Host "Installing dependencies..."
npm ci --legacy-peer-deps

Write-Host "Building web app..."
npm run build:web

Write-Host "Running Database & API Tests..."
$env:TEST_DATABASE_URL = "postgresql://postgres@127.0.0.1:5432/legalbahi"
npm run test:api

Write-Host "Running Migrations..."
$env:DATABASE_URL = "postgresql://postgres@127.0.0.1:5432/legalbahi"
npm run migrate

Write-Host "Deploy Script Complete!"

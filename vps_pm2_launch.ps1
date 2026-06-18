$ErrorActionPreference = "Stop"

Set-Location "C:\LegalBahi"

Write-Host "Installing PM2 globally..."
npm install -g pm2

Write-Host "Starting LegalBahi API with PM2..."
pm2 start npm --name "LegalBahiApi" -- run start:api

Write-Host "Starting LegalBahi Web with PM2..."
pm2 start npm --name "LegalBahiWeb" -- run start:web

Write-Host "Starting LegalBahi Worker with PM2..."
pm2 start npm --name "LegalBahiWorker" -- run start:worker

Write-Host "Saving PM2 process list..."
pm2 save

Write-Host "Installing PM2 startup script..."
pm2 startup windows

Write-Host "PM2 Deployment complete!"

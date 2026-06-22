# LegalBahi — kill dev servers on ports 3000/3001/8081 and restart API, web, and mobile.
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restart-servers.ps1
#   npm run restart:dev

$ErrorActionPreference = "Continue"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

function Stop-PortListeners {
    param([int[]] $Ports)

    $killed = @()
    foreach ($port in $Ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            $procId = $conn.OwningProcess
            if ($procId -and $procId -notin $killed) {
                $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "Killing $($proc.ProcessName) (PID $procId) on port $port..." -ForegroundColor DarkYellow
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                    $killed += $procId
                }
            }
        }
    }

    if ($killed.Count -eq 0) {
        Write-Host "No listeners found on ports $($Ports -join ', ')." -ForegroundColor Gray
    } else {
        Start-Sleep -Seconds 1
    }
}

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " LegalBahi dev server restart" -ForegroundColor Cyan
Write-Host " Repo: $RepoRoot" -ForegroundColor DarkGray
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Stopping API (3001), Web (3000), Mobile (8081)..." -ForegroundColor Yellow

Stop-PortListeners -Ports @(3000, 3001, 8081)

Write-Host ""
Write-Host "Starting api, web, and mobile..." -ForegroundColor Green
Write-Host "  API:    http://localhost:3001" -ForegroundColor DarkGray
Write-Host "  Web:    http://localhost:3000" -ForegroundColor DarkGray
Write-Host "  Mobile: http://localhost:8081 (Metro)" -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to stop all three." -ForegroundColor DarkGray
Write-Host ""

$env:NODE_ENV = "development"

npx concurrently `
    --kill-others `
    --prefix "[{name}]" `
    --names "api,web,mobile" `
    --prefix-colors "yellow,cyan,magenta" `
    "npm run dev:api" `
    "npm run dev:web" `
    "npm run dev:mobile"

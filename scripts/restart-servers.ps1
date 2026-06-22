Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Stopping any running dev servers (ports 3000, 3001, 8081)..." -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Cyan

$ports = 3000, 3001, 8081
$processes = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess | 
    Sort-Object -Unique

if ($processes) {
    foreach ($pid in $processes) {
        $p = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($p) {
            Write-Host "Killing process $($p.Name) (PID: $pid)..." -ForegroundColor DarkYellow
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "No active processes found on ports 3000, 3001, or 8081." -ForegroundColor Gray
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Restarting api, web, and mobile servers concurrently..." -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan

npx concurrently --kill-others --prefix "[{name}]" --names "api,web,mobile" --prefix-colors "yellow,cyan,magenta" "npm run dev:api" "npm run dev:web" "npm run dev:mobile"

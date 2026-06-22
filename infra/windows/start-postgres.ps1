param(
  [string]$Root = "C:\LegalBahi"
)

$ErrorActionPreference = "Stop"
$PgRoot = Join-Path $Root "postgresql_local"
$PgBin = Join-Path $PgRoot "pgsql\bin"
$Data = Join-Path $PgRoot "data"
$LogFile = Join-Path $PgRoot "logfile"
$ServiceName = "LegalBahiPostgres"

if (-not (Test-Path "$PgBin\pg_ctl.exe")) {
  throw "PostgreSQL binaries were not found at $PgBin"
}
if (-not (Test-Path $Data)) {
  throw "PostgreSQL data directory was not found at $Data"
}

foreach ($dependentService in @("LegalBahiApi", "LegalBahiWorker")) {
  $service = Get-Service -Name $dependentService -ErrorAction SilentlyContinue
  if ($service -and $service.Status -eq "Running") {
    Write-Host "Stopping $dependentService before PostgreSQL startup ..."
    Stop-Service -Name $dependentService -Force
  }
}

$registeredService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $registeredService) {
  Write-Host "Registering PostgreSQL Windows service ..."
  & "$PgBin\pg_ctl.exe" register -N $ServiceName -D $Data -S auto
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to register PostgreSQL Windows service"
  }
  $registeredService = Get-Service -Name $ServiceName
}

if ($registeredService.Status -ne "Running") {
  Write-Host "Starting PostgreSQL Windows service ..."
  Start-Service -Name $ServiceName
}

$ready = $false
for ($attempt = 0; $attempt -lt 45; $attempt++) {
  $probe = & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -tAc "SELECT 1" 2>$null
  if ($probe -eq "1") {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 1
}
if (-not $ready) {
  Get-Content $LogFile -Tail 40 | Write-Host
  throw "PostgreSQL did not become ready on 127.0.0.1:5432"
}

$dbExists = & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'legalbahi'"
if ($dbExists -ne "1") {
  Write-Host "Creating legalbahi database ..."
  & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "CREATE DATABASE legalbahi"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create legalbahi database"
  }
} else {
  Write-Host "Database legalbahi already exists"
}

Write-Host "PostgreSQL is ready"

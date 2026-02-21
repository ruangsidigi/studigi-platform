<#
Local development bootstrap script (Windows PowerShell)

What it does:
- Verifies Docker is installed
- Runs `docker compose up -d --build`
- Waits for Postgres on localhost:5432
- Installs backend dependencies, runs migrations
- Seeds admin user (uses values from backend/.env)
- Starts backend dev server in a new PowerShell window

Usage: Open PowerShell in the repo root and run:
  .\scripts\local_dev_setup.ps1

#>

Set-StrictMode -Version Latest

function Abort($msg) {
  Write-Host "ERROR: $msg" -ForegroundColor Red
  exit 1
}

Write-Host "Starting local development bootstrap..."

# 1) Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Abort "Docker is not installed or not in PATH. Please install Docker Desktop: https://www.docker.com/get-started"
}

Write-Host "Bringing up docker-compose services..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Abort 'docker compose failed' }

# 2) Wait for Postgres to be ready on localhost:5432
Write-Host "Waiting for Postgres on localhost:5432..."
$maxWait = 180
$waited = 0
while ($waited -lt $maxWait) {
  $res = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
  if ($res.TcpTestSucceeded) { break }
  Start-Sleep -Seconds 2
  $waited += 2
  Write-Host "...waiting ($waited/$maxWait)" -NoNewline; Write-Host
}
if ($waited -ge $maxWait) { Abort 'Timed out waiting for Postgres' }
Write-Host "Postgres is up."

# 3) Install backend dependencies
Write-Host "Installing backend dependencies..."
npm --prefix backend install
if ($LASTEXITCODE -ne 0) { Abort 'npm install failed' }

# 4) Run migrations against local DB
Write-Host "Running migrations..."
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/studigi_dev'
npm --prefix backend run migrate
if ($LASTEXITCODE -ne 0) { Abort 'Migration runner failed' }

# 5) Seed admin (reads ADMIN_EMAIL/ADMIN_PASSWORD from backend/.env or env)
Write-Host "Seeding admin user..."
if (-not $env:ADMIN_EMAIL) { $env:ADMIN_EMAIL = 'ruangsidigi@gmail.com' }
if (-not $env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD = 'RuangsiDigi25' }
npm --prefix backend run seed:admin
if ($LASTEXITCODE -ne 0) { Abort 'Admin seeding failed' }

# 6) Start backend dev server in a new PowerShell window so this script can exit
Write-Host "Starting backend dev server in a new PowerShell window..."
$startCmd = "npm --prefix backend run dev"
Start-Process powershell -ArgumentList "-NoExit","-Command`,"$startCmd" -WindowStyle Normal

Write-Host "Bootstrap complete. Backend running (watch the new window)."

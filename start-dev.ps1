$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'

Write-Host ''
Write-Host '======================================'
Write-Host '  SKD CPNS Tryout - Dev Starter'
Write-Host '======================================'
Write-Host "Root: $root"

if (-not (Test-Path $backendPath)) { throw "Backend folder not found: $backendPath" }
if (-not (Test-Path $frontendPath)) { throw "Frontend folder not found: $frontendPath" }

$backendCmd = "Set-Location '$backendPath'; npm run dev"
$frontendCmd = "Set-Location '$frontendPath'; npm start"

Start-Process -FilePath 'powershell' -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $backendCmd) -WorkingDirectory $backendPath | Out-Null
Start-Sleep -Seconds 2
Start-Process -FilePath 'powershell' -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $frontendCmd) -WorkingDirectory $frontendPath | Out-Null

Write-Host ''
Write-Host 'Started in separate PowerShell windows:'
Write-Host '- Backend : http://localhost:5000'
Write-Host '- Frontend: http://localhost:3000'
Write-Host ''
Write-Host 'If browser says cannot reach page, wait ~15-30s then refresh.'

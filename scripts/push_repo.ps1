Param(
    [string]$remoteUrl
)

Set-StrictMode -Version Latest

function Abort($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

$repoRoot = Convert-Path "$(Join-Path $PSScriptRoot '..')"
Write-Host "Repo root: $repoRoot"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Abort 'git is not installed or not in PATH' }

Push-Location $repoRoot
try {
    if (-not $remoteUrl) {
        $remoteUrl = Read-Host 'Enter Git remote URL (e.g. https://github.com/ruangsidigi/studigi-platform.git)'
    }

    # Create .gitignore if missing
    if (-not (Test-Path .gitignore)) {
        @"
# Node
node_modules/
npm-debug.log
yarn-error.log

# Env
.env
backend/.env

# OS
.DS_Store
Thumbs.db
"@ | Out-File -FilePath .gitignore -Encoding UTF8
        Write-Host 'Created .gitignore'
    } else { Write-Host '.gitignore exists' }

    # Create backend/.env.example (do not include secrets)
    $envExamplePath = Join-Path $repoRoot 'backend\.env.example'
    if (-not (Test-Path $envExamplePath)) {
        @"
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_KEY=your-supabase-anon-key
JWT_SECRET=your_jwt_secret
PORT=5000
NODE_ENV=production
PG_CONNECTION_STRING=postgresql://postgres:password@host:5432/dbname
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=your_admin_password
"@ | Out-File -FilePath $envExamplePath -Encoding UTF8
        Write-Host 'Created backend/.env.example'
    } else { Write-Host 'backend/.env.example exists' }

    # Stage files and backend
    git add .gitignore
    git add backend/.env.example
    git add backend

    # Commit
    $status = git status --porcelain
    if ($status) {
        try {
            git commit -m "chore: add backend and deploy files (no secrets)"
        } catch {
            Write-Host 'Nothing to commit or commit failed' -ForegroundColor Yellow
        }
    } else {
        Write-Host 'No changes to commit'
    }

    # Set remote
    $remotes = git remote
    if (-not ($remotes -match 'origin')) {
        git remote add origin $remoteUrl
        Write-Host "Added remote origin = $remoteUrl"
    } else {
        git remote set-url origin $remoteUrl
        Write-Host "Set origin URL = $remoteUrl"
    }

    # Push
    git branch -M main
    Write-Host 'Pushing to origin main...'
    git push -u origin main
    Write-Host 'Push complete.' -ForegroundColor Green

} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host 'If authentication failed, run `gh auth login` or set up SSH keys.'
    exit 1
} finally {
    Pop-Location
}

Write-Host 'Done. Check GitHub repo to confirm files are present.'

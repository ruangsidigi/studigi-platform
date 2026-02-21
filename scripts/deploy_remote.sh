#!/usr/bin/env bash
set -euo pipefail

# deploy_remote.sh
# Usage:
# 1) Clone or copy this repository to the VM, cd to the repo root.
# 2) Ensure you have a proper `backend/.env` in the repo (copy from your local machine securely).
# 3) Run: sudo bash scripts/deploy_remote.sh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Deploying Studigi backend from $REPO_ROOT"

# Install system packages and Node.js (Node 20 LTS)
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20.x and build tools..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get update
  sudo apt-get install -y nodejs git build-essential curl
else
  echo "Node already installed: $(node --version)"
fi

# Install repo deps
echo "Installing backend npm dependencies..."
npm --prefix backend install

# Ensure backend/.env exists
if [ ! -f "$REPO_ROOT/backend/.env" ]; then
  echo "ERROR: backend/.env not found. Create it with your Supabase credentials and env vars before continuing." >&2
  echo "You can copy your local backend/.env to the VM (scp) or create one with the required vars:" >&2
  echo "  PG_CONNECTION_STRING, SUPABASE_URL, SUPABASE_KEY, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD" >&2
  exit 1
fi

# Run migrations against the DB reachable from the VM (Supabase)
echo "Running migrations..."
npm --prefix backend run migrate

# Seed admin user (reads ADMIN_EMAIL/ADMIN_PASSWORD from backend/.env)
echo "Seeding admin user..."
npm --prefix backend run seed:admin || echo "Admin seeding returned non-zero exit (check logs)"

# Install pm2 to run the app in background
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing pm2 globally..."
  sudo npm install -g pm2
fi

# Start the backend with pm2
echo "Starting backend with pm2..."
pm --prefix backend run build 2>/dev/null || true
pm2 start --name studigi --cwd "$REPO_ROOT/backend" --interpreter node src/server.js || true
pm2 save || true

# (Optional) enable ufw and open port 5000
if command -v ufw >/dev/null 2>&1; then
  echo "Opening port 5000 in UFW..."
  sudo ufw allow 5000/tcp || true
fi

echo "Deployment complete."
echo "Check process: pm2 status" 
echo "View logs: pm2 logs studigi --lines 200"

echo "If the app cannot connect to Supabase Postgres, verify IPv6 connectivity using:"
echo "  Resolve-DNS or: dnsutils -> dig -6 db.bequugagflkevskuecug.supabase.co AAAA"
echo "  Test connection (from the VM): nc -6 -vz 2406:da1c:f42:ae03:6881:b514:4496:c229 5432"

exit 0

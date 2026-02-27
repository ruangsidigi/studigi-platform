# Deploying Backend to Railway

**Overview**

This backend is designed to run as a persistent Node.js server (not serverless) and can be deployed to Railway as a containerized service. Railway will build the project, install dependencies, and run the start script (`npm start`) from the `backend` directory.

## Prerequisites

- A GitHub repository for this project
- A Railway account (https://railway.app)
- A Postgres database (Supabase or other Postgres provider)
- Environment variables configured in Railway (see table below)

## Step-by-step deploy instructions

1. Create a new project in Railway and choose "Deploy from GitHub".
2. Connect your GitHub account and select the repository that contains this project.
3. When prompted for the root directory, set it to `backend` so Railway runs `npm install` and `npm start` from that folder.
4. Railway will autodetect Node.js, install dependencies, and run the `start` script. The backend entrypoint is `backend/server.js`, which delegates to the existing `src/start.js`.
5. Add the required environment variables in the Railway project settings (see table).
6. Trigger a deploy (Railway will build and run a persistent container). Monitor the build logs in the Railway dashboard.
7. Verify: open the service URL provided by Railway and hit the health endpoint (see below).

## Environment variables (placeholders)

| Variable | Description |
| -------------------- | -------------------------- |
| DATABASE_URL | Postgres connection string (postgres://user:pass@host:5432/dbname) |
| PG_CONNECTION_STRING | Alternate Postgres connection string variable (optional) |
| JWT_SECRET | Secret used to sign JWT tokens (keep this secure) |
| SUPABASE_URL | Supabase project URL (optional, if using Supabase features) |
| SUPABASE_SERVICE_KEY | Supabase service role key (optional) |
| STORAGE_ENDPOINT | S3/compatible storage endpoint (e.g., https://s3.example.com) |
| STORAGE_BUCKET | Storage bucket/container name |
| STORAGE_KEY | Storage access key |
| STORAGE_SECRET | Storage secret key |
| PORT | Optional override for the port (Railway provides a PORT env automatically)

## Health check

After deployment, verify the process is running by calling the health endpoint:

GET /health

Expected response:

```json
{
  "status": "ok"
}
```

## File upload notes

- Container filesystems are ephemeral. Do not rely on local disk to store uploaded files long-term.
- Keep using `multer` (already present) to accept uploads, but immediately forward uploaded files to persistent storage (S3, Supabase Storage, etc.) and delete temp files.
- Ensure the storage credentials (`STORAGE_*`) are set in Railway and that the app has network access to the storage endpoint.

## Troubleshooting

- App not starting: check Railway build logs and ensure `npm start` executes successfully from the `backend` folder. Confirm `server.js` exists at `backend/server.js`.
- Missing env vars: application may crash or degrade behavior. Add the env vars in Railway settings and redeploy. Use placeholders first.
- Port issues: Railway sets `PORT` automatically. The app uses the value from `process.env.PORT` (or default 5000). Do not hardcode a different port.
- Database connection errors: verify `DATABASE_URL` (or `PG_CONNECTION_STRING`) is correct and that network access (eg. allowed IPs) is configured for the DB. Supabase may require enabling connections from Railway IPs or allowing access from the environment.
- File uploads failing: confirm `multer` temp directory is writable (default OS tmp) and that storage credentials are valid. Check network egress to storage.

## Notes & next steps

- For stricter control over the container image, add a `Dockerfile` at `backend/Dockerfile`. Railway can use that instead of the default build.
- Rotate any secrets you used during local debugging (do not commit secrets to the repo).
- After a successful Railway deploy, test critical API flows: login, file upload, content CRUD, and reports.

If you want, I can add a dedicated section to the repository root `README.md` that links to this file and includes screenshots or Railway-specific tips.

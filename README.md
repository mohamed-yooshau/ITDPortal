# MTCC IT Portal

Enterprise internal IT portal with user-facing services, admin CMS, and backend APIs.

## Prerequisites
- Docker + Docker Compose
- Azure AD app registration (for login)

## Project Structure
- `backend/` Express + TypeScript API
- `user-portal/` React + Vite user portal
- `admin-cms/` React + Vite admin CMS
- `nginx/` legacy/reference reverse proxy config (production edge is managed externally)

## Environment Variables
Copy `.env.example` to `.env` and update values:

- `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`
- `REDIS_PASSWORD` (optional)
- `JWT_SECRET`
- `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
- `APS_TOKEN` (APS hierarchy API token)
- `FRONTEND_URL`, `ADMIN_URL`, `ADMIN_PATH`
- `USER_REDIRECT_URI`, `ADMIN_REDIRECT_URI`
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` (local emergency admin)
- `BOOTSTRAP_LOCAL_ONLY` (first-deploy local-only login bootstrap)
- `APP_BIND_HOST`, `BACKEND_HOST_PORT`, `USER_PORTAL_HOST_PORT`, `ADMIN_CMS_HOST_PORT` (external reverse proxy upstream bindings)
- `AUTH_ENCRYPTION_ENABLED`, `AUTH_PAYLOAD_ENC_KEY`, `AUTH_PAYLOAD_ENC_KID`

`ADMIN_PATH` controls the admin URL path segment (default recommended: `secure-admin`). `ADMIN_URL` should match that path, e.g. `https://your-domain/secure-admin`.

Azure redirect URIs should match the backend callback URLs:
- `http://localhost/api/auth/callback` for local
- `https://your-domain/api/auth/callback` for production

### Security-required environment variables

The backend will refuse to start if `JWT_SECRET` is missing. Always set it to a strong random value (32+ chars).
If `AUTH_ENCRYPTION_ENABLED=true`, you must provide `AUTH_PAYLOAD_ENC_KEY` (32-byte base64) and a `AUTH_PAYLOAD_ENC_KID`.

Local admin seeding is **disabled by default** unless both `ADMIN_USERNAME` and `ADMIN_PASSWORD` are provided. If they are missing, the backend skips creating the local admin and logs a warning.

## Start / Stop
From `/opt/it-portal`:

```bash
cp .env.example .env
# edit .env

docker compose up -d --build
```

By default the stack binds locally for an external reverse proxy:
- backend API: `127.0.0.1:3000`
- user portal: `127.0.0.1:3001`
- admin CMS: `127.0.0.1:3002`

Stop:

```bash
docker compose down
```

## Database Seed & Migrations
Migrations run automatically on backend startup. Seed data is included in SQL migrations.

To re-seed locally:

```bash
docker compose down
rm -rf ./db_data
# or remove Docker volume:
# docker volume rm it-portal_db_data

docker compose up -d --build
```

## Health Checks
Verify the backend:

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s http://127.0.0.1:3000/api/services
curl -I http://127.0.0.1:3001
curl -I http://127.0.0.1:3002
```

## Troubleshooting
- **/api returns HTML**: Check your external reverse proxy routing so `/api/` is sent to backend (`127.0.0.1:3000` by default). See `docs/EXTERNAL_REVERSE_PROXY_REQUIREMENTS.md`.
- **SPA routes 404**: Ensure `try_files $uri /index.html;` in the SPA nginx configs.
- **CORS errors**: Ensure `FRONTEND_URL` and `ADMIN_URL` match the browser origin.
- **Azure auth issues**: Validate redirect URIs and domain restriction to `@mtcc.com.mv`.

## Reverse Proxy / TLS
Production deployments are expected to use an external security-managed reverse proxy / TLS terminator.

See:
- `docs/EXTERNAL_REVERSE_PROXY_REQUIREMENTS.md`
- `docs/NEW_SERVER_DEPLOYMENT.md`

## Default Admin Access
The local admin account is created on backend start using:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Use the Admin CMS login page and the local admin form if Azure AD is unavailable.

## Integration Documentation

See `docs/INTEGRATION.md` for detailed API and integration guidance for in‑house apps.

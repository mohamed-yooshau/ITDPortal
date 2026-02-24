# MTCC IT Portal

Enterprise internal IT portal with user-facing services, admin CMS, and backend APIs.

## Prerequisites
- Docker + Docker Compose
- Azure AD app registration (for login)

## Project Structure
- `backend/` Express + TypeScript API
- `user-portal/` React + Vite user portal
- `admin-cms/` React + Vite admin CMS
- `nginx/` reverse proxy

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
curl -s http://localhost/api/health
curl -s http://localhost/api/services
```

## Troubleshooting
- **/api returns HTML**: Check `nginx/nginx.conf` to ensure `/api/` is proxied to backend.
- **SPA routes 404**: Ensure `try_files $uri /index.html;` in the SPA nginx configs.
- **CORS errors**: Ensure `FRONTEND_URL` and `ADMIN_URL` match the browser origin.
- **Azure auth issues**: Validate redirect URIs and domain restriction to `@mtcc.com.mv`.

## HTTPS
This stack can terminate HTTPS with a self-signed cert for local/dev:

```bash
mkdir -p ./nginx/certs
openssl req -x509 -nodes -newkey rsa:2048 \\
  -keyout ./nginx/certs/server.key \\
  -out ./nginx/certs/server.crt \\
  -days 365 -subj "/CN=localhost"
docker-compose up -d nginx
```

For production, use an external TLS terminator (recommended) or replace the certs with real ones.

## Default Admin Access
The local admin account is created on backend start using:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Use the Admin CMS login page and the local admin form if Azure AD is unavailable.

## Integration Documentation

See `docs/INTEGRATION.md` for detailed API and integration guidance for in‑house apps.

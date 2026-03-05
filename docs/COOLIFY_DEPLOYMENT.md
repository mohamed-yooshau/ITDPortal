# Coolify Local Deployment (ITD Portal)

This deployment uses a dedicated compose file for Coolify:
- `docker-compose.coolify.yml`
- `nginx/nginx.coolify.conf.template`

Use this instead of `docker-compose.yml` in Coolify.

## 1) Prerequisites
- Coolify is installed and running.
- Your repo is accessible by Coolify (GitHub/GitLab or local git server).
- DNS for your domain points to your Coolify host.

## 2) Create application in Coolify
1. Open Coolify.
2. `New Resource` -> `Application` -> `Docker Compose`.
3. Select your repository and branch.
4. Set `Compose Path` to:
   - `docker-compose.coolify.yml`
5. Set `Docker Compose Working Directory` to repo root (`/`).

## 3) Environment variables (required)
Set these in Coolify environment variables for the app:

### Core
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `REDIS_PASSWORD` (set strong value; can be empty if you intentionally disable password)
- `JWT_SECRET` (strong random)

### Portal URLs
Assume domain `https://portal.example.com`:
- `FRONTEND_URL=https://portal.example.com`
- `ADMIN_PATH=sudoMakeMeAdmin` (or your preferred path)
- `ADMIN_URL=https://portal.example.com/${ADMIN_PATH}`
- `USER_REDIRECT_URI=https://portal.example.com/api/auth/callback`
- `ADMIN_REDIRECT_URI=https://portal.example.com/api/auth/callback`

### Auth encryption (recommended)
- `AUTH_ENCRYPTION_ENABLED=true`
- `AUTH_PAYLOAD_ENC_KEY=<32-byte base64 key>`
- `AUTH_PAYLOAD_ENC_KID=v1`

Generate key example:
```bash
openssl rand -base64 32
```

### Local fallback admin
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

### Integrations (if used)
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `APS_TOKEN`
- `HELPDESK_STATUS_API_URL`
- `HELPDESK_STATUS_API_KEY`
- `UPTIME_KUMA_WEBHOOK_TOKEN` (optional)

## 4) Domain and port in Coolify
1. Add your domain to the `nginx` service.
2. Target port: `80`.
3. Enable HTTPS in Coolify for that domain.

Notes:
- Coolify terminates TLS.
- The app nginx in this setup is HTTP-only internally.

## 5) Deploy
Trigger deploy from Coolify.

## 6) Post-deploy checks
Run these checks (replace domain):
```bash
curl -I https://portal.example.com/
curl -I https://portal.example.com/api/health
curl -I https://portal.example.com/no
curl -I https://portal.example.com/${ADMIN_PATH}/login
```

Expected:
- `/` -> `200`
- `/api/health` -> `200`
- `/no` -> `200` (JSON)
- `/${ADMIN_PATH}/login` -> `200`

## 7) Azure redirect URI checklist
In Azure app registration, ensure both are present:
- `https://portal.example.com/api/auth/callback`
- (if admin uses same callback) same callback is fine

## 8) Common issue mapping
- **Admin URL shows NO page for normal users**: expected behavior (role-protected).
- **`500` on admin check**: verify user role is one of `superadmin`, `admin`, `editor`, `planner`.
- **Wrong callback/redirect loop**: verify `FRONTEND_URL`, `ADMIN_URL`, redirect URIs, and Azure callback values match exactly.

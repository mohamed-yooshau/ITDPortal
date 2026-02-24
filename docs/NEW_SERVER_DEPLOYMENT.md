# New Server Deployment (Bootstrap Local Admin First)

This project supports a safe first-deploy bootstrap flow:

- `BOOTSTRAP_LOCAL_ONLY=true` enables local login only
- Microsoft SSO is disabled until initial admin setup is complete
- Infrastructure secrets stay on the server (`.env` / secret manager), not in the admin panel
- Reverse proxy / TLS is managed separately (security-managed Nginx/edge)

## What Must Stay Outside The Admin Panel

Keep these server-managed:

- `JWT_SECRET`
- TLS certificates and private keys (security-managed edge)
- Database / Redis runtime credentials
- Docker / Compose / Nginx / host networking configuration

Manage these in the admin panel after first login:

- Azure app settings (Client ID / Secret / Tenant ID)
- Portal URLs and redirect URLs
- Portal branding, pages, feature toggles
- Helpdesk / APS / Uptime integrations

## 1. Prepare The New Server

Install:

- Docker Engine
- Docker Compose plugin

Open ports:

- `80/tcp`
- `443/tcp`

App containers expose local-only ports by default (for the external reverse proxy to use):

- `127.0.0.1:3000` -> backend API
- `127.0.0.1:3001` -> user portal SPA
- `127.0.0.1:3002` -> admin CMS SPA

Point DNS to the server IP:

- `your-domain.example`

## 2. Copy The App To The Server

Recommended location:

- `/opt/it-portal`

## 3. Stop Only Conflicting Services / Containers

If the server already runs other workloads, only stop what conflicts with your planned ports.

Check current containers and listeners:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
ss -ltnp | egrep ':(80|443|3000|3001|3002)\s' || true
```

Stop only conflicting system services (if present):

```bash
systemctl stop nginx apache2 caddy 2>/dev/null || true
```

Stop only conflicting containers:

```bash
docker ps --format '{{.ID}}\t{{.Names}}\t{{.Ports}}'
docker stop <container_id_1> <container_id_2>
```

If `3000/3001/3002` are in use and cannot be stopped, change these in `.env` before deploy:

- `BACKEND_HOST_PORT`
- `USER_PORTAL_HOST_PORT`
- `ADMIN_CMS_HOST_PORT`

## 4. Create Production Environment File

Use the template:

```bash
cp /opt/it-portal/.env.production.example /opt/it-portal/.env
```

Set strong values for:

- `JWT_SECRET`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Set deployment URLs:

- `FRONTEND_URL=https://your-domain.example`
- `ADMIN_PATH=yourAdminPath`
- `ADMIN_URL=https://your-domain.example/yourAdminPath`
- `USER_REDIRECT_URI=https://your-domain.example/api/auth/callback`
- `ADMIN_REDIRECT_URI=https://your-domain.example/api/auth/callback`

First deploy:

- `BOOTSTRAP_LOCAL_ONLY=true`

External reverse proxy upstream port bindings (defaults shown):

- `APP_BIND_HOST=127.0.0.1`
- `BACKEND_HOST_PORT=3000`
- `USER_PORTAL_HOST_PORT=3001`
- `ADMIN_CMS_HOST_PORT=3002`

Protect the file:

```bash
chmod 600 /opt/it-portal/.env
```

## 5. Coordinate External Reverse Proxy (Security Team)

Your security team will manage Nginx/TLS separately. Provide them:

- Public domain name
- `ADMIN_PATH`
- Upstream ports from `.env` (`BACKEND_HOST_PORT`, `USER_PORTAL_HOST_PORT`, `ADMIN_CMS_HOST_PORT`)

Routing and header requirements are documented in:

- `docs/EXTERNAL_REVERSE_PROXY_REQUIREMENTS.md`

## 6. Deploy Containers

```bash
cd /opt/it-portal
docker compose up -d --build
```

If this server previously ran an older version of this stack with the bundled `nginx` service, remove obsolete containers:

```bash
cd /opt/it-portal
docker compose up -d --build --remove-orphans
```

Verify:

```bash
docker compose ps
curl -s http://127.0.0.1:${BACKEND_HOST_PORT:-3000}/api/health
curl -I http://127.0.0.1:${USER_PORTAL_HOST_PORT:-3001}
curl -I http://127.0.0.1:${ADMIN_CMS_HOST_PORT:-3002}
```

If the external reverse proxy is already configured, also verify:

```bash
curl -I https://your-domain.example
```

## 7. First Login (Local Admin Only)

Open the admin console:

- `https://your-domain.example/<ADMIN_PATH>`

Log in using:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

In bootstrap mode, SSO is intentionally disabled.

## 8. Configure App-Level Settings In Admin Panel

Set:

- Azure app configuration and redirect values
- Portal URLs (frontend/admin)
- Helpdesk / APS / Uptime settings
- Branding / pages / content

## 9. Enable SSO After Setup

Change:

- `BOOTSTRAP_LOCAL_ONLY=false`

Restart backend:

```bash
cd /opt/it-portal
docker compose up -d --build backend
```

Test Microsoft SSO login.

Optional:

- Disable local login in admin panel after SSO is confirmed
- Keep a local admin account as break-glass access (strong password, restricted use)

## 10. Migrating Existing DB To A New Server (Optional)

If you are moving an existing environment, restore the database and then normalize runtime URLs in the `settings` table so they match the new domain.

Example SQL (edit domain and admin path):

```sql
BEGIN;

DELETE FROM settings
WHERE key IN ('db_user','db_password','db_name','db_host','db_port');

INSERT INTO settings (key, value) VALUES
  ('frontend_url', 'https://your-domain.example'),
  ('admin_url', 'https://your-domain.example/yourAdminPath'),
  ('user_redirect_uri', 'https://your-domain.example/api/auth/callback'),
  ('admin_redirect_uri', 'https://your-domain.example/api/auth/callback'),
  ('local_login_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

COMMIT;
```

Note:

- DB backups do not automatically include uploaded files in Docker volumes (`guides`, `policies`, branding uploads)
- Copy uploads separately if migrating production data

## 11. Git Safety Notes

This repository is configured to keep the following out of Git:

- `.env`
- `nginx/certs/*`
- build outputs (`dist/`)
- dependencies (`node_modules/`)
- exports/backups (`exports/*`)

Do not commit live secrets or TLS private keys.

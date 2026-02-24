# New Server Deployment (Bootstrap Local Admin First)

This project supports a safe first-deploy bootstrap flow:

- `BOOTSTRAP_LOCAL_ONLY=true` enables local login only
- Microsoft SSO is disabled until initial admin setup is complete
- Infrastructure secrets stay on the server (`.env` / secret manager), not in the admin panel

## What Must Stay Outside The Admin Panel

Keep these server-managed:

- `JWT_SECRET`
- TLS certificates and private keys
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

Point DNS to the server IP:

- `your-domain.example`

## 2. Copy The App To The Server

Recommended location:

- `/opt/it-portal`

## 3. Create Production Environment File

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

Protect the file:

```bash
chmod 600 /opt/it-portal/.env
```

## 4. Install TLS Certificates

Place valid certificates (not self-signed localhost certs):

- `/opt/it-portal/nginx/certs/server.crt`
- `/opt/it-portal/nginx/certs/server.key`

## 5. Deploy Containers

```bash
cd /opt/it-portal
docker compose up -d --build
```

Verify:

```bash
docker compose ps
curl -I https://your-domain.example
```

## 6. First Login (Local Admin Only)

Open the admin console:

- `https://your-domain.example/<ADMIN_PATH>`

Log in using:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

In bootstrap mode, SSO is intentionally disabled.

## 7. Configure App-Level Settings In Admin Panel

Set:

- Azure app configuration and redirect values
- Portal URLs (frontend/admin)
- Helpdesk / APS / Uptime settings
- Branding / pages / content

## 8. Enable SSO After Setup

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

## 9. Migrating Existing DB To A New Server (Optional)

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

## 10. Git Safety Notes

This repository is configured to keep the following out of Git:

- `.env`
- `nginx/certs/*`
- build outputs (`dist/`)
- dependencies (`node_modules/`)
- exports/backups (`exports/*`)

Do not commit live secrets or TLS private keys.

# ITD Portal Production Runbook

## 1) Prerequisites
- DNS for `itdportal.mtcc.com.mv` (and optional `dev-itdportal.mtcc.com.mv`).
- Security-managed reverse proxy / TLS termination (certified by security team).
- Docker + Docker Compose installed.

## 2) External Reverse Proxy
- This app stack no longer runs the bundled edge `nginx` service by default.
- The app exposes local host ports for an external reverse proxy:
  - backend API: `127.0.0.1:${BACKEND_HOST_PORT:-3000}`
  - user portal: `127.0.0.1:${USER_PORTAL_HOST_PORT:-3001}`
  - admin CMS: `127.0.0.1:${ADMIN_CMS_HOST_PORT:-3002}`
- Provide your security team with `ADMIN_PATH` and the routing requirements in `docs/EXTERNAL_REVERSE_PROXY_REQUIREMENTS.md`.

## 3) Environment
Copy and fill:
```
cp /opt/it-portal/.env.production.example /opt/it-portal/.env
```

Set strong values for:
- `JWT_SECRET`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `AZURE_CLIENT_SECRET`
- `APS_TOKEN`

Bootstrap recommendation (first deployment):
- Set `BOOTSTRAP_LOCAL_ONLY=true`
- Set strong `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- Sign in with the local admin account, configure app-level settings in the admin panel (Azure, portal URLs, helpdesk, uptime, branding)
- Then set `BOOTSTRAP_LOCAL_ONLY=false` and redeploy/restart backend to enable SSO

Do not manage these through the admin panel:
- `JWT_SECRET`
- TLS certificates / private keys
- Docker/host networking and reverse proxy certificates
- Database and Redis runtime credentials (keep these in `.env` / secret manager)

## 4) Start services
```
cd /opt/it-portal
docker compose up -d --build
```

If upgrading from an older deployment that used the bundled `nginx` service:
```
docker compose up -d --build --remove-orphans
```

## 5) Verify
```
docker compose ps
curl -s http://127.0.0.1:${BACKEND_HOST_PORT:-3000}/api/health
curl -I http://127.0.0.1:${USER_PORTAL_HOST_PORT:-3001}
curl -I http://127.0.0.1:${ADMIN_CMS_HOST_PORT:-3002}
```

Once the external reverse proxy is configured:
```
curl -I https://itdportal.mtcc.com.mv
```

Only the security-managed reverse proxy should expose `80/443`.

## 6) Backup
```
/opt/it-portal/scripts/backup-db.sh
```

## 7) Restore
```
/opt/it-portal/scripts/restore-db.sh /path/to/backup.sql
```

## 8) Export images (offline move)
```
docker save \
  it-portal-backend \
  it-portal-user-portal \
  it-portal-admin-cms \
  postgres:15-alpine \
  redis:7-alpine \
  -o /opt/it-portal/exports/itd-portal-images.tar
```

Load on another host:
```
docker load -i itd-portal-images.tar
```

## 9) Rollback
- Restore previous `docker-compose.yml` and app images.
- Coordinate reverse proxy rollback with the security team if routing changed.
- `docker compose down && docker compose up -d`

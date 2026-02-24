# ITD Portal Production Runbook

## 1) Prerequisites
- DNS for `itdportal.mtcc.com.mv` (and optional `dev-itdportal.mtcc.com.mv`).
- Valid TLS certs (Let’s Encrypt or org CA).
- Docker + Docker Compose installed.

## 2) TLS certificates
Place certs in:
- `/opt/it-portal/nginx/certs/server.crt`
- `/opt/it-portal/nginx/certs/server.key`

Restart nginx after updating certs:
```
docker compose up -d nginx
```

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
docker compose up -d
```

## 5) Verify
```
docker compose ps
curl -I https://itdportal.mtcc.com.mv
```

Only nginx should expose ports 80/443.

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
  nginx:1.25-alpine \
  postgres:15-alpine \
  redis:7-alpine \
  -o /opt/it-portal/exports/itd-portal-images.tar
```

Load on another host:
```
docker load -i itd-portal-images.tar
```

## 9) Rollback
- Restore previous `docker-compose.yml` and nginx config.
- `docker compose down && docker compose up -d`

# External Reverse Proxy Requirements (Security-Managed Nginx / Edge)

This app is designed to run behind a separately managed reverse proxy / TLS terminator.

## Upstream Targets (Default Host Bindings)

The app stack exposes these local host ports by default:

- `127.0.0.1:3000` -> `backend` API
- `127.0.0.1:3001` -> `user-portal` SPA
- `127.0.0.1:3002` -> `admin-cms` SPA

These are configurable in `.env`:

- `APP_BIND_HOST`
- `BACKEND_HOST_PORT`
- `USER_PORTAL_HOST_PORT`
- `ADMIN_CMS_HOST_PORT`

## Required Request Headers To Backend / SPAs

The reverse proxy must pass:

- `Host`
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

Recommended:

- `X-Forwarded-Host`

Reason:

- backend auth cookies and redirects depend on the forwarded host/proto values

## Routing Contract (Must Be Preserved)

Use your configured `ADMIN_PATH` (example: `sudoMakeMeAdmin`).

- `/api/` -> backend (`127.0.0.1:3000`)
- `/` -> user portal SPA (`127.0.0.1:3001`)
- `/${ADMIN_PATH}/` -> admin CMS SPA (`127.0.0.1:3002`) with prefix stripped before upstream

### Admin Path Specifics

Required behaviors:

- `/${ADMIN_PATH}` should redirect to `/${ADMIN_PATH}/`
- `/${ADMIN_PATH}/login` -> admin CMS (prefix stripped)
- `/${ADMIN_PATH}/auth/` -> admin CMS (prefix stripped)
- `/${ADMIN_PATH}/assets/` -> admin CMS (prefix stripped)
- `/${ADMIN_PATH}/` -> admin CMS (prefix stripped), protected by auth check

## Admin Access Protection (Important)

The certified reverse proxy should protect the admin SPA route using the backend check endpoint:

- Auth check endpoint: `/api/auth/admin-check` (backend)

Expected behavior:

- pass user cookies to `/api/auth/admin-check`
- if auth check returns `401/403`, block access to `/${ADMIN_PATH}/` pages
- allow login/auth/assets routes listed above without admin auth gate

## Upload / Streaming Behavior (Recommended)

To match application behavior, configure:

- `client_max_body_size 50m`

For these routes, disable proxy buffering/request buffering as appropriate:

- `/api/admin/policies/upload`
- `/api/utils/speed/download/stream`
- `/api/utils/speed/external-download`

## TLS / Security Headers

TLS termination and security headers are owned by the security-managed reverse proxy.

At minimum, use your approved profile for:

- TLS certificate/key management
- HSTS
- `X-Content-Type-Options`
- `X-Frame-Options` / `frame-ancestors` policy
- `Referrer-Policy`
- access/error logging and retention


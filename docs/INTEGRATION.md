# ITD Portal Integration Guide

This guide explains how to integrate in‑house apps with the ITD Portal backend and user/admin portals.

## Table of Contents
- Overview
- Architecture
- Authentication & Sessions
- User Identity & Profile Data
- Core APIs (User Portal)
- Admin APIs (Admin CMS)
- Announcements (Manual + Auto)
- Status (Uptime Kuma)
- Helpdesk Ticketing
- Policies & Procedures
- Guides
- Action Plan
- Environment & Configuration
- Troubleshooting

---

## Overview
The ITD Portal provides:
- A user portal (React) and admin portal (React) behind a single nginx entrypoint.
- A Node.js/Express backend with PostgreSQL.
- Azure Entra ID login for AAD users, plus local emergency accounts.

You can integrate other in‑house apps by:
- Consuming backend REST APIs directly.
- Embedding links to your apps in portal pages.
- Publishing announcements from your systems (manual today; auto downtime is supported via Kuma integration).

---

## Architecture
- **Frontend**: user-portal (public UI), admin-cms (admin UI)
- **Backend**: /api/* Express REST
- **DB**: PostgreSQL
- **Reverse proxy**: nginx

Routes:
- `/` → user portal
- `/admin` → admin portal
- `/api/*` → backend APIs

---

## Authentication & Sessions

### Azure Entra (AAD) login
- Backend endpoints:
  - `GET /api/auth/login?app=user|admin&redirect=1` → redirects to Microsoft login
  - `GET /api/auth/callback` → AAD callback
  - `GET /api/auth/me` → current user
  - `POST /api/auth/logout`
- Users must have `@mtcc.com.mv` domain.
- The backend issues a JWT for sessions.

### Local emergency login
- Endpoint: `POST /api/auth/local-login`
- Body: `{ "username": "localadmin", "password": "..." }`
- Returns `{ token, user }`

### JWT usage
- Include `Authorization: Bearer <token>` on API calls.
- Token TTL: 8h.

### Disabled users
- Users can be disabled by super admins. Disabled accounts cannot login or call APIs.

---

## User Identity & Profile Data

### APS profile
- Backend endpoint: `GET /api/aps/me`
- Returns normalized APS data using logged‑in user’s email.
- Used for profile details and images.

### APS photo
- Backend endpoint: `GET /api/aps/photo/:rcno`
- Returns image blob for the employee.

---

## Core APIs (User Portal)

### Services
- `GET /api/services`
- `GET /api/services/:id`

### Forms
- `GET /api/forms`

### Guides
- `GET /api/guides`
- `GET /api/guides/:id`

### Policies & Procedures
- `GET /api/policies`
- `GET /api/policies/:id/download`

### Status (Uptime Kuma)
- `GET /api/status/summary`

### Helpdesk
- `GET /api/helpdesk/config`
- `POST /api/helpdesk/ticket/create`

### Announcements
- `GET /api/announcements`
  - Returns combined manual announcements + auto alerts from Kuma.

---

## Admin APIs (Admin CMS)

### Users
- `GET /api/admin/users` (admin/super_admin)
- `PUT /api/admin/users/:id` (super_admin)
  - Body: `{ role?: "user"|"admin"|"super_admin", disabled?: boolean }`
- `DELETE /api/admin/users/:id` (super_admin)

### Services/Categories/Forms
- `POST/PUT/DELETE /api/admin/services`
- `POST/PUT/DELETE /api/admin/categories`
- `POST/PUT/DELETE /api/admin/forms`

### Guides
- `POST/PUT/DELETE /api/admin/guides`

### Policies
- `POST /api/admin/policies/upload` (multipart)
- `POST/PUT/DELETE /api/admin/policies`

### Settings
- `PUT /api/admin/settings` (super_admin)
  - portal title, announcements, Azure, DB, Kuma, nav order, etc.

---

## Announcements (Manual + Auto)

### Manual
- Managed in Admin Settings (`announcement` field).
- Supports multiple entries separated by new line or `||`.

### Auto from Uptime Kuma
- Backend polls Kuma status in `/api/announcements`.
- Any monitor with status DOWN generates:
  - `Status Alert: <monitor name> is currently down.`

---

## Status (Uptime Kuma)
The portal reads Kuma through backend proxy:
- `GET /api/status/summary`

Configuration stored in Admin Settings:
- `uptime_kuma_base_url`
- `uptime_kuma_api_key`
- `uptime_kuma_monitor_ids`
- `uptime_kuma_api_endpoint` (optional override)
- `uptime_kuma_insecure` (true/false)

---

## Helpdesk Ticketing

Configuration stored in Admin Settings:
- `helpdesk_api_base_url`
- `helpdesk_api_key_header`
- `helpdesk_api_key_value`
- `helpdesk_source`
- `helpdesk_enable_assets`
- `helpdesk_default_site_code`
- `helpdesk_sites` JSON

User flow:
- Frontend calls `/api/helpdesk/ticket/create`
- Backend proxies to Helpdesk API
- Ticket stored in DB and shown in Profile

---

## Policies & Procedures
- Stored in DB + file upload to `/uploads` volume.
- User downloads go through authenticated endpoint:
  - `/api/policies/:id/download`

---

## Guides
Guides support 3 types:
- Step‑by‑step
- Knowledge
- Embedded video (iframe URL normalized)

Admin can upload images for steps and manage via Admin CMS.

---

## Action Plan
Action Plan 2026 uses DB tables:
- `it_action_plan_initiatives`
- `it_action_plan_segments`

Admin manages via Admin CMS. User portal is read‑only.

---

## Environment & Configuration
Key settings are stored in DB (via Admin CMS) or `.env`:
- Azure: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
- URLs: `FRONTEND_URL`, `ADMIN_URL`, `USER_REDIRECT_URI`, `ADMIN_REDIRECT_URI`
- DB: `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`
- Redis: `REDIS_PASSWORD`

---

## Troubleshooting

### Auth issues
- Verify Entra redirect URI matches `https://<host>/api/auth/callback`.
- Verify user domain is `@mtcc.com.mv`.

### Status not loading
- Check Kuma API base URL and API key.
- Use override endpoint if using status‑page:
  - `https://<kuma>/api/status-page/<slug>`

### Upload errors (413)
- nginx `client_max_body_size` is set to unlimited.

---

## Contact
For ITD portal integration help, contact IT Ops.

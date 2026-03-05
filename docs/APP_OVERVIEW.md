# ITD Portal — Full Documentation (Current State)

## 1) System Overview
The ITD Portal is a containerized internal portal with:
- **User Portal** (React + Vite + TypeScript) served by nginx.
- **Admin CMS** (React + Vite + TypeScript) served by nginx under `/admin`.
- **Backend API** (Node.js + Express + TypeScript) providing REST APIs, auth, integrations, and storage access.
- **PostgreSQL** for persistence.
- **Redis** for caching/session use where applicable.
- **Reverse proxy** nginx as a single entrypoint for user/admin/API.

All components are orchestrated via **docker compose** under `/opt/it-portal`.

## 2) Runtime Architecture
**Entry points (nginx):**
- `https://<domain>/` → user-portal
- `https://<domain>/admin/` → admin-cms
- `https://<domain>/api/*` → backend

**Key containers:**
- `it-portal-nginx-1` (edge)
- `it-portal-backend-1` (API)
- `it-portal-user-portal-1` (user UI)
- `it-portal-admin-cms-1` (admin UI)
- `it-portal-db-1` (Postgres)
- `it-portal-redis-1`

## 3) Authentication & Roles
### Auth Methods
- **Azure Entra ID** (Microsoft login)
- **Local admin login** (toggleable)

### Roles (canonical)
- `superadmin`
- `admin`
- `editor`
- `planner`
- `user`

### Role Behavior
- **superadmin**: full access to all admin settings/pages.
- **admin**: full admin content access except restricted settings.
- **editor**: Guides only.
- **planner**: Action Plan only.
- **user**: no admin access.

### Role Enforcement
- **Backend**: enforced on admin endpoints.
- **Admin CMS**: role-based sidebar + route guards.
- **User Portal**: admin panel link shown for non-`user` roles.

## 4) User Portal — Pages & Features
### Pages
- **Home** — summary cards, ticket summary, announcements
- **Guides** — step-by-step + knowledge guides + embedded video
- **About** — includes “Meet Our Team” link
- **Team** — org tree view (desktop) + expandable list (mobile)
- **Forms** — compact cards, searchable
- **Policies/Procedures** — file list, filter by tag
- **Status** — Uptime Kuma status view
- **Profile** — user details, APS photo, Microsoft access, Autodesk licenses, tickets
- **Self Services** (`/services`) — Check IP + Speed Test (collapsible)

### Self Services (Services Page)
Only two cards are shown:
- **Check my IP** (auto-loads IP; manual refresh)
- **Speed Test** (Ookla-style SVG gauge with download/upload phases)

### Profile Highlights
- APS user data (name, rcno, division, designation)
- APS photo (from `/api/aps/photo/:rcno`)
- Microsoft Access summary (Outlook/Office/Teams/Project)
- Autodesk licenses (only assigned products, no “Verified” label)
- Tickets list (last 5 + link to helpdesk portal)

## 5) Admin CMS — Pages & Features
### Main Sections
- Overview (Forms + Guides counts)
- Forms
- Policies/Procedures
- Guides
- Action Plan 2026
- Helpdesk Settings
- Autodesk Import & Management
- User Management
- Settings (superadmin or restricted access)

### User Management
- Role change (User/Admin/Editor/Planner/Super Admin)
- Disable toggle
- Confirm / Cancel buttons

### Autodesk License Import
- CSV upload
- Normalization + upsert
- Admin actions: add/delete/clear entitlements

### Helpdesk Settings
- Sites list (editable)
- Urgency options
- Source label
- API base URL + header/key

### Settings (superadmin)
- Portal title
- Announcement text (multi-line)
- Footer text
- Page enable/disable toggles
- Local login toggle
- Azure/DB/Uptime settings
- Desktop nav order
- DB export/import

## 6) API Endpoints (Key)

### Auth
- `GET /api/auth/login` (Azure login)
- `GET /api/auth/callback` (Azure callback)
- `POST /api/auth/local-login`
- `GET /api/auth/me`
- `GET /api/auth/config` (local login enabled)
- `POST /api/auth/logout`

### Settings
- `GET /api/settings`
- `PUT /api/settings` (admin/superadmin; restricted keys for admin)
- `PUT /api/admin/settings` (admin/superadmin)

### APS Integration
- `GET /api/aps/me` (server-side APS lookup)
- `GET /api/aps/photo/:rcno`

### Profile
- `GET /api/profile/microsoft-access`
- `GET /api/profile/licenses`
- `GET /api/me/autodesk/licenses`

### Helpdesk
- `GET /api/helpdesk/config`
- `POST /api/helpdesk/ticket/create`
- `GET /api/helpdesk/tickets`
- `GET /api/helpdesk/status-count?site=ICT`

### Status / Announcements
- `GET /api/status/summary`
- `GET /api/announcements`

### Policies
- `GET /api/policies`
- `POST /api/admin/policies/upload`

### Guides
- `GET /api/guides`
- `GET /api/admin/guides`
- `POST /api/admin/guides`
- `PUT /api/admin/guides/:id`
- `DELETE /api/admin/guides/:id`

### Action Plan
- `GET /api/action-plan/initiatives`
- `POST /api/action-plan/initiatives` (admin/planner)
- `PUT /api/action-plan/initiatives/:id`
- `DELETE /api/action-plan/initiatives/:id`

### Autodesk
- `POST /api/admin/autodesk/licenses/import`
- `GET /api/admin/autodesk/licenses`
- `POST /api/admin/autodesk/licenses`
- `DELETE /api/admin/autodesk/licenses/:id`
- `DELETE /api/admin/autodesk/licenses`

### Utilities
- `GET /api/utils/ip`
- `GET /api/utils/speed/download`
- `POST /api/utils/speed/upload`

## 7) Database Schema (Key Tables)
From migrations in `/opt/it-portal/backend/migrations`:

- **users**: email, name, role, last_login, disabled
- **local_admins**: username, password_hash, role, disabled
- **categories** (feature removed in UI but table remains)
- **services** (admin CRUD removed, table remains)
- **forms**
- **knowledge_base**
- **settings**
- **helpdesk_tickets**
- **it_action_plan_initiatives**
- **it_action_plan_segments**
- **policies** (+ `kind` = policy/procedure)
- **autodesk_license_imports**
- **autodesk_user_entitlements**

## 8) Integrations
- **Azure Entra ID**: OAuth + Microsoft Graph token caching
- **APS API**: employee data + photo
- **Helpdesk API**: ticket create + status counts
- **Uptime Kuma**: status page + auto-announcements
- **Autodesk**: CSV import + entitlements

## 9) Page Toggles (Settings)
Each page can be enabled/disabled via settings:
- `page_guides_enabled`
- `page_action_plan_enabled`
- `page_announcements_enabled`
- `page_tickets_enabled`
- `page_forms_enabled`
- `page_policies_enabled`
- `page_profile_enabled`
- `page_services_enabled`
- `page_status_enabled`
- `page_about_enabled`
- `page_team_enabled`

Disabled pages are removed from nav and show “Page disabled” if accessed directly.

## 10) UI Theme
- Glassmorphism styling
- Light/Dark toggle
- Animated contour background (bottom-weighted)
- Mobile dock navigation (order mirrors desktop)

## 11) File Structure
- `backend/` — API
- `user-portal/` — User UI
- `admin-cms/` — Admin UI
- `nginx/` — reverse proxy config
- `docs/` — documentation

## 12) Operations
### Start
```
docker compose up -d --build
```

### Stop
```
docker compose down
```

### Backend logs
```
docker compose logs -f backend
```

### Admin/User rebuild
```
docker compose up -d --build admin-cms user-portal
```

## 13) Notes / Known Behavior
- Categories/services admin UI removed but DB tables remain.
- APS API failures will fallback to “Not available”.
- Autodesk section only renders when user has entitlements.

---

This document reflects the current build state as of Jan 2026.

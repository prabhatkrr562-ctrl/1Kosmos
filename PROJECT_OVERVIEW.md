# 1Kosmos Revenue Intelligence Platform — Overview

Django 6 backend (`kosmos/`) + React 18 frontend (`kosmos_frontend/`) delivering
three linked dashboards over Excel-sourced revenue data.

## Authentication
- Local username/password login for development.
- 1Kosmos SSO via SAML 2.0 (login, ACS callback, metadata, logout) gates all
  dashboard APIs through `require_session` middleware.

## ARR Dashboard (`/`)
- Upload a Booking Database workbook; each upload is stored as a new
  versioned import.
- 5-tab purple-themed view: closing ARR, bookings, customers, monthly trend,
  business-unit / industry / customer / product breakdowns.
- Filter by business unit, industry, sales person, and product.

## AR Dashboard (`/ar`)
- Upload the 3-sheet AR Master workbook (AR Aging, Payment History, Pending
  Invoices).
- Views for AR Aging, Collections, Renewals, a live inline data editor, and
  cross-metric correlation.

## Pipeline Dashboard (`/pipeline`)
- Upload pipeline export data, tracked per stage (`STAGE_ORDER`).
- KPIs: active pipeline, weighted pipeline, commit/upside splits, and
  coverage against AOP / sales target.
- Weekly deal-movement view (forward, backward, won/lost vs. prior week).

## AI Assistant
- `/api/ai/context/` + `/api/ai/chat/` expose a lightweight local RAG layer
  (`DASHBOARD_KNOWLEDGE`) that answers questions about KPI definitions and
  dashboard behavior — no external LLM call.

## Developer Tools
- `CodePanel` component + `/api/dev/source-code/` let a developer browse
  backend/frontend source from within the running app.

## Data & Storage
- SQLite by default; PostgreSQL via `DB_ENGINE`/`DB_*` env vars.
- All Excel parsing uses raw ZipFile/XML (no `openpyxl` dependency).

## Not Yet Implemented
- Production RBAC, AWS hosting, and formal data exports (see architecture
  doc in `requirements/`).

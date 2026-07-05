# 1Kosmos ARR Dashboard POC

This workspace integrates the React dashboard in `kosmos_frontend` with the
Django API in `kosmos`.

## What works

- Upload the provided `Booking Database.xlsx` from the dashboard.
- Validate the expected Booking Database schema (header row 22).
- Persist each upload as a new data version.
- Display closing ARR, bookings, customers, monthly trend, business-unit,
  industry, customer, and product breakdowns.
- Filter the dashboard by business unit, industry, sales person, and product.
- Open `/ar` for a separate Accounts Receivable dashboard.
- Upload the three-sheet AR Master workbook and analyze AR Aging, Payment
  History, and Pending Invoices.
- Use SQLite with no setup, or PostgreSQL through environment variables.
- Sign in through 1Kosmos SSO using SAML 2.0 before opening dashboard APIs.

The POC intentionally does not yet include production RBAC, AWS hosting, or
exports described in the architecture document.

## Run locally

Open two PowerShell terminals.

Backend:

```powershell
cd kosmos
.\venv\Scripts\pip.exe install -r requirements.txt
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver
```

Frontend:

```powershell
cd kosmos_frontend
npm.cmd start
```

Open `http://localhost:3000`, choose **Import Excel**, and upload
`requirements\Booking Database.xlsx`.

For Accounts Receivable, open `http://localhost:3000/ar` and upload
`requirements\AR Dashboard - Master Sheet - 15 June.xlsx`.

## 1Kosmos SAML SSO

Create a SAML application in 1Kosmos using these service-provider URLs for
local development:

```text
SP Entity ID: http://127.0.0.1:8000/api/auth/saml/metadata/
ACS URL:      http://127.0.0.1:8000/api/auth/saml/acs/
SLO URL:      http://127.0.0.1:8000/api/auth/saml/logout/
```

Then set the 1Kosmos IdP values before starting Django:

```powershell
$env:FRONTEND_URL="http://localhost:3000"
$env:SAML_IDP_ENTITY_ID="your-1kosmos-idp-entity-id"
$env:SAML_IDP_SSO_URL="https://your-1kosmos-sso-url"
$env:SAML_IDP_X509_CERT="-----BEGIN CERTIFICATE-----`n...`n-----END CERTIFICATE-----"
```

Optional overrides are available for hosted environments:

```powershell
$env:SAML_SP_ENTITY_ID="https://your-api.example.com/api/auth/saml/metadata/"
$env:SAML_SP_ACS_URL="https://your-api.example.com/api/auth/saml/acs/"
$env:SAML_SP_SLO_URL="https://your-api.example.com/api/auth/saml/logout/"
$env:SAML_IDP_SLO_URL="https://your-1kosmos-logout-url"
$env:SESSION_COOKIE_SECURE="true"
```

The React app checks `/api/auth/me/`, redirects unauthenticated users to
`/api/auth/saml/login/`, and uses the Django session cookie for dashboard API
calls.

## Optional PostgreSQL

Set these environment variables before starting Django:

```powershell
$env:DB_ENGINE="postgresql"
$env:DB_NAME="kosmos_db"
$env:DB_USER="postgres"
$env:DB_PASSWORD="your-password"
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
```

## Checks

```powershell
cd kosmos
.\venv\Scripts\python.exe manage.py test

cd ..\kosmos_frontend
npm.cmd test -- --watchAll=false
npm.cmd run build
```

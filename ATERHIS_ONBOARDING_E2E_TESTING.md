# Atheris Onboarding E2E Testing Guide

## Architecture Flow

```mermaid
graph TB
    subgraph "Tenant Backend (:9091)"
        OB[Onboarding Controller]
        RC[Regulator Controller]
        UC[Upload Controller]
        SC[Settings Controller]
        OS[ObligationSyncService<br/>scheduled poller]
        API[PlatformApiClient<br/>HTTP → :9090]
    end

    subgraph "Intelligence Backend (:9090)"
        IC[Internal Instrument Controller]
        IS[Internal Instrument Service]
        JQ[Job Queue]
        PP[Pipeline Processors<br/>OCR → Classify → Eval]
    end

    subgraph "Frontend (:5174)"
        OW[Onboarding Wizard<br/>6 Steps]
        RP[Regulator Management]
        UP[Document Upload]
    end

    OW -->|POST /onboarding/*| OB
    RP -->|CRUD /subscriptions/regulators| RC
    UP -->|POST /subscriptions/upload-document| UC
    UC -->|POST /internal/instruments/ingest| API
    API -->|X-Internal-Api-Key| IC
    IC --> IS
    IS --> JQ
    JQ --> PP
    OS -->|poll GET /internal/instruments/recent| API
    OS -->|poll GET /internal/instruments/{id}| API
    SC -->|GET/PUT /settings/polling| OS
```

---

## Prerequisites

1. **Docker PostgreSQL** running with both databases:
   ```bash
   docker exec -it db psql -U atheris -c "SELECT 1 FROM pg_database WHERE datname='atheris_tenant'" | grep -q 1 || docker exec -it db psql -U atheris -c "CREATE DATABASE atheris_tenant;"
   ```

2. **Internal API key** — must match between both `application.yml` files:
   - `intelligence-backend/src/main/resources/application.yml` → `app.internal-api-key`
   - `tenant-backend/src/main/resources/application.yml` → `platform.internal-api-key`

3. **GEMINI_API_KEY** env var set (or disable AI classifier for testing)

---

## Start Services

### Terminal 1: Intelligence Backend (:9090)
```bash
cd atheris-compliance-backend/atheris-compliance
mvn spring-boot:run -pl atheris-compliance-intelligence-backend -am
```

### Terminal 2: Tenant Backend (:9091)
```bash
cd atheris-compliance-backend/atheris-compliance
mvn spring-boot:run -pl atheris-compliance-tenant-backend -am
```

### Terminal 3: Frontend (:5174)
```bash
cd atheris-compliance-frontend
npm run dev --workspace=atheris-compliance-intelligence-frontend
```
> Opens at `http://localhost:5174`. If this is a new tenant, it redirects to `/onboarding`.

---

## Onboarding Flow (6 Steps)

| Step | Endpoint | Purpose |
|------|----------|---------|
| 1 | `POST /api/v1/onboarding/activate-license` | Validate license key, register device |
| 2 | `POST /api/v1/onboarding/institution` | Save institution details & licence type |
| 3 | `POST /api/v1/onboarding/user-setup` | Create admin user (local or LDAP) |
| 4 | `POST /api/v1/onboarding/regulators` | Subscribe to regulators + notification frequency |
| 5 | `POST /api/v1/onboarding/document-types` | Select document types + risk ratings |
| 6 | `POST /api/v1/onboarding/confirm` | Finalize onboarding, set webhook URL (optional) |

### Step 1 — Activate License
```bash
curl -X POST http://localhost:9091/api/v1/onboarding/activate-license \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "ATH-DEMO-0000-0000-0001",
    "deviceFingerprint": "test-device-001",
    "deviceLabel": "Testing Laptop"
  }'
```
Response: `{ "currentStep": 1, "tenantId": 1, "licenseKey": "ATH-...", "tier": "custom", "expiresAt": "..." }`

### Step 2 — Institution
```bash
curl -X POST http://localhost:9091/api/v1/onboarding/institution \
  -H "Content-Type: application/json" \
  -d '{
    "legalName": "Test Bank Ltd",
    "shortName": "TBL",
    "licenceType": "commercial_bank",
    "licenceNumber": "CBN-12345",
    "stateOfHq": "Lagos",
    "employeeCount": 500,
    "productLines": ["Retail Banking", "Corporate Banking"],
    "ccoName": "John Doe",
    "ccoEmail": "john@testbank.com",
    "techEmail": "tech@testbank.com"
  }'
```

### Step 3 — User Setup
```bash
# Local admin
curl -X POST http://localhost:9091/api/v1/onboarding/user-setup \
  -H "Content-Type: application/json" \
  -d '{
    "authType": "local",
    "localAdmin": {
      "fullName": "Admin User",
      "email": "admin@testbank.com",
      "password": "SecurePass123!"
    }
  }'

# OR LDAP
curl -X POST http://localhost:9091/api/v1/onboarding/user-setup \
  -H "Content-Type: application/json" \
  -d '{
    "authType": "ldap",
    "ldapConfig": {
      "url": "ldap://dc01.testbank.com"
    }
  }'
```

### Step 4 — Regulators
```bash
curl -X POST http://localhost:9091/api/v1/onboarding/regulators \
  -H "Content-Type: application/json" \
  -d '{
    "subscribedRegulators": [1, 2, 3],
    "notificationFrequency": "immediate"
  }'
```
> `subscribedRegulators` are IDs from the central `regulators` table (CBN=1, SEC=2, NAICOM=3, etc.)

### Step 5 — Document Types
```bash
curl -X POST http://localhost:9091/api/v1/onboarding/document-types \
  -H "Content-Type: application/json" \
  -d '{
    "subscribedDocumentTypes": ["circulars", "guidelines", "directives"],
    "notificationRiskRatings": ["high", "medium"]
  }'
```

### Step 6 — Confirm
```bash
curl -X POST http://localhost:9091/api/v1/onboarding/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://hooks.testbank.com/atheris"
  }'
```
Response: `{ "message": "Onboarding completed", "currentStep": 6, "onboardingCompleted": true }`

---

## Post-Onboarding: Tenant Operations

### Manage Regulators
```bash
# List subscribed regulators
curl http://localhost:9091/api/v1/subscriptions/regulators

# Add a regulator
curl -X POST http://localhost:9091/api/v1/subscriptions/regulators \
  -H "Content-Type: application/json" \
  -d '{
    "platformRegulatorId": 4,
    "name": "FIRS",
    "abbreviation": "FIRS",
    "notificationFrequency": "daily",
    "isActive": true
  }'

# Update a regulator
curl -X PUT http://localhost:9091/api/v1/subscriptions/regulators/1 \
  -H "Content-Type: application/json" \
  -d '{
    "notificationFrequency": "weekly",
    "isActive": false
  }'

# Remove a regulator
curl -X DELETE http://localhost:9091/api/v1/subscriptions/regulators/1
```

### Upload a Document
```bash
curl -X POST http://localhost:9091/api/v1/subscriptions/upload-document \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/test-circular.pdf" \
  -F "title=CBN FX Circular May 2026" \
  -F "regulatorId=1" \
  -F "documentType=circular"
```
Response: `{ "uploadId": 1, "status": "pending", "message": "Document uploaded, processing started" }`

### Poll Upload Status
```bash
# Check processing status
curl http://localhost:9091/api/v1/subscriptions/upload-status/1
```
Response: `{ "uploadId": 1, "status": "completed", "instrumentId": 42, "sourceTitle": "CBN FX Circular May 2026", "classificationStatus": "applicable", "errorMessage": null }`

Status values: `pending` → `processing` → `completed` / `failed`

### Get Classified Instruments
```bash
# List all classified instruments for this tenant
curl "http://localhost:9091/api/v1/subscriptions/instruments?page=0&size=20"

# Get full detail with obligations and sanctions
curl http://localhost:9091/api/v1/subscriptions/instruments/42
```

### Configure Polling Interval
```bash
# Current setting
curl http://localhost:9091/api/v1/settings/polling

# Update interval (e.g., every 2 minutes)
curl -X PUT http://localhost:9091/api/v1/settings/polling \
  -H "Content-Type: application/json" \
  -d '{
    "pollingIntervalMinutes": 2
  }'
```

---

## Internal Platform API (Intelligence Backend :9090)

These are called by the tenant backend, not directly by the frontend:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/internal/instruments/ingest` | POST | Ingest uploaded document (SHA-256 dedup) |
| `/api/v1/internal/instruments/recent` | GET | Poll for recently classified instruments |
| `/api/v1/internal/instruments/{id}` | GET | Full instrument detail with obligations |

All require header: `X-Internal-Api-Key: <value from application.yml>`

---

## Platform Admin UI (Intelligence Frontend :5173)

1. Open `http://localhost:5173`
2. Login: `admin@atheris.ng` / `admin123`
3. Navigate to:
   - **Pipeline** → `/admin/pipeline` — view OCR/classify/eval jobs from uploaded docs
   - **Regulators** → `/admin/regulators` — manage central regulators
   - **Tenants** → `/admin/tenants` — view tenant list
   - **Dashboard** → `/dashboard` — KPIs, pipeline health

---

## E2E Test Scenario

```bash
#!/bin/bash
# 1. Activate license
curl -s -X POST http://localhost:9091/api/v1/onboarding/activate-license \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"ATH-DEMO-0000-0000-0001","deviceFingerprint":"e2e-test"}' | jq .

# 2. Institution
curl -s -X POST http://localhost:9091/api/v1/onboarding/institution \
  -H "Content-Type: application/json" \
  -d '{"legalName":"E2E Bank","licenceType":"commercial_bank"}' | jq .

# 3. User setup
curl -s -X POST http://localhost:9091/api/v1/onboarding/user-setup \
  -H "Content-Type: application/json" \
  -d '{"authType":"local","localAdmin":{"fullName":"E2E Admin","email":"e2e@test.com","password":"Test123!"}}' | jq .

# 4. Regulators
curl -s -X POST http://localhost:9091/api/v1/onboarding/regulators \
  -H "Content-Type: application/json" \
  -d '{"subscribedRegulators":[1,2],"notificationFrequency":"immediate"}' | jq .

# 5. Document types
curl -s -X POST http://localhost:9091/api/v1/onboarding/document-types \
  -H "Content-Type: application/json" \
  -d '{"subscribedDocumentTypes":["circulars","guidelines"],"notificationRiskRatings":["high","medium"]}' | jq .

# 6. Confirm
curl -s -X POST http://localhost:9091/api/v1/onboarding/confirm \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

echo "--- Onboarding complete ---"

# 7. Upload a test document (create a dummy PDF first)
echo "%PDF-1.4 test" > /tmp/test-circular.pdf
curl -s -X POST http://localhost:9091/api/v1/subscriptions/upload-document \
  -F "file=@/tmp/test-circular.pdf" \
  -F "title=E2E Test Circular" \
  -F "regulatorId=1" \
  -F "documentType=circular" | jq .

# 8. Wait and poll
sleep 5
curl -s http://localhost:9091/api/v1/subscriptions/upload-status/1 | jq .
```

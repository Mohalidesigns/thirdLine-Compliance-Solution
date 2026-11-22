---
name: tenant-onboarding
description: Create a platform license and drive the Atheris tenant onboarding end to end (intel "atheris_intel" + tenant "atheris_tenant" Spring Boot backends). Use whenever the tenant must be re-onboarded after a DB drop/recreate or a fresh setup — issuing a license via the intel admin API, then running the tenant onboarding steps (activate-license, institution, user-setup, regulators, toolkit-regulators, smtp, confirm) and verifying the seed. Holds the exact endpoints, payloads, credentials, and verification.
---

# tenant-onboarding

Re-create a license and onboard the tenant without the browser wizard. Pairs with `db-migration` (which recreates the DBs).

## When to use

- After dropping/recreating `atheris_intel` / `atheris_tenant` and restarting both backends.
- Any fresh tenant setup where the onboarding wizard would otherwise be clicked through.

Run the helper: `.opencode/skills/tenant-onboarding/scripts/onboard.sh` (see below). It is idempotent-ish: safe to re-run against a fresh tenant.

## Prerequisites

- Intel up on `:9090` (seeds the toolkit), tenant up on `:9091`, tenant DB fresh (Flyway applied).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` exported (they live in `~/.bash_profile`; launchd sources it).
- Optional: LDAP on `localhost:1389`, Mailpit on `:1025`, so emails land somewhere.

## Endpoints (all public unless noted)

Intel (`:9090`):
- `POST /api/v1/auth/login` `{email, password}` → `{ accessToken }` (PLATFORM_ADMIN).
- `POST /api/v1/admin/licenses` (Bearer admin) `{tier, intelligenceEnabled, maxUsers, maxDevices, maxStorageMb, expiresAt, gracePeriodDays, autoSeedObligations, deviceFingerprintEnforced}` → `LicenseDto` incl. **`licenseKey`**. `tier` is free text (default `"custom"`); set **`autoSeedObligations: true`** so onboarding seeds obligations/controls/returns + the stakeholder titles.

Tenant (`:9091`, `/api/v1/onboarding/**` is `permitAll`):
1. `POST /activate-license` `{licenseKey, deviceFingerprint?, deviceLabel?}`
2. `POST /institution` `{legalName, address, contactPhone?, contactEmail?}`
3. `POST /user-setup` `{authType:"local", localAdmin:{fullName, email, password}}` — or `{authType:"ldap", ldapConfig:{url, bindDn, bindPassword, userSearchBase, userSearchFilterAttribute, fullNameAttribute, groupSearchBase?}}`
4. `POST /regulators` `{subscribedRegulators:[platformRegulatorId,...]}` (intelligence path → Review Inbox)
5. `POST /toolkit-regulators` `{subscribedRegulators:[...]}` (toolkit path → Register + titles). Selection may be the same list; empty = nothing seeds.
6. `POST /smtp` `{...}` (optional; Mailpit `localhost:1025` works)
7. `POST /confirm` `{}` → triggers `SeedService.seedAsync()`

Then seed the **sample stakeholders** (dev convenience — the core only offers the endpoint):
- The skill writes a **people file once** (`$HOME/.atheris/stakeholders.csv` by default; columns `name,email,title,department,unit`) and POSTs it to the core endpoint **`POST /api/v1/stakeholders/bulk-import`** (multipart `file`; CSV or XLSX; TENANT_ADMIN/CCO/ANALYST; idempotent by email). The default **titles** it references (Chief Compliance Officer, Branch Manager, …) ship as **system defaults** — they are seeded with the departments/units at `/confirm`.

Read `GET /status` at any point: `availableRegulators` (with `regulatorId`, `toolkitCount`, `intelligenceCount`) tells you which ids to subscribe; `currentStep`/`nextStep` track progress.

## Credentials

- Admin (intel): `ADMIN_USERNAME` / `ADMIN_PASSWORD` (from `~/.bash_profile`).
- Defaults (dev): org **Mam Corp**, `No 121, Lewis Street, Lagos Island, Lagos`; **LDAP** `ldap://localhost:1389` (bind `cn=admin,dc=atheris,dc=test` / `adminpassword`, search base `ou=people,dc=atheris,dc=test`, login `mail`, name `cn`); **break-glass local admin `super@atheris.test` / `Passw0rd!`**; seeded **CCO `cco@atheris.test`** and **ANALYST `analyst@atheris.test`**. LDAP users carry **no local password** (the directory owns it — all directory passwords are `Passw0rd!`).
- Override anything via env (`AUTH_TYPE=local` switches to local; `CCO_USERNAME`, `ANALYST_USERNAME`, `LDAP_*`, etc.).

## Verify

- `GET /api/v1/onboarding/seed-status` until `seeded`.
- Tenant logs `$TMPDIR/opencode/tenant-{out,err}.log`: `[SeedService] seedAll completed`, `[StakeholderTitles] seeded N/33 sample titles`, `[SeedService] filing periods materialised`; `err.log` empty.
- `GET /api/v1/onboarding/status` → `onboardingCompleted: true`.
- Tenant login as `cco@atheris.test` / `analyst@atheris.test` (LDAP) or `super@atheris.test` (break-glass, local).

## Gotchas

- Onboarding endpoints are **public** during setup — no tenant JWT needed. Do **not** curl normal tenant endpoints to "test" the UI; this skill only drives the setup API (sanctioned by the user).
- `autoSeedObligations` must be true on the license, else the toolkit (and the sample titles) never seed.
- The tenant seed runs **async** after `/confirm`; poll `seed-status`.
- Onboarding can only run once per tenant DB — drop/recreate `atheris_tenant` first if re-onboarding.
